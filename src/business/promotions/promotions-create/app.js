/**
 * Routvi — Promotion Create Handler
 * POST /v1/promotions
 *
 * Creates a new promotion for the authenticated business.
 * Supports percentage and fixed-amount discounts with optional date range.
 *
 * Request body:
 *   {
 *     "title": "2x1 en Tacos",
 *     "description": "Promo de martes",
 *     "discountType": "percentage",   ← "percentage" | "fixed"
 *     "discountValue": 20,            ← 20% off | $20 MXN off
 *     "startDate": "2026-03-15",      ← optional
 *     "endDate": "2026-03-22",        ← optional
 *     "imageUrl": "userId/gallery/banner.jpg",  ← optional S3 key
 *     "active": true                  ← optional, default true
 *   }
 */

const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, PutCommand } = require('@aws-sdk/lib-dynamodb');
const Joi = require('joi');

// ── Constants ─────────────────────────────────────────────────────────
const ALLOWED_METHOD = 'POST';
const TABLE_NAME     = process.env.PROMOTIONS_TABLE;
const AWS_REGION     = process.env.AWS_REGION || 'us-east-1';

const dynamoClient = new DynamoDBClient({ region: AWS_REGION });
const docClient    = DynamoDBDocumentClient.from(dynamoClient);

const headers = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
};

function response(statusCode, body) {
  return { statusCode, headers, body: JSON.stringify(body) };
}

function generateId() {
  return `promo_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

// ── Validation schema ─────────────────────────────────────────────────
const schema = Joi.object({
  title:         Joi.string().min(1).max(120).required().messages({
    'any.required': '"title" is required.',
    'string.empty': '"title" cannot be empty.',
  }),
  description:   Joi.string().max(500).optional().allow(''),
  discountType:  Joi.string().valid('percentage', 'fixed').required().messages({
    'any.required': '"discountType" is required.',
    'any.only':     '"discountType" must be "percentage" or "fixed".',
  }),
  discountValue: Joi.number().min(0).required().messages({
    'any.required': '"discountValue" is required.',
    'number.min':   '"discountValue" must be 0 or greater.',
  }),
  startDate:     Joi.string().isoDate().optional().allow('', null),
  endDate:       Joi.string().isoDate().optional().allow('', null),
  imageUrl:      Joi.string().optional().allow(''),
  active:        Joi.boolean().optional().default(true),
});

// ── Handler ──────────────────────────────────────────────────────────
exports.handler = async (event) => {

  // 1. Validate HTTP method
  const method = event.httpMethod || event.requestContext?.http?.method;
  if (method !== ALLOWED_METHOD) {
    return response(405, { status: 'error', message: `Method ${method} not allowed. Use POST.` });
  }

  // 2. Read claims from Cognito Authorizer
  const claims = event.requestContext?.authorizer?.claims;
  if (!claims) {
    return response(401, { status: 'error', message: 'Unauthorized. No valid token provided.' });
  }

  const businessId = claims['sub'];
  const rol        = claims['custom:rol'];

  // 3. Role check
  if (rol !== 'negocio') {
    return response(403, { status: 'error', message: 'Access denied. Only business accounts can create promotions.' });
  }

  // 4. Parse and validate body
  let body;
  try {
    body = JSON.parse(event.body || '{}');
  } catch {
    return response(400, { status: 'error', message: 'Request body is not valid JSON.' });
  }

  const { error, value } = schema.validate(body, { abortEarly: false, stripUnknown: true });
  if (error) {
    return response(400, {
      status: 'error',
      message: error.details.map(d => d.message).join(' | '),
    });
  }

  // 5. Build promotion item
  const now         = new Date().toISOString();
  const promotionId = generateId();

  const item = {
    businessId,
    promotionId,
    title:         value.title,
    description:   value.description  || '',
    discountType:  value.discountType,
    discountValue: value.discountValue,
    startDate:     value.startDate    || null,
    endDate:       value.endDate      || null,
    imageUrl:      value.imageUrl     || '',
    active:        value.active ?? true,
    createdAt:     now,
    updatedAt:     now,
  };

  // 6. Save to DynamoDB
  try {
    await docClient.send(new PutCommand({
      TableName: TABLE_NAME,
      Item:      item,
    }));

    console.log(`[Routvi] POST /promotions → businessId: ${businessId}, promotionId: ${promotionId}`);

    return response(201, {
      status: 'success',
      message: 'Promotion created successfully.',
      data: item,
    });

  } catch (err) {
    console.error('[Routvi] Error creating promotion:', err);
    return response(500, { status: 'error', message: 'Internal error creating the promotion.' });
  }
};
