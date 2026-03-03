/**
 * Routvi — Auth Register Handler
 * POST /v1/auth/register
 *
 * Registra un usuario en AWS Cognito User Pool.
 * Valida email, password (política fuerte) y rol (cliente | negocio).
 */

const {
  CognitoIdentityProviderClient,
  SignUpCommand,
  AdminConfirmSignUpCommand,
} = require('@aws-sdk/client-cognito-identity-provider');

const { validateRegisterBody } = require('./validator');

// ── Constantes ────────────────────────────────────────────────────────
const ALLOWED_METHOD   = 'POST';
const USER_POOL_ID     = process.env.USER_POOL_ID;
const CLIENT_ID        = process.env.USER_POOL_CLIENT_ID;
const AWS_REGION       = process.env.AWS_REGION || 'us-east-1';

const cognitoClient = new CognitoIdentityProviderClient({ region: AWS_REGION });

const headers = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
};

// ── Utilidad: respuesta JSON uniforme ────────────────────────────────
function response(statusCode, body) {
  return { statusCode, headers, body: JSON.stringify(body) };
}

// ── Handler ──────────────────────────────────────────────────────────
exports.handler = async (event) => {

  // 1. Validar método HTTP
  const method = event.httpMethod || event.requestContext?.http?.method;
  if (method !== ALLOWED_METHOD) {
    return response(405, {
      status: 'error',
      mensaje: `Método ${method} no permitido. Usa POST.`,
    });
  }

  // 2. Parsear body
  let bodyData;
  try {
    bodyData = JSON.parse(event.body || '{}');
  } catch {
    return response(400, {
      status: 'error',
      mensaje: 'El cuerpo de la solicitud no es un JSON válido.',
    });
  }

  // 3. Validar campos con Joi
  const { value, error: validationError } = validateRegisterBody(bodyData);
  if (validationError) {
    return response(400, {
      status: 'error',
      mensaje: validationError,
    });
  }

  const { email, password, rol } = value; // 'rol' ya tiene default 'cliente' aplicado

  // 4. Registrar en Cognito
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

    // Auto-confirmar el usuario para no requerir verificación de email en esta fase
    const confirmCommand = new AdminConfirmSignUpCommand({
      UserPoolId: USER_POOL_ID,
      Username: email,
    });

    await cognitoClient.send(confirmCommand);

    console.log(`[Routvi] Usuario registrado y confirmado → email: ${email}, rol: ${rol}`);

    return response(201, {
      status: 'success',
      mensaje: 'Usuario registrado exitosamente en Routvi.',
      data: { email, rol },
    });

  } catch (err) {
    console.error('[Routvi] Error al registrar en Cognito:', err);

    // Errores conocidos de Cognito
    switch (err.name) {
      case 'UsernameExistsException':
        return response(409, {
          status: 'error',
          mensaje: 'Ya existe una cuenta registrada con ese email.',
        });

      case 'InvalidPasswordException':
        return response(400, {
          status: 'error',
          mensaje: 'La contraseña no cumple los requisitos de seguridad de Cognito.',
        });

      case 'InvalidParameterException':
        return response(400, {
          status: 'error',
          mensaje: `Parámetro inválido: ${err.message}`,
        });

      default:
        return response(500, {
          status: 'error',
          mensaje: 'Error interno al procesar el registro. Intenta de nuevo más tarde.',
        });
    }
  }
};
