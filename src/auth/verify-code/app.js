/**
 * Routvi — Auth Verify Code Handler
 * POST /v1/auth/verify-code
 *
 * Validates the 6-digit PIN sent by Cognito via email (ForgotPassword flow)
 * and sets a new password for the user.
 *
 * Flow:
 *   1. POST /v1/auth/reset-password  → Cognito sends PIN to email
 *   2. POST /v1/auth/verify-code     → User submits PIN + new password (this endpoint)
 */

const {
  CognitoIdentityProviderClient,
  ConfirmForgotPasswordCommand,
} = require('@aws-sdk/client-cognito-identity-provider');

const { validateVerifyCodeBody } = require('./validator');

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
  const { value, error: validationError } = validateVerifyCodeBody(bodyData);
  if (validationError) {
    return response(400, {
      status: 'error',
      message: validationError,
    });
  }

  const { email, code, newPassword } = value;

  // 4. Confirm the PIN and set the new password via Cognito
  try {
    const confirmCommand = new ConfirmForgotPasswordCommand({
      ClientId:         CLIENT_ID,
      Username:         email,
      ConfirmationCode: code,
      Password:         newPassword,
    });

    await cognitoClient.send(confirmCommand);

    console.log(`[Routvi] Password successfully reset for → email: ${email}`);

    return response(200, {
      status: 'success',
      message: 'Password has been reset successfully. You can now log in with your new password.',
    });

  } catch (err) {
    console.error('[Routvi] Error verifying code in Cognito:', err);

    // Known Cognito errors
    switch (err.name) {
      case 'CodeMismatchException':
        return response(400, {
          status: 'error',
          message: 'The verification code is incorrect. Please check your email and try again.',
        });

      case 'ExpiredCodeException':
        return response(400, {
          status: 'error',
          message: 'The verification code has expired. Please request a new one.',
        });

      case 'UserNotFoundException':
        return response(404, {
          status: 'error',
          message: 'No account found with this email.',
        });

      case 'InvalidPasswordException':
        return response(400, {
          status: 'error',
          message: 'The new password does not meet Cognito security requirements.',
        });

      case 'LimitExceededException':
        return response(429, {
          status: 'error',
          message: 'Too many attempts. Please wait before trying again.',
        });

      default:
        return response(500, {
          status: 'error',
          message: 'Internal error while verifying the code. Please try again later.',
        });
    }
  }
};
