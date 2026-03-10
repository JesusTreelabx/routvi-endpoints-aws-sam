/**
 * Routvi — Menu Categories List Handler
 * GET /v1/menu/categories
 *
 * Returns all menu categories for the authenticated business,
 * sorted by the 'order' field for frontend drag & drop display.
 */

const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, QueryCommand } = require('@aws-sdk/lib-dynamodb');

// ── Constants ─────────────────────────────────────────────────────────
const ALLOWED_METHOD = 'GET';
const TABLE_NAME     = process.env.MENU_CATEGORIES_TABLE;
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

  // 3. Only 'negocio' role can list their menu categories
  if (rol !== 'negocio') {
    return response(403, { status: 'error', message: 'Access denied. Only business accounts can view menu categories.' });
  }

  // 4. Query all categories for this business
  try {
    const result = await docClient.send(new QueryCommand({
      TableName:                 TABLE_NAME,
      KeyConditionExpression:    'businessId = :businessId',
      ExpressionAttributeValues: { ':businessId': businessId },
    }));

    // Sort by 'order' field for correct drag & drop display
    const categories = (result.Items || []).sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

    console.log(`[Routvi] GET /menu/categories → businessId: ${businessId}, count: ${categories.length}`);

    return response(200, {
      status: 'success',
      data:   categories,
      count:  categories.length,
    });

  } catch (err) {
    console.error('[Routvi] Error listing menu categories:', err);
    return response(500, { status: 'error', message: 'Internal error retrieving categories.' });
  }
};
