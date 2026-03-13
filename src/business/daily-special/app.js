/**
 * Routvi — Daily Special Set Handler
 * POST /v1/daily-special/set
 *
 * Assigns a product as the "daily special" for the business.
 * Reads the product details from MenuProducts table, creates a snapshot,
 * and stores it in the BusinessProfiles table under `dailySpecial`.
 *
 * Request body:
 *   { "productId": "prod_xxx" }
 *
 * The snapshot stored includes: productId, name, description, price, imageUrl, setAt
 */

const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, GetCommand, UpdateCommand } = require('@aws-sdk/lib-dynamodb');

// ── Constants ─────────────────────────────────────────────────────────
const ALLOWED_METHOD          = 'POST';
const PRODUCTS_TABLE          = process.env.MENU_PRODUCTS_TABLE;
const BUSINESS_PROFILES_TABLE = process.env.BUSINESS_PROFILES_TABLE;
const AWS_REGION              = process.env.AWS_REGION || 'us-east-1';

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
    return response(405, { status: 'error', message: `Method ${method} not allowed. Use POST.` });
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
    return response(403, { status: 'error', message: 'Access denied. Only business accounts can set the daily special.' });
  }

  // 4. Parse body
  let body;
  try {
    body = JSON.parse(event.body || '{}');
  } catch {
    return response(400, { status: 'error', message: 'Request body is not valid JSON.' });
  }

  const { productId } = body;
  if (!productId || typeof productId !== 'string') {
    return response(400, { status: 'error', message: '"productId" is required.' });
  }

  try {
    // 5. Fetch the product to build the snapshot
    const productResult = await docClient.send(new GetCommand({
      TableName: PRODUCTS_TABLE,
      Key: { businessId, productId },
    }));

    if (!productResult.Item) {
      return response(404, { status: 'error', message: `Product "${productId}" not found.` });
    }

    const product = productResult.Item;

    // 6. Build snapshot (only the fields the SSG/frontend needs)
    const now     = new Date().toISOString();
    const snapshot = {
      productId:   product.productId,
      name:        product.name,
      description: product.description || '',
      price:       product.price,
      imageUrl:    product.imageUrl || '',
      available:   product.available ?? true,
      setAt:       now,
    };

    // 7. Store snapshot in BusinessProfiles under `dailySpecial`
    await docClient.send(new UpdateCommand({
      TableName:                 BUSINESS_PROFILES_TABLE,
      Key:                       { userId: businessId },
      UpdateExpression:          'SET #dailySpecial = :snapshot, #updatedAt = :updatedAt',
      ExpressionAttributeNames:  {
        '#dailySpecial': 'dailySpecial',
        '#updatedAt':    'updatedAt',
      },
      ExpressionAttributeValues: {
        ':snapshot':  snapshot,
        ':updatedAt': now,
      },
    }));

    console.log(`[Routvi] POST /daily-special/set → businessId: ${businessId}, productId: ${productId}`);

    return response(200, {
      status: 'success',
      message: 'Daily special set successfully.',
      data: { dailySpecial: snapshot },
    });

  } catch (err) {
    console.error('[Routvi] Error setting daily special:', err);
    return response(500, { status: 'error', message: 'Internal error setting the daily special.' });
  }
};
