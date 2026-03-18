/**
 * Routvi — Public Businesses Search Handler
 * GET /v1/businesses
 *
 * Search and listing of active businesses for the diner app map/search view.
 * No authentication required — fully public endpoint.
 *
 * Query params (all optional):
 *   ?search=tacos           ← searches in name and description
 *   ?city=Guadalajara
 *   ?state=Jalisco
 *   ?category=mariscos
 *   ?limit=20
 */

const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, ScanCommand } = require('@aws-sdk/lib-dynamodb');

const ALLOWED_METHOD = 'GET';
const TABLE_NAME     = process.env.BUSINESS_PROFILES_TABLE;
const AWS_REGION     = process.env.AWS_REGION || 'us-east-1';
const DEFAULT_LIMIT  = 20;
const MAX_LIMIT      = 100;

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

  const q        = event.queryStringParameters || {};
  const search   = q.search?.toLowerCase()  || null;
  const city     = q.city                   || null;
  const state    = q.state                  || null;
  const category = q.category               || null;
  const limit    = Math.min(parseInt(q.limit) || DEFAULT_LIMIT, MAX_LIMIT);

  try {
    const filterParts  = ['#isActive = :true'];
    const attrNames    = { '#isActive': 'isActive' };
    const attrValues   = { ':true': true };

    if (city) {
      filterParts.push('contains(#city, :city)');
      attrNames['#city']  = 'city';
      attrValues[':city'] = city;
    }
    if (state) {
      filterParts.push('contains(#state, :state)');
      attrNames['#state']  = 'state';
      attrValues[':state'] = state;
    }
    if (category) {
      filterParts.push('contains(#category, :category)');
      attrNames['#category']  = 'category';
      attrValues[':category'] = category;
    }

    const result = await docClient.send(new ScanCommand({
      TableName:                 TABLE_NAME,
      FilterExpression:          filterParts.join(' AND '),
      ExpressionAttributeNames:  attrNames,
      ExpressionAttributeValues: attrValues,
    }));

    let businesses = (result.Items || []).map(b => ({
      businessId:  b.userId,
      slug:        b.slug         || '',
      name:        b.businessName || b.name || '',
      description: b.description  || '',
      category:    b.category     || '',
      city:        b.city         || '',
      state:       b.state        || '',
      logoUrl:     b.logoUrl      || '',
      bannerUrl:   b.bannerUrl    || '',
      isActive:    b.isActive     ?? true,
    }));

    // In-memory text search on name + description
    if (search) {
      businesses = businesses.filter(b =>
        b.name.toLowerCase().includes(search) ||
        b.description.toLowerCase().includes(search)
      );
    }

    businesses = businesses.slice(0, limit);

    console.log(`[Routvi] GET /businesses → search: ${search || 'none'}, count: ${businesses.length}`);

    return response(200, { status: 'success', data: businesses, count: businesses.length });

  } catch (err) {
    console.error('[Routvi] Error listing businesses:', err);
    return response(500, { status: 'error', message: 'Internal error listing businesses.' });
  }
};
