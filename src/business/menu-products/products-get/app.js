/**
 * Routvi — Menu Product Get Handler
 * GET /v1/menu/products/{productId}
 *
 * Returns a single product by its productId.
 * Verifies the product belongs to the authenticated business.
 */

const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, GetCommand } = require('@aws-sdk/lib-dynamodb');

// ── Constants ─────────────────────────────────────────────────────────
const ALLOWED_METHOD = 'GET';
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
    return response(405, { status: 'error', message: `Method ${method} not allowed. Use GET.` });
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
    return response(403, { status: 'error', message: 'Access denied. Only business accounts can access menu products.' });
  }

  // 4. Extract path parameter
  const productId = event.pathParameters?.productId;
  if (!productId) {
    return response(400, { status: 'error', message: '"productId" path parameter is required.' });
  }

  // 5. Fetch product from DynamoDB
  try {
    const result = await docClient.send(new GetCommand({
      TableName: TABLE_NAME,
      Key: { businessId, productId },
    }));

    if (!result.Item) {
      return response(404, { status: 'error', message: `Product "${productId}" not found.` });
    }

    console.log(`[Routvi] GET /menu/products/${productId} → businessId: ${businessId}`);

    return response(200, {
      status: 'success',
      data: result.Item,
    });

  } catch (err) {
    console.error('[Routvi] Error fetching product:', err);
    return response(500, { status: 'error', message: 'Internal error retrieving the product.' });
  }
};
