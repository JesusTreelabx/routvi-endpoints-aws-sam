/**
 * Routvi — Get User Favorites List
 * GET /v1/users/me/favorites
 *
 * Returns all favorites saved by the authenticated user.
 * Protected by Cognito Authorizer.
 */

const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, QueryCommand } = require('@aws-sdk/lib-dynamodb');

const ALLOWED_METHOD   = 'GET';
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

  try {
    // 3. Optional query param: filter by type (e.g. ?type=promotion)
    const filterType = event.queryStringParameters?.type;

    let queryParams = {
      TableName: FAVORITES_TABLE,
      KeyConditionExpression: '#uid = :uid',
      ExpressionAttributeNames: { '#uid': 'userId' },
      ExpressionAttributeValues: { ':uid': userId },
    };

    // If filter is provided, add it
    if (filterType) {
      queryParams.FilterExpression = '#itemType = :itemType';
      queryParams.ExpressionAttributeNames['#itemType'] = 'itemType';
      queryParams.ExpressionAttributeValues[':itemType'] = filterType;
    }

    const result = await docClient.send(new QueryCommand(queryParams));

    // Sort by savedAt descending (most recently saved first)
    const favorites = (result.Items || [])
      .sort((a, b) => new Date(b.savedAt) - new Date(a.savedAt));

    console.log(`[Routvi] GET /users/me/favorites → userId: ${userId}, count: ${favorites.length}`);

    return response(200, {
      status: 'success',
      data: favorites,
      count: favorites.length
    });

  } catch (err) {
    console.error('[Routvi] Error fetching favorites:', err);
    return response(500, { status: 'error', message: 'Internal error fetching favorites.' });
  }
};
