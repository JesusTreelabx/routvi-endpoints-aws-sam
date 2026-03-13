/**
 * Routvi — Product Availability Toggle Handler
 * PATCH /v1/menu/products/{productId}/availability
 *
 * Toggles or explicitly sets the `available` flag of a product.
 * Designed for a single-click "sold out" toggle in the restaurant UI.
 *
 * Request body (optional):
 *   { "available": false }   ← explicit value
 *   {}                       ← no body: auto-toggles current value
 */

const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, GetCommand, UpdateCommand } = require('@aws-sdk/lib-dynamodb');

// ── Constants ─────────────────────────────────────────────────────────
const ALLOWED_METHOD = 'PATCH';
const TABLE_NAME     = process.env.MENU_PRODUCTS_TABLE;
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

  // 1. Validate HTTP method
  const method = event.httpMethod || event.requestContext?.http?.method;
  if (method !== ALLOWED_METHOD) {
    return response(405, { status: 'error', message: `Method ${method} not allowed. Use PATCH.` });
  }

  // 2. Read claims from Cognito Authorizer
  const claims = event.requestContext?.authorizer?.claims;
  if (!claims) {
    return response(401, { status: 'error', message: 'Unauthorized. No valid token provided.' });
  }

  const businessId = claims['sub'];
  const rol        = claims['custom:rol'];

  // 3. Role check
  if (rol !== 'negocio') {
    return response(403, { status: 'error', message: 'Access denied. Only business accounts can update product availability.' });
  }

  // 4. Extract path parameter
  const productId = event.pathParameters?.productId;
  if (!productId) {
    return response(400, { status: 'error', message: '"productId" path parameter is required.' });
  }

  // 5. Parse optional body (explicit available value)
  let explicitValue = undefined;
  try {
    const body = JSON.parse(event.body || '{}');
    if (typeof body.available === 'boolean') {
      explicitValue = body.available;
    }
  } catch {
    // ignore parse errors — body is optional
  }

  try {
    // 6. Fetch current product to check ownership and get current available value
    const existing = await docClient.send(new GetCommand({
      TableName: TABLE_NAME,
      Key: { businessId, productId },
    }));

    if (!existing.Item) {
      return response(404, { status: 'error', message: `Product "${productId}" not found.` });
    }

    // 7. Determine new availability: explicit value OR toggle current
    const currentAvailable = existing.Item.available ?? true;
    const newAvailable     = explicitValue !== undefined ? explicitValue : !currentAvailable;
    const now              = new Date().toISOString();

    // 8. Update only the `available` and `updatedAt` fields
    await docClient.send(new UpdateCommand({
      TableName:                 TABLE_NAME,
      Key:                       { businessId, productId },
      UpdateExpression:          'SET #available = :available, #updatedAt = :updatedAt',
      ExpressionAttributeNames:  { '#available': 'available', '#updatedAt': 'updatedAt' },
      ExpressionAttributeValues: { ':available': newAvailable, ':updatedAt': now },
    }));

    console.log(`[Routvi] PATCH /menu/products/${productId}/availability → ${currentAvailable} → ${newAvailable}`);

    return response(200, {
      status: 'success',
      message: `Product is now ${newAvailable ? 'available' : 'unavailable (sold out)'}.`,
      data: { productId, available: newAvailable, updatedAt: now },
    });

  } catch (err) {
    console.error('[Routvi] Error updating product availability:', err);
    return response(500, { status: 'error', message: 'Internal error updating product availability.' });
  }
};
