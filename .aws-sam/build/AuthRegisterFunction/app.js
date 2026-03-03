/**
 * Routvi — Auth Register Handler
 * POST /v1/auth/register
 *
 * Recibe email, password y rol en el body,
 * simula el registro y devuelve una respuesta 201.
 */

const ALLOWED_METHOD = 'POST';

const headers = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
};

exports.handler = async (event) => {
  // ── 1. Validar método HTTP ────────────────────────────────────────
  const method = event.httpMethod || event.requestContext?.http?.method;

  if (method !== ALLOWED_METHOD) {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({
        mensaje: `Método ${method} no permitido. Usa POST.`,
        status: 'error',
      }),
    };
  }

  // ── 2. Parsear y validar el body ──────────────────────────────────
  let body;

  try {
    body = JSON.parse(event.body);
  } catch (error) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({
        mensaje: 'El cuerpo de la solicitud no es un JSON válido.',
        status: 'error',
      }),
    };
  }

  const bodyData = body || {};
  const { email, password, rol } = bodyData;

  if (!email || !password) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({
        mensaje: 'Los campos "email" y "password" son obligatorios.',
        status: 'error',
      }),
    };
  }

  // ── 3. Simulación de registro (aquí iría Cognito en el futuro) ────
  console.log(`[Routvi] Registro simulado → email: ${email}, rol: ${rol || 'cliente'}`);

  return {
    statusCode: 201,
    headers,
    body: JSON.stringify({
      mensaje: 'Usuario registrado exitosamente en Routvi',
      status: 'success',
      data: {
        email,
        rol: rol || 'cliente',
      },
    }),
  };
};
