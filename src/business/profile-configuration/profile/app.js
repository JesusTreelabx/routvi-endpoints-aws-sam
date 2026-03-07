/**
 * Routvi — Business Profile GET Handler
 * GET /v1/business/profile
 *
 * Returns the business profile for the authenticated user.
 * Protected by Cognito Authorizer — only 'negocio' role can access.
 * Reads from DynamoDB using the JWT 'sub' as the userId key.
 */

const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, GetCommand } = require('@aws-sdk/lib-dynamodb');

// ── Constants ─────────────────────────────────────────────────────────
const ALLOWED_METHOD   = 'GET';
const TABLE_NAME       = process.env.BUSINESS_PROFILES_TABLE;
const AWS_REGION       = process.env.AWS_REGION || 'us-east-1';

const dynamoClient = new DynamoDBClient({ region: AWS_REGION });
const docClient    = DynamoDBDocumentClient.from(dynamoClient);

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

  // 2. Read claims injected by API Gateway Cognito Authorizer
  const claims = event.requestContext?.authorizer?.claims;
  if (!claims) {
    return response(401, {
      status: 'error',
      message: 'Unauthorized. No valid token provided.',
    });
  }

  const userId = claims['sub'];
  const rol    = claims['custom:rol'];

  // 3. Only 'negocio' role can access business profile
  if (rol !== 'negocio') {
    return response(403, {
      status: 'error',
      message: 'Access denied. Only business accounts can access this resource.',
    });
  }

  // 4. Read business profile from DynamoDB
  try {
    const result = await docClient.send(new GetCommand({
      TableName: TABLE_NAME,
      Key: { userId },
    }));

    if (!result.Item) {
      return response(404, {
        status: 'error',
        message: 'Business profile not found. Please complete your profile setup.',
      });
    }

    console.log(`[Routvi] GET /business/profile → userId: ${userId}`);

    return response(200, {
      status: 'success',
      data: result.Item,
    });

  } catch (err) {
    console.error('[Routvi] Error reading business profile from DynamoDB:', err);

    return response(500, {
      status: 'error',
      message: 'Internal error while reading the business profile. Please try again later.',
    });
  }
};
