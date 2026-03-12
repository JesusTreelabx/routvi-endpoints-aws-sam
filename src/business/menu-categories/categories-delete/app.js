/**
 * Routvi — Menu Category Delete Handler
 * DELETE /v1/menu/categories/{categoryId}
 *
 * Deletes a category from DynamoDB.
 * Verifies the category belongs to the authenticated business before deleting.
 */

const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, DeleteCommand, GetCommand } = require('@aws-sdk/lib-dynamodb');

// ── Constants ─────────────────────────────────────────────────────────
const ALLOWED_METHOD = 'DELETE';
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
    return response(403, { status: 'error', message: 'Access denied. Only business accounts can delete menu categories.' });
  }

  // 4. Extract path parameter
  const categoryId = event.pathParameters?.categoryId;
  if (!categoryId) {
    return response(400, { status: 'error', message: '"categoryId" path parameter is required.' });
  }

  try {
    // 5. Verify the category exists and belongs to this business
    const existing = await docClient.send(new GetCommand({
      TableName: TABLE_NAME,
      Key: { businessId, categoryId },
    }));

    if (!existing.Item) {
      return response(404, { status: 'error', message: `Category "${categoryId}" not found.` });
    }

    // 6. Delete the category from DynamoDB
    await docClient.send(new DeleteCommand({
      TableName: TABLE_NAME,
      Key: { businessId, categoryId },
    }));

    console.log(`[Routvi] DELETE /menu/categories/${categoryId} → businessId: ${businessId}`);

    return response(200, {
      status: 'success',
      message: 'Category deleted successfully.',
      data: { categoryId },
    });

  } catch (err) {
    console.error('[Routvi] Error deleting category:', err);
    return response(500, { status: 'error', message: 'Internal error deleting the category.' });
  }
};
