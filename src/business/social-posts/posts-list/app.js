/**
 * Routvi — Social Posts List Handler
 * GET /v1/social-posts
 *
 * Returns all social posts for the authenticated business.
 * Supports optional filter: ?platform=instagram|facebook|tiktok|x
 * Results sorted newest first (by publishedAt).
 */

const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, QueryCommand } = require('@aws-sdk/lib-dynamodb');

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

  const filterPlatform = event.queryStringParameters?.platform || null;

  try {
    const queryParams = {
      TableName:                 TABLE_NAME,
      KeyConditionExpression:    'businessId = :businessId',
      ExpressionAttributeValues: { ':businessId': businessId },
    };

    if (filterPlatform) {
      queryParams.FilterExpression          = '#platform = :platform';
      queryParams.ExpressionAttributeNames  = { '#platform': 'platform' };
      queryParams.ExpressionAttributeValues[':platform'] = filterPlatform;
    }

    const result = await docClient.send(new QueryCommand(queryParams));

    // Sort newest first by publishedAt
    const posts = (result.Items || []).sort(
      (a, b) => new Date(b.publishedAt) - new Date(a.publishedAt)
    );

    console.log(`[Routvi] GET /social-posts → businessId: ${businessId}, filter: ${filterPlatform || 'none'}, count: ${posts.length}`);

    return response(200, {
      status: 'success',
      data:   posts,
      count:  posts.length,
      filter: filterPlatform ? { platform: filterPlatform } : null,
    });

  } catch (err) {
    console.error('[Routvi] Error listing social posts:', err);
    return response(500, { status: 'error', message: 'Internal error retrieving posts.' });
  }
};
