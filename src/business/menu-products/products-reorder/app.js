/**
 * Routvi — Menu Products Reorder Handler
 * PUT /v1/menu/products/reorder
 *
 * Updates the `order` field for multiple products at once.
 * Called after a drag & drop action in the frontend.
 *
 * Request body:
 *   {
 *     "items": [
 *       { "productId": "prod_xxx", "order": 0 },
 *       { "productId": "prod_yyy", "order": 1 },
 *       { "productId": "prod_zzz", "order": 2 }
 *     ]
 *   }
 */

const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, TransactWriteCommand } = require('@aws-sdk/lib-dynamodb');

// ── Constants ─────────────────────────────────────────────────────────
const ALLOWED_METHOD = 'PUT';
const TABLE_NAME     = process.env.MENU_PRODUCTS_TABLE;
const AWS_REGION     = process.env.AWS_REGION || 'us-east-1';
const MAX_ITEMS      = 25; // DynamoDB TransactWrite limit

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
    return response(405, { status: 'error', message: `Method ${method} not allowed. Use PUT.` });
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
    return response(403, { status: 'error', message: 'Access denied. Only business accounts can reorder products.' });
  }

  // 4. Parse and validate body
  let body;
  try {
    body = JSON.parse(event.body || '{}');
  } catch {
    return response(400, { status: 'error', message: 'Request body is not valid JSON.' });
  }

  const { items } = body;

  if (!Array.isArray(items) || items.length === 0) {
    return response(400, { status: 'error', message: '"items" must be a non-empty array of { productId, order }.' });
  }

  if (items.length > MAX_ITEMS) {
    return response(400, { status: 'error', message: `Maximum ${MAX_ITEMS} items can be reordered at once.` });
  }

  // Validate each item
  for (const item of items) {
    if (!item.productId || typeof item.order !== 'number') {
      return response(400, { status: 'error', message: 'Each item must have "productId" (string) and "order" (number).' });
    }
  }

  // 5. Build TransactWrite — updates all items atomically
  const now = new Date().toISOString();

  const transactItems = items.map(({ productId, order }) => ({
    Update: {
      TableName:                 TABLE_NAME,
      Key:                       { businessId, productId },
      UpdateExpression:          'SET #order = :order, #updatedAt = :updatedAt',
      ExpressionAttributeNames:  { '#order': 'order', '#updatedAt': 'updatedAt' },
      ExpressionAttributeValues: { ':order': order, ':updatedAt': now },
      // Ensure the product belongs to this business before updating
      ConditionExpression:       'attribute_exists(productId)',
    },
  }));

  try {
    await docClient.send(new TransactWriteCommand({ TransactItems: transactItems }));

    console.log(`[Routvi] PUT /menu/products/reorder → businessId: ${businessId}, items: ${items.length}`);

    return response(200, {
      status: 'success',
      message: `${items.length} product(s) reordered successfully.`,
      data: { reorderedCount: items.length },
    });

  } catch (err) {
    // TransactionCanceledException means one product was not found
    if (err.name === 'TransactionCanceledException') {
      return response(404, { status: 'error', message: 'One or more products were not found. Reorder cancelled.' });
    }
    console.error('[Routvi] Error reordering products:', err);
    return response(500, { status: 'error', message: 'Internal error reordering products.' });
  }
};
