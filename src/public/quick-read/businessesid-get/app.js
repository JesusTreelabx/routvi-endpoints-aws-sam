/**
 * Routvi — Public Business Profile Get by Slug Handler
 * GET /v1/businesses/{slug}
 *
 * Returns the public profile of a business by its slug.
 * Uses the slug-index GSI on BusinessProfiles table.
 * No authentication required — fully public endpoint.
 */

const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, QueryCommand } = require('@aws-sdk/lib-dynamodb');

const ALLOWED_METHOD = 'GET';
const TABLE_NAME     = process.env.BUSINESS_PROFILES_TABLE;
const SLUG_INDEX     = 'slug-index';
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
    return response(405, { status: 'error', message: `Method ${method} not allowed.` });
  }

  const slug = event.pathParameters?.businessId;
  if (!slug) {
    return response(400, { status: 'error', message: '"businessId" path parameter is required as slug.' });
  }

  try {
    // Query using the slug-index GSI
    const result = await docClient.send(new QueryCommand({
      TableName:                 TABLE_NAME,
      IndexName:                 SLUG_INDEX,
      KeyConditionExpression:    '#slug = :slug',
      ExpressionAttributeNames:  { '#slug': 'slug' },
      ExpressionAttributeValues: { ':slug': slug },
      Limit:                     1,
    }));

    const business = result.Items?.[0];

    if (!business) {
      return response(404, { status: 'error', message: `Business "${slug}" not found.` });
    }

    // Return only public-safe fields
    const publicProfile = {
      businessId:   business.userId,
      slug:         business.slug          || '',
      name:         business.businessName  || business.name || '',
      description:  business.description   || '',
      category:     business.category      || '',
      city:         business.city          || '',
      state:        business.state         || '',
      address:      business.address       || '',
      phone:        business.phone         || '',
      logoUrl:      business.logoUrl       || '',
      bannerUrl:    business.bannerUrl     || '',
      openingHours: business.openingHours  || null,
      socialLinks:  business.socialLinks   || {},
      dailySpecial: business.dailySpecial  || null,
      isActive:     business.isActive      ?? true,
    };

    console.log(`[Routvi] GET /businesses/${slug} → businessId: ${business.userId}`);

    return response(200, { status: 'success', data: publicProfile });

  } catch (err) {
    console.error('[Routvi] Error fetching business profile:', err);
    return response(500, { status: 'error', message: 'Internal error fetching business profile.' });
  }
};
