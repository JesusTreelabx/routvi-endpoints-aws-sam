/**
 * Routvi — Public Business Posts Handler
 * GET /v1/businesses/{businessId}/posts
 *
 * Returns all active social history/posts for a given business.
 * Fully public endpoint (No Auth).
 */

const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, QueryCommand } = require('@aws-sdk/lib-dynamodb');

const ALLOWED_METHOD = 'GET';
const SOCIAL_POSTS_TABLE = process.env.SOCIAL_POSTS_TABLE;
const AWS_REGION       = process.env.AWS_REGION || 'us-east-1';

const dynamoClient = new DynamoDBClient({ region: AWS_REGION });
const docClient    = DynamoDBDocumentClient.from(dynamoClient);

const headers = { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' };

function response(statusCode, body) {
  return { statusCode, headers, body: JSON.stringify(body) };
}

exports.handler = async (event) => {

  const method = event.httpMethod || event.requestContext?.http?.method;
  if (method !== ALLOWED_METHOD) {
    return response(405, { status: 'error', message: `Method ${method} not allowed.` });
  }

  const businessId = event.pathParameters?.businessId;
  if (!businessId) {
    return response(400, { status: 'error', message: '"businessId" is required.' });
  }

  try {
    // 1. Fetch Social Posts
    const result = await docClient.send(new QueryCommand({
      TableName: SOCIAL_POSTS_TABLE,
      KeyConditionExpression: '#biz = :biz',
      ExpressionAttributeNames: { '#biz': 'businessId' },
      ExpressionAttributeValues: { ':biz': businessId },
    }));
    
    // Sort by publishedAt descending (newest first)
    const posts = (result.Items || [])
      .sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt))
      .map(p => ({
        postId:      p.postId,
        platform:    p.platform || 'instagram',
        content:     p.content || '',
        mediaUrl:    p.mediaUrl || null,
        mediaType:   p.mediaType || 'image',
        publishedAt: p.publishedAt
      }));

    console.log(`[Routvi] GET /businesses/${businessId}/posts → Count: ${posts.length}`);

    return response(200, { status: 'success', data: posts });

  } catch (err) {
    console.error('[Routvi] Error fetching social posts:', err);
    return response(500, { status: 'error', message: 'Internal error fetching posts.' });
  }
};
