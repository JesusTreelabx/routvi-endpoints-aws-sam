/**
 * Routvi — Public Business Promotions Handler
 * GET /v1/businesses/{businessId}/promotions
 *
 * Returns all active promotions for a given business.
 * Fully public endpoint (No Auth).
 */

const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, QueryCommand } = require('@aws-sdk/lib-dynamodb');

const ALLOWED_METHOD = 'GET';
const PROMOTIONS_TABLE = process.env.PROMOTIONS_TABLE;
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
    // 1. Fetch Promotions (Filtering only active ones for the public endpoint)
    const result = await docClient.send(new QueryCommand({
      TableName: PROMOTIONS_TABLE,
      KeyConditionExpression: '#biz = :biz',
      FilterExpression: '#active = :true',
      ExpressionAttributeNames: { '#biz': 'businessId', '#active': 'active' },
      ExpressionAttributeValues: { ':biz': businessId, ':true': true },
    }));
    
    // Sort by createdAt descending (newest first)
    const promotions = (result.Items || [])
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .map(p => ({
        promotionId: p.promotionId,
        title:       p.title,
        description: p.description || '',
        imageUrl:    p.imageUrl || null,
        type:        p.type || 'direct_discount',
        discountAmt: p.discountAmt || 0,
        validUntil:  p.validUntil || null,
        terms:       p.terms || '',
        createdAt:   p.createdAt
      }));

    console.log(`[Routvi] GET /businesses/${businessId}/promotions → Count: ${promotions.length}`);

    return response(200, { status: 'success', data: promotions });

  } catch (err) {
    console.error('[Routvi] Error fetching promotions:', err);
    return response(500, { status: 'error', message: 'Internal error fetching promotions.' });
  }
};
