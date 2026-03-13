/**
 * Routvi — Promotion Status Toggle Handler
 * PATCH /v1/promotions/{promoId}/status
 *
 * Activates or deactivates a promotion with a single click.
 * Supports:
 *   - No body  → auto-toggles current `active` value
 *   - { "active": true|false } → sets explicit value
 */

const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, GetCommand, UpdateCommand } = require('@aws-sdk/lib-dynamodb');

// ── Constants ─────────────────────────────────────────────────────────
const ALLOWED_METHOD = 'PATCH';
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
    return response(405, { status: 'error', message: `Method ${method} not allowed. Use PATCH.` });
  }

  const claims = event.requestContext?.authorizer?.claims;
  if (!claims) {
    return response(401, { status: 'error', message: 'Unauthorized. No valid token provided.' });
  }

  const businessId = claims['sub'];
  const rol        = claims['custom:rol'];

  if (rol !== 'negocio') {
    return response(403, { status: 'error', message: 'Access denied. Only business accounts can update promotion status.' });
  }

  const promotionId = event.pathParameters?.promoId;
  if (!promotionId) {
    return response(400, { status: 'error', message: '"promoId" path parameter is required.' });
  }

  // Parse optional body — explicit active value
  let explicitValue = undefined;
  try {
    const body = JSON.parse(event.body || '{}');
    if (typeof body.active === 'boolean') {
      explicitValue = body.active;
    }
  } catch {
    // body is optional, ignore parse errors
  }

  try {
    // Fetch current promotion to verify ownership and get current active value
    const existing = await docClient.send(new GetCommand({
      TableName: TABLE_NAME,
      Key: { businessId, promotionId },
    }));

    if (!existing.Item) {
      return response(404, { status: 'error', message: `Promotion "${promotionId}" not found.` });
    }

    const currentActive = existing.Item.active ?? true;
    const newActive     = explicitValue !== undefined ? explicitValue : !currentActive;
    const now           = new Date().toISOString();

    await docClient.send(new UpdateCommand({
      TableName:                 TABLE_NAME,
      Key:                       { businessId, promotionId },
      UpdateExpression:          'SET #active = :active, #updatedAt = :updatedAt',
      ExpressionAttributeNames:  { '#active': 'active', '#updatedAt': 'updatedAt' },
      ExpressionAttributeValues: { ':active': newActive, ':updatedAt': now },
    }));

    console.log(`[Routvi] PATCH /promotions/${promotionId}/status → ${currentActive} → ${newActive}`);

    return response(200, {
      status: 'success',
      message: `Promotion is now ${newActive ? 'active' : 'inactive'}.`,
      data: { promotionId, active: newActive, updatedAt: now },
    });

  } catch (err) {
    console.error('[Routvi] Error updating promotion status:', err);
    return response(500, { status: 'error', message: 'Internal error updating promotion status.' });
  }
};
