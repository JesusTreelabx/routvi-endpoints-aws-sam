/**
 * Routvi — Save Promotion to Favorites
 * POST /v1/favorites/promotions/{promoId}
 *
 * Saves a promotion to the authenticated user's favorites list.
 * Protected by Cognito Authorizer — only 'comensal' (or any authenticated) role.
 */

const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, PutCommand } = require('@aws-sdk/lib-dynamodb');

const ALLOWED_METHOD   = 'POST';
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
    const now = new Date().toISOString();

    // 4. Save to Favorites table
    // Key: userId (PK) + promoId (SK) — this prevents duplicate favorites naturally
    await docClient.send(new PutCommand({
      TableName: FAVORITES_TABLE,
      Item: {
        userId,
        favoriteId:  promoId,   // SK: the ID of the favorited item
        itemType:    'promotion',
        savedAt:     now
      },
      // Silently overwrite if already saved (idempotent)
      //ConditionExpression: 'attribute_not_exists(favoriteId)'
    }));

    console.log(`[Routvi] POST /favorites/promotions/${promoId} → userId: ${userId}`);

    return response(201, {
      status: 'success',
      message: 'Promotion saved to favorites.',
      data: { userId, promoId, savedAt: now }
    });

  } catch (err) {
    console.error('[Routvi] Error saving favorite:', err);
    return response(500, { status: 'error', message: 'Internal error saving favorite.' });
  }
};
