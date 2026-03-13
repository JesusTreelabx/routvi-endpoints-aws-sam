/**
 * Routvi — Menu Product Delete Handler
 * DELETE /v1/menu/products/{productId}
 *
 * Deletes a product from DynamoDB.
 * Verifies the product belongs to the authenticated business before deleting.
 */

const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, DeleteCommand, GetCommand } = require('@aws-sdk/lib-dynamodb');

// ── Constants ─────────────────────────────────────────────────────────
const ALLOWED_METHOD = 'DELETE';
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
    return response(405, { status: 'error', message: `Method ${method} not allowed. Use DELETE.` });
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
    return response(403, { status: 'error', message: 'Access denied. Only business accounts can delete menu products.' });
  }

  // 4. Extract path parameter
  const productId = event.pathParameters?.productId;
  if (!productId) {
    return response(400, { status: 'error', message: '"productId" path parameter is required.' });
  }

  try {
    // 5. Verify product exists and belongs to this business
    const existing = await docClient.send(new GetCommand({
      TableName: TABLE_NAME,
      Key: { businessId, productId },
    }));

    if (!existing.Item) {
      return response(404, { status: 'error', message: `Product "${productId}" not found.` });
    }

    // 6. Delete the product from DynamoDB
    await docClient.send(new DeleteCommand({
      TableName: TABLE_NAME,
      Key: { businessId, productId },
    }));

    console.log(`[Routvi] DELETE /menu/products/${productId} → businessId: ${businessId}`);

    return response(200, {
      status: 'success',
      message: 'Product deleted successfully.',
      data: { productId },
    });

  } catch (err) {
    console.error('[Routvi] Error deleting product:', err);
    return response(500, { status: 'error', message: 'Internal error deleting the product.' });
  }
};
