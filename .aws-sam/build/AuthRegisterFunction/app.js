/**
 * Routvi — Auth Register Handler
 * POST /v1/auth/register
 *
 * Registers a user in AWS Cognito User Pool.
 * Validates email, password (strong policy) and role (client | business).
 */

const {
  CognitoIdentityProviderClient,
  SignUpCommand,
  AdminConfirmSignUpCommand,
  AdminUpdateUserAttributesCommand,
} = require('@aws-sdk/client-cognito-identity-provider');

const { validateRegisterBody } = require('./validator');

// ── Constants ─────────────────────────────────────────────────────────
const ALLOWED_METHOD   = 'POST';
const USER_POOL_ID     = process.env.USER_POOL_ID;
const CLIENT_ID        = process.env.USER_POOL_CLIENT_ID;
const AWS_REGION       = process.env.AWS_REGION || 'us-east-1';

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
  const { value, error: validationError } = validateRegisterBody(bodyData);
  if (validationError) {
    return response(400, {
      status: 'error',
      message: validationError,
    });
  }

  const { email, password, rol } = value; // 'rol' already has default 'cliente' applied

  // 4. Register in Cognito
  try {
    const signUpCommand = new SignUpCommand({
      ClientId: CLIENT_ID,
      Username: email,
      Password: password,
      UserAttributes: [
        { Name: 'email',      Value: email },
        { Name: 'custom:rol', Value: rol   },
      ],
    });

    await cognitoClient.send(signUpCommand);

    // Auto-confirm the user to skip email verification at this stage
    const confirmCommand = new AdminConfirmSignUpCommand({
      UserPoolId: USER_POOL_ID,
      Username: email,
    });

    await cognitoClient.send(confirmCommand);

    // Mark the email as verified so Cognito allows ForgotPassword flow
    const verifyEmailCommand = new AdminUpdateUserAttributesCommand({
      UserPoolId: USER_POOL_ID,
      Username: email,
      UserAttributes: [
        { Name: 'email_verified', Value: 'true' },
      ],
    });

    await cognitoClient.send(verifyEmailCommand);

    console.log(`[Routvi] User registered, confirmed and email verified -> email: ${email}, rol: ${rol}`);

    return response(201, {
      status: 'success',
      message: 'User successfully registered in Routvi.',
      data: { email, rol },
    });

  } catch (err) {
    console.error('[Routvi] Error registering in Cognito:', err);

    // Known Cognito errors
    switch (err.name) {
      case 'UsernameExistsException':
        return response(409, {
          status: 'error',
          message: 'An account with this email already exists.',
        });

      case 'InvalidPasswordException':
        return response(400, {
          status: 'error',
          message: 'Password does not meet Cognito security requirements.',
        });

      case 'InvalidParameterException':
        return response(400, {
          status: 'error',
          message: `Invalid parameter: ${err.message}`,
        });

      default:
        return response(500, {
          status: 'error',
          message: 'Internal error while processing registration. Please try again later.',
        });
    }
  }
};
