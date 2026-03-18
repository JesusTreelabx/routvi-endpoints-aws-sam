/**
 * Routvi — Remove Promotion from Favorites
 * DELETE /v1/favorites/promotions/{promoId}
 *
 * Removes a promotion from the authenticated user's favorites list.
 * Protected by Cognito Authorizer.
 */

const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, DeleteCommand, GetCommand } = require('@aws-sdk/lib-dynamodb');

const ALLOWED_METHOD   = 'DELETE';
const FAVORITES_TABLE  = process.env.FAVORITES_TABLE;
const AWS_REGION       = process.env.AWS_REGION || 'us-east-1';

const dynamoClient = new DynamoDBClient({ region: AWS_REGION });
const docClient    = DynamoDBDocumentClient.from(dynamoClient);

const headers = { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' };

function response(statusCode, body) {
  return { statusCode, headers, body: JSON.stringify(body) };
}

exports.handler = async (event) => {

  // 1. Validate HTTP method
  const method = event.httpMethod || event.requestContext?.http?.method;
  if (method !== ALLOWED_METHOD) {
    return response(405, { status: 'error', message: `Method ${method} not allowed.` });
  }

  // 2. Read authenticated user from Cognito
  const claims = event.requestContext?.authorizer?.claims;
  if (!claims) {
    return response(401, { status: 'error', message: 'Unauthorized. No valid token provided.' });
  }
  const userId = claims['sub'];

  // 3. Read promoId from path
  const promoId = event.pathParameters?.promoId;
  if (!promoId) {
    return response(400, { status: 'error', message: '"promoId" path parameter is required.' });
  }

  try {
    // 4. Verify the favorite exists before deleting
    const existing = await docClient.send(new GetCommand({
      TableName: FAVORITES_TABLE,
      Key: { userId, favoriteId: promoId }
    }));

    if (!existing.Item) {
      return response(404, { status: 'error', message: 'Favorite not found.' });
    }

    // 5. Delete the favorite
    await docClient.send(new DeleteCommand({
      TableName: FAVORITES_TABLE,
      Key: { userId, favoriteId: promoId }
    }));

    console.log(`[Routvi] DELETE /favorites/promotions/${promoId} → userId: ${userId}`);

    return response(200, {
      status: 'success',
      message: 'Promotion removed from favorites.'
    });

  } catch (err) {
    console.error('[Routvi] Error removing favorite:', err);
    return response(500, { status: 'error', message: 'Internal error removing favorite.' });
  }
};
