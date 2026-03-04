/**
 * Routvi — Auth Me Handler
 * GET /v1/auth/me
 *
 * Returns the currently authenticated user's data.
 * The JWT token is validated by API Gateway's Cognito Authorizer
 * BEFORE this Lambda runs — no manual token verification needed.
 * User claims are injected into event.requestContext.authorizer.claims.
 */

// ── Constants ─────────────────────────────────────────────────────────
const ALLOWED_METHOD = 'GET';

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
      message: `Method ${method} not allowed. Use GET.`,
    });
  }

  // 2. Read user claims injected by API Gateway Cognito Authorizer
  // If we reach here, the token is already valid (API Gateway guarantees it)
  const claims = event.requestContext?.authorizer?.claims;

  if (!claims) {
    return response(401, {
      status: 'error',
      message: 'Unauthorized. No valid token provided.',
    });
  }

  const user = {
    sub:   claims['sub'],              // Unique Cognito user ID
    email: claims['email'],            // User email
    rol:   claims['custom:rol'],       // Custom role: 'cliente' | 'negocio'
    emailVerified: claims['email_verified'] === 'true',
  };

  console.log(`[Routvi] GET /me → user: ${user.email}`);

  return response(200, {
    status: 'success',
    data: user,
  });
};
