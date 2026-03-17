/**
 * Routvi — Social Post Create Handler
 * POST /v1/social-posts
 *
 * Saves a social media post record for the authenticated business.
 * Supports multiple platforms (instagram, facebook, tiktok, x/twitter).
 *
 * Request body:
 *   {
 *     "platform": "instagram",          ← required: instagram|facebook|tiktok|x
 *     "content": "Texto del post...",   ← optional caption/text
 *     "imageUrl": "userId/gallery/x",   ← optional S3 fileKey
 *     "externalUrl": "https://...",     ← optional link to the live post
 *     "publishedAt": "2026-03-17"       ← optional ISO date, defaults to now
 *   }
 */

const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, PutCommand } = require('@aws-sdk/lib-dynamodb');
const Joi = require('joi');

const ALLOWED_METHOD = 'POST';
const TABLE_NAME     = process.env.SOCIAL_POSTS_TABLE;
const AWS_REGION     = process.env.AWS_REGION || 'us-east-1';

const dynamoClient = new DynamoDBClient({ region: AWS_REGION });
const docClient    = DynamoDBDocumentClient.from(dynamoClient);

const headers = { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' };

function response(statusCode, body) {
  return { statusCode, headers, body: JSON.stringify(body) };
}

function generateId() {
  return `post_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

const schema = Joi.object({
  platform:    Joi.string().valid('instagram', 'facebook', 'tiktok', 'x').required().messages({
    'any.required': '"platform" is required.',
    'any.only':     '"platform" must be instagram, facebook, tiktok or x.',
  }),
  content:     Joi.string().max(2200).optional().allow(''),
  imageUrl:    Joi.string().optional().allow(''),
  externalUrl: Joi.string().uri().optional().allow(''),
  publishedAt: Joi.string().isoDate().optional().allow('', null),
});

exports.handler = async (event) => {

  const method = event.httpMethod || event.requestContext?.http?.method;
  if (method !== ALLOWED_METHOD) {
    return response(405, { status: 'error', message: `Method ${method} not allowed. Use POST.` });
  }

  const claims = event.requestContext?.authorizer?.claims;
  if (!claims) return response(401, { status: 'error', message: 'Unauthorized.' });

  const businessId = claims['sub'];
  if (claims['custom:rol'] !== 'negocio') {
    return response(403, { status: 'error', message: 'Access denied. Only business accounts can manage social posts.' });
  }

  let body;
  try { body = JSON.parse(event.body || '{}'); } catch {
    return response(400, { status: 'error', message: 'Request body is not valid JSON.' });
  }

  const { error, value } = schema.validate(body, { abortEarly: false, stripUnknown: true });
  if (error) {
    return response(400, { status: 'error', message: error.details.map(d => d.message).join(' | ') });
  }

  const now    = new Date().toISOString();
  const postId = generateId();

  const item = {
    businessId,
    postId,
    platform:    value.platform,
    content:     value.content     || '',
    imageUrl:    value.imageUrl    || '',
    externalUrl: value.externalUrl || '',
    publishedAt: value.publishedAt || now,
    createdAt:   now,
    updatedAt:   now,
  };

  try {
    await docClient.send(new PutCommand({ TableName: TABLE_NAME, Item: item }));
    console.log(`[Routvi] POST /social-posts → businessId: ${businessId}, postId: ${postId}`);
    return response(201, { status: 'success', message: 'Social post created successfully.', data: item });
  } catch (err) {
    console.error('[Routvi] Error creating social post:', err);
    return response(500, { status: 'error', message: 'Internal error creating the post.' });
  }
};
