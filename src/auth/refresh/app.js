/**
 * Routvi — Auth Refresh Handler
 * POST /v1/auth/refresh
 *
 * Renews the AccessToken and IdToken using a valid RefreshToken,
 * without requiring the user to log in again.
 */

const {
  CognitoIdentityProviderClient,
  InitiateAuthCommand,
} = require('@aws-sdk/client-cognito-identity-provider');

const { validateRefreshBody } = require('./validator');

// ── Constants ─────────────────────────────────────────────────────────
const ALLOWED_METHOD = 'POST';
const CLIENT_ID      = process.env.USER_POOL_CLIENT_ID;
const AWS_REGION     = process.env.AWS_REGION || 'us-east-1';

const cognitoClient = new CognitoIdentityProviderClient({ region: AWS_REGION });

const headers = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
};

// ── Utility: uniform JSON response ───────────────────────────────────
function response(statusCode, body) {
  return { statusCode, headers, body: JSON.stringify(body) };
}

// ── Handler ──────────────────────────────────────────────────────────
exports.handler = async (event) => {

  // 1. Validate HTTP method
  const method = event.httpMethod || event.requestContext?.http?.method;
  if (method !== ALLOWED_METHOD) {
    return response(405, {
      status: 'error',
      message: `Method ${method} not allowed. Use POST.`,
    });
  }

  // 2. Parse body
  let bodyData;
  try {
    bodyData = JSON.parse(event.body || '{}');
  } catch {
    return response(400, {
      status: 'error',
      message: 'Request body is not valid JSON.',
    });
  }

  // 3. Validate fields with Joi
  const { value, error: validationError } = validateRefreshBody(bodyData);
  if (validationError) {
    return response(400, {
      status: 'error',
      message: validationError,
    });
  }

  const { refreshToken } = value;

  // 4. Exchange refreshToken for new tokens via Cognito (REFRESH_TOKEN_AUTH flow)
  try {
    const authCommand = new InitiateAuthCommand({
      AuthFlow: 'REFRESH_TOKEN_AUTH',
      ClientId: CLIENT_ID,
      AuthParameters: {
        REFRESH_TOKEN: refreshToken,
      },
    });

    const { AuthenticationResult } = await cognitoClient.send(authCommand);

    console.log('[Routvi] Token refreshed successfully.');

    // Cognito does NOT return a new RefreshToken on this flow — the existing one remains valid
    return response(200, {
      status: 'success',
      message: 'Token refreshed successfully.',
      data: {
        accessToken: AuthenticationResult.AccessToken,
        idToken:     AuthenticationResult.IdToken,
        expiresIn:   AuthenticationResult.ExpiresIn, // seconds
        tokenType:   AuthenticationResult.TokenType, // "Bearer"
      },
    });

  } catch (err) {
    console.error('[Routvi] Error refreshing token in Cognito:', err);

    // Known Cognito errors
    switch (err.name) {
      case 'NotAuthorizedException':
        return response(401, {
          status: 'error',
          message: 'Invalid or expired refresh token. Please log in again.',
        });

      case 'UserNotFoundException':
        return response(404, {
          status: 'error',
          message: 'No account found for this token.',
        });

      default:
        return response(500, {
          status: 'error',
          message: 'Internal error while refreshing the token. Please try again later.',
        });
    }
  }
};
