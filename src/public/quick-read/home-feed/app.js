/**
 * Routvi — Public Home Feed Handler
 * GET /v1/home-feed
 *
 * Returns a feed of active businesses, optionally filtered by city or state.
 * Designed for the main landing page / map of the diner WebApp.
 *
 * Query params (all optional):
 *   ?city=Guadalajara
 *   ?state=Jalisco
 *   ?category=tacos
 *   ?lat=20.659698&lng=-103.349609   ← reserved for future geo-radius
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
  const city     = q.city     || null;
  const state    = q.state    || null;
  const category = q.category || null;
  const limit    = Math.min(parseInt(q.limit) || DEFAULT_LIMIT, MAX_LIMIT);

  try {
    // Build scan with optional filters
    const filterParts   = ['#isActive = :true'];
    const attrNames     = { '#isActive': 'isActive' };
    const attrValues    = { ':true': true };

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

    // Limit and shape the response — only public-safe fields
    const feed = (result.Items || [])
      .slice(0, limit)
      .map(b => ({
        businessId:  b.userId,
        slug:        b.slug        || '',
        name:        b.businessName || b.name || '',
        description: b.description  || '',
        category:    b.category     || '',
        city:        b.city         || '',
        state:       b.state        || '',
        logoUrl:     b.logoUrl      || '',
        bannerUrl:   b.bannerUrl    || '',
        dailySpecial: b.dailySpecial || null,
        isActive:    b.isActive     ?? true,
      }));

    console.log(`[Routvi] GET /home-feed → count: ${feed.length}, city: ${city || 'all'}`);

    return response(200, { status: 'success', data: feed, count: feed.length });

  } catch (err) {
    console.error('[Routvi] Error fetching home feed:', err);
    return response(500, { status: 'error', message: 'Internal error fetching home feed.' });
  }
};
