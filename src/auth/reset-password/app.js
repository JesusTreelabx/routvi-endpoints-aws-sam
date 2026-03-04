/**
 * Routvi — Auth Reset Password Handler
 * POST /v1/auth/reset-password
 *
 * Triggers a password recovery email via AWS Cognito (ForgotPassword flow).
 * Cognito sends a verification code to the user's registered email.
 * The code must then be used in POST /v1/auth/confirm-reset-password
 * to set a new password.
 */

const {
  CognitoIdentityProviderClient,
  ForgotPasswordCommand,
} = require('@aws-sdk/client-cognito-identity-provider');

const { validateResetPasswordBody } = require('./validator');

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
  const { value, error: validationError } = validateResetPasswordBody(bodyData);
  if (validationError) {
    return response(400, {
      status: 'error',
      message: validationError,
    });
  }

  const { email } = value;

  // 4. Trigger password reset email via Cognito ForgotPassword
  try {
    const forgotPasswordCommand = new ForgotPasswordCommand({
      ClientId: CLIENT_ID,
      Username: email,
    });

    const result = await cognitoClient.send(forgotPasswordCommand);

    // CodeDeliveryDetails tells us where Cognito sent the code (email/SMS)
    const delivery = result.CodeDeliveryDetails;

    console.log(`[Routvi] Password reset triggered → email: ${email}, delivery: ${delivery?.DeliveryMedium}`);

    return response(200, {
      status: 'success',
      message: 'A verification code has been sent to your email. Use it in /v1/auth/confirm-reset-password to set a new password.',
      data: {
        deliveryMedium:      delivery?.DeliveryMedium,      // "EMAIL" or "SMS"
        deliveryDestination: delivery?.Destination,          // Masked: "t***@r***m"
      },
    });

  } catch (err) {
    console.error('[Routvi] Error triggering password reset in Cognito:', err);

    // Known Cognito errors
    switch (err.name) {
      case 'UserNotFoundException':
        // For security, do NOT reveal if the email exists or not
        return response(200, {
          status: 'success',
          message: 'If an account with this email exists, a verification code will be sent.',
        });

      case 'InvalidParameterException':
        return response(400, {
          status: 'error',
          message: `Invalid parameter: ${err.message}`,
        });

      case 'LimitExceededException':
        return response(429, {
          status: 'error',
          message: 'Too many requests. Please wait before trying again.',
        });

      default:
        return response(500, {
          status: 'error',
          message: 'Internal error while processing the request. Please try again later.',
        });
    }
  }
};
