/**
 * Routvi — Promotion Update Handler
 * PUT /v1/promotions/{promoId}
 *
 * Partial update of a promotion. Accepts any combination of:
 * title, description, discountType, discountValue, startDate,
 * endDate, imageUrl, active.
 *
 * Verifies the promotion belongs to the authenticated business before updating.
 */

const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, GetCommand, UpdateCommand } = require('@aws-sdk/lib-dynamodb');
const Joi = require('joi');

// ── Constants ─────────────────────────────────────────────────────────
const ALLOWED_METHOD = 'PUT';
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

// ── Validation schema ─────────────────────────────────────────────────
const schema = Joi.object({
  title:         Joi.string().min(1).max(120).optional(),
  description:   Joi.string().max(500).optional().allow(''),
  discountType:  Joi.string().valid('percentage', 'fixed').optional(),
  discountValue: Joi.number().min(0).optional(),
  startDate:     Joi.string().isoDate().optional().allow('', null),
  endDate:       Joi.string().isoDate().optional().allow('', null),
  imageUrl:      Joi.string().optional().allow(''),
  active:        Joi.boolean().optional(),
}).min(1).messages({
  'object.min': 'At least one field must be provided to update.',
});

// ── Handler ──────────────────────────────────────────────────────────
exports.handler = async (event) => {

  const method = event.httpMethod || event.requestContext?.http?.method;
  if (method !== ALLOWED_METHOD) {
    return response(405, { status: 'error', message: `Method ${method} not allowed. Use PUT.` });
  }

  const claims = event.requestContext?.authorizer?.claims;
  if (!claims) {
    return response(401, { status: 'error', message: 'Unauthorized. No valid token provided.' });
  }

  const businessId = claims['sub'];
  const rol        = claims['custom:rol'];

  if (rol !== 'negocio') {
    return response(403, { status: 'error', message: 'Access denied. Only business accounts can update promotions.' });
  }

  const promotionId = event.pathParameters?.promoId;
  if (!promotionId) {
    return response(400, { status: 'error', message: '"promoId" path parameter is required.' });
  }

  let body;
  try {
    body = JSON.parse(event.body || '{}');
  } catch {
    return response(400, { status: 'error', message: 'Request body is not valid JSON.' });
  }

  const { error, value } = schema.validate(body, { abortEarly: false, stripUnknown: true });
  if (error) {
    return response(400, { status: 'error', message: error.details.map(d => d.message).join(' | ') });
  }

  try {
    // Verify promotion exists and belongs to this business
    const existing = await docClient.send(new GetCommand({
      TableName: TABLE_NAME,
      Key: { businessId, promotionId },
    }));

    if (!existing.Item) {
      return response(404, { status: 'error', message: `Promotion "${promotionId}" not found.` });
    }

    // Build dynamic UpdateExpression
    const now    = new Date().toISOString();
    const fields = { ...value, updatedAt: now };

    const updateParts     = [];
    const expressionNames = {};
    const expressionVals  = {};

    for (const [key, val] of Object.entries(fields)) {
      const placeholder = `#${key}`;
      const valKey      = `:${key}`;
      updateParts.push(`${placeholder} = ${valKey}`);
      expressionNames[placeholder] = key;
      expressionVals[valKey]       = val;
    }

    await docClient.send(new UpdateCommand({
      TableName:                 TABLE_NAME,
      Key:                       { businessId, promotionId },
      UpdateExpression:          'SET ' + updateParts.join(', '),
      ExpressionAttributeNames:  expressionNames,
      ExpressionAttributeValues: expressionVals,
    }));

    console.log(`[Routvi] PUT /promotions/${promotionId} → businessId: ${businessId}`);

    return response(200, {
      status: 'success',
      message: 'Promotion updated successfully.',
      data: { businessId, promotionId, ...fields },
    });

  } catch (err) {
    console.error('[Routvi] Error updating promotion:', err);
    return response(500, { status: 'error', message: 'Internal error updating the promotion.' });
  }
};
