/**
 * Routvi — Promotion Get Handler
 * GET /v1/promotions/{promoId}
 *
 * Returns a single promotion by its promotionId.
 * Verifies the promotion belongs to the authenticated business.
 */

const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, GetCommand } = require('@aws-sdk/lib-dynamodb');

// ── Constants ─────────────────────────────────────────────────────────
const ALLOWED_METHOD = 'GET';
const TABLE_NAME     = process.env.PROMOTIONS_TABLE;
const AWS_REGION     = process.env.AWS_REGION || 'us-east-1';

const dynamoClient = new DynamoDBClient({ region: AWS_REGION });
const docClient    = DynamoDBDocumentClient.from(dynamoClient);

const headers = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
};

function response(statusCode, body) {
  return { statusCode, headers, body: JSON.stringify(body) };
}

// ── Handler ──────────────────────────────────────────────────────────
exports.handler = async (event) => {

  const method = event.httpMethod || event.requestContext?.http?.method;
  if (method !== ALLOWED_METHOD) {
    return response(405, { status: 'error', message: `Method ${method} not allowed. Use GET.` });
  }

  const claims = event.requestContext?.authorizer?.claims;
  if (!claims) {
    return response(401, { status: 'error', message: 'Unauthorized. No valid token provided.' });
  }

  const businessId = claims['sub'];
  const rol        = claims['custom:rol'];

  if (rol !== 'negocio') {
    return response(403, { status: 'error', message: 'Access denied. Only business accounts can access promotions.' });
  }

  const promotionId = event.pathParameters?.promoId;
  if (!promotionId) {
    return response(400, { status: 'error', message: '"promoId" path parameter is required.' });
  }

  try {
    const result = await docClient.send(new GetCommand({
      TableName: TABLE_NAME,
      Key: { businessId, promotionId },
    }));

    if (!result.Item) {
      return response(404, { status: 'error', message: `Promotion "${promotionId}" not found.` });
    }

    console.log(`[Routvi] GET /promotions/${promotionId} → businessId: ${businessId}`);

    return response(200, { status: 'success', data: result.Item });

  } catch (err) {
    console.error('[Routvi] Error fetching promotion:', err);
    return response(500, { status: 'error', message: 'Internal error retrieving the promotion.' });
  }
};
