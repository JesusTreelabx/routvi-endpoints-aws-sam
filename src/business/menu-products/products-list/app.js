/**
 * Routvi — Menu Products List Handler
 * GET /v1/menu/products
 *
 * Returns all products for the authenticated business.
 * Supports optional filtering by categoryId via query string:
 *   GET /v1/menu/products?categoryId=cat_xxx  → only that category
 *   GET /v1/menu/products                     → all products
 *
 * Results are sorted by 'order' field.
 */

const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, QueryCommand } = require('@aws-sdk/lib-dynamodb');

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
    return response(403, { status: 'error', message: 'Access denied. Only business accounts can view menu products.' });
  }

  // 4. Optional query string filter: ?categoryId=cat_xxx
  const filterCategoryId = event.queryStringParameters?.categoryId || null;

  try {
    // 5. Build query — always filter by businessId (PK)
    let queryParams = {
      TableName:                 TABLE_NAME,
      KeyConditionExpression:    'businessId = :businessId',
      ExpressionAttributeValues: { ':businessId': businessId },
    };

    // 6. Add categoryId filter if provided (uses FilterExpression, not KeyCondition)
    if (filterCategoryId) {
      queryParams.FilterExpression          = 'categoryId = :categoryId';
      queryParams.ExpressionAttributeValues[':categoryId'] = filterCategoryId;
    }

    const result = await docClient.send(new QueryCommand(queryParams));

    // Sort by 'order' field
    const products = (result.Items || []).sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

    console.log(`[Routvi] GET /menu/products → businessId: ${businessId}, filter: ${filterCategoryId || 'none'}, count: ${products.length}`);

    return response(200, {
      status: 'success',
      data:   products,
      count:  products.length,
      filter: filterCategoryId ? { categoryId: filterCategoryId } : null,
    });

  } catch (err) {
    console.error('[Routvi] Error listing products:', err);
    return response(500, { status: 'error', message: 'Internal error retrieving products.' });
  }
};
