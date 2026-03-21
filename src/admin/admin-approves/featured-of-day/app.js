/**
 * Routvi Admin — Assign Featured Business of the Day
 * POST /v1/admin/featured-of-day
 *
 * Assigns a business as the "Featured of the Day" for a specific city.
 * This business will appear at the top of the home feed for that city on that date.
 * (Ref: Section 14.1 F)
 *
 * Protected: Only staff with rol 'admin' can access this endpoint.
 */

const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const {
  DynamoDBDocumentClient,
  PutCommand,
  GetCommand
} = require('@aws-sdk/lib-dynamodb');
const Joi = require('joi');

const ALLOWED_METHOD   = 'POST';
const FEATURED_TABLE   = process.env.FEATURED_TABLE;
const BUSINESS_TABLE   = process.env.BUSINESS_PROFILES_TABLE;
const AWS_REGION       = process.env.AWS_REGION || 'us-east-1';

const dynamoClient = new DynamoDBClient({ region: AWS_REGION });
const docClient    = DynamoDBDocumentClient.from(dynamoClient);

const headers = { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' };

function response(statusCode, body) {
  return { statusCode, headers, body: JSON.stringify(body) };
}

const featuredSchema = Joi.object({
  businessId: Joi.string().required(),
  city:       Joi.string().required(),      // e.g. "Zacatecas"
  state:      Joi.string().required(),      // e.g. "Zacatecas"
  date:       Joi.string().pattern(/^\d{4}-\d{2}-\d{2}$/).required()  // YYYY-MM-DD
});

exports.handler = async (event) => {

  const method = event.httpMethod || event.requestContext?.http?.method;
  if (method !== ALLOWED_METHOD) {
    return response(405, { status: 'error', message: `Method ${method} not allowed.` });
  }

  const claims = event.requestContext?.authorizer?.claims;
  if (!claims) {
    return response(401, { status: 'error', message: 'Unauthorized.' });
  }
  if (claims['custom:rol'] !== 'admin') {
    return response(403, { status: 'error', message: 'Access denied. Admin role required.' });
  }

  let bodyData;
  try {
    bodyData = JSON.parse(event.body || '{}');
  } catch {
    return response(400, { status: 'error', message: 'Request body is not valid JSON.' });
  }

  const { error, value } = featuredSchema.validate(bodyData, { abortEarly: false, stripUnknown: true });
  if (error) {
    return response(400, { status: 'error', message: error.details.map(d => d.message).join(' | ') });
  }

  try {
    const { businessId, city, state, date } = value;
    const now = new Date().toISOString();

    // 1. Verify the business actually exists (BusinessProfilesTable PK = userId)
    const bizResult = await docClient.send(new GetCommand({
      TableName: BUSINESS_TABLE,
      Key: { userId: businessId }   // businessId enviado = userId (Cognito sub) del dueño
    }));

    if (!bizResult.Item) {
      return response(404, { status: 'error', message: `Business with id "${businessId}" not found.` });
    }

    // 2. Save the featured record
    // Key: city#date — one featured business per city per day
    const featuredKey = `${city.toLowerCase()}#${date}`;

    const featuredItem = {
      featuredKey,        // PK: city#date
      businessId,
      city,
      state,
      date,
      assignedBy:  claims['sub'],
      assignedAt:  now,
      businessName: bizResult.Item.name || null
    };

    await docClient.send(new PutCommand({
      TableName: FEATURED_TABLE,
      Item: featuredItem
    }));

    console.log(`[Routvi Admin] POST /admin/featured-of-day → ${city} on ${date}: ${businessId}`);

    return response(200, {
      status:  'success',
      message: `Business "${bizResult.Item.name}" is now the Featured of the Day in ${city} on ${date}.`,
      data:    featuredItem
    });

  } catch (err) {
    console.error('[Routvi Admin] Error setting featured business:', err);
    return response(500, { status: 'error', message: 'Internal error setting featured business.' });
  }
};
