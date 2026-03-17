/**
 * Routvi — Social Post Get Handler
 * GET /v1/social-posts/{postId}
 *
 * Returns a single social post by its postId.
 * Verifies the post belongs to the authenticated business.
 */

const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, GetCommand } = require('@aws-sdk/lib-dynamodb');

const ALLOWED_METHOD = 'GET';
const TABLE_NAME     = process.env.SOCIAL_POSTS_TABLE;
const AWS_REGION     = process.env.AWS_REGION || 'us-east-1';

const dynamoClient = new DynamoDBClient({ region: AWS_REGION });
const docClient    = DynamoDBDocumentClient.from(dynamoClient);

const headers = { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' };

function response(statusCode, body) {
  return { statusCode, headers, body: JSON.stringify(body) };
}

exports.handler = async (event) => {

  const method = event.httpMethod || event.requestContext?.http?.method;
  if (method !== ALLOWED_METHOD) {
    return response(405, { status: 'error', message: `Method ${method} not allowed. Use GET.` });
  }

  const claims = event.requestContext?.authorizer?.claims;
  if (!claims) return response(401, { status: 'error', message: 'Unauthorized.' });

  const businessId = claims['sub'];
  if (claims['custom:rol'] !== 'negocio') {
    return response(403, { status: 'error', message: 'Access denied. Only business accounts can view social posts.' });
  }

  const postId = event.pathParameters?.postId;
  if (!postId) {
    return response(400, { status: 'error', message: '"postId" path parameter is required.' });
  }

  try {
    const result = await docClient.send(new GetCommand({
      TableName: TABLE_NAME,
      Key: { businessId, postId },
    }));

    if (!result.Item) {
      return response(404, { status: 'error', message: `Post "${postId}" not found.` });
    }

    console.log(`[Routvi] GET /social-posts/${postId} → businessId: ${businessId}`);

    return response(200, { status: 'success', data: result.Item });

  } catch (err) {
    console.error('[Routvi] Error fetching social post:', err);
    return response(500, { status: 'error', message: 'Internal error retrieving the post.' });
  }
};
