/**
 * Routvi — Auth Login Handler
 * POST /v1/auth/login
 *
 * Authenticates a user via AWS Cognito and returns JWT tokens
 * (AccessToken, IdToken, RefreshToken).
 */

const {
  CognitoIdentityProviderClient,
  InitiateAuthCommand,
} = require('@aws-sdk/client-cognito-identity-provider');

const { validateLoginBody } = require('./validator');

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
  const { value, error: validationError } = validateLoginBody(bodyData);
  if (validationError) {
    return response(400, {
      status: 'error',
      message: validationError,
    });
  }

  const { email, password } = value;

  // 4. Authenticate with Cognito (USER_PASSWORD_AUTH flow)
  try {
    const authCommand = new InitiateAuthCommand({
      AuthFlow: 'USER_PASSWORD_AUTH',
      ClientId: CLIENT_ID,
      AuthParameters: {
        USERNAME: email,
        PASSWORD: password,
      },
    });

    const { AuthenticationResult } = await cognitoClient.send(authCommand);

    console.log(`[Routvi] User authenticated → email: ${email}`);

    return response(200, {
      status: 'success',
      message: 'Login successful.',
      data: {
        accessToken:  AuthenticationResult.AccessToken,
        idToken:      AuthenticationResult.IdToken,
        refreshToken: AuthenticationResult.RefreshToken,
        expiresIn:    AuthenticationResult.ExpiresIn, // seconds
        tokenType:    AuthenticationResult.TokenType, // "Bearer"
      },
    });

  } catch (err) {
    console.error('[Routvi] Error authenticating in Cognito:', err);

    // Known Cognito errors
    switch (err.name) {
      case 'NotAuthorizedException':
        return response(401, {
          status: 'error',
          message: 'Incorrect email or password.',
        });

      case 'UserNotFoundException':
        return response(404, {
          status: 'error',
          message: 'No account found with this email.',
        });

      case 'UserNotConfirmedException':
        return response(403, {
          status: 'error',
          message: 'Account is not confirmed. Please verify your email.',
        });

      default:
        return response(500, {
          status: 'error',
          message: 'Internal error while processing login. Please try again later.',
        });
    }
  }
};
