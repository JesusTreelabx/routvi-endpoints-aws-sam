/**
 * Routvi — Menu Product Update Handler
 * PUT /v1/menu/products/{productId}
 *
 * Updates an existing product (name, description, price, categoryId,
 * imageUrl, available, order). All fields are optional — only sent
 * fields are updated (partial update).
 */

const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, UpdateCommand, GetCommand } = require('@aws-sdk/lib-dynamodb');
const Joi = require('joi');

// ── Constants ─────────────────────────────────────────────────────────
const ALLOWED_METHOD = 'PUT';
const TABLE_NAME     = process.env.MENU_PRODUCTS_TABLE;
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
  name:        Joi.string().min(1).max(120).optional(),
  description: Joi.string().max(500).optional().allow(''),
  price:       Joi.number().min(0).precision(2).optional(),
  categoryId:  Joi.string().optional(),
  imageUrl:    Joi.string().optional().allow(''),
  available:   Joi.boolean().optional(),
  order:       Joi.number().integer().min(0).optional(),
}).min(1).messages({
  'object.min': 'At least one field must be provided to update.',
});

// ── Handler ──────────────────────────────────────────────────────────
exports.handler = async (event) => {

  // 1. Validate HTTP method
  const method = event.httpMethod || event.requestContext?.http?.method;
  if (method !== ALLOWED_METHOD) {
    return response(405, { status: 'error', message: `Method ${method} not allowed. Use PUT.` });
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
    return response(403, { status: 'error', message: 'Access denied. Only business accounts can update menu products.' });
  }

  // 4. Extract path parameter
  const productId = event.pathParameters?.productId;
  if (!productId) {
    return response(400, { status: 'error', message: '"productId" path parameter is required.' });
  }

  // 5. Parse and validate body
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
    // 6. Verify product exists and belongs to this business
    const existing = await docClient.send(new GetCommand({
      TableName: TABLE_NAME,
      Key: { businessId, productId },
    }));

    if (!existing.Item) {
      return response(404, { status: 'error', message: `Product "${productId}" not found.` });
    }

    // 7. Build dynamic UpdateExpression
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

    // 8. Update product in DynamoDB
    await docClient.send(new UpdateCommand({
      TableName:                 TABLE_NAME,
      Key:                       { businessId, productId },
      UpdateExpression:          'SET ' + updateParts.join(', '),
      ExpressionAttributeNames:  expressionNames,
      ExpressionAttributeValues: expressionVals,
    }));

    console.log(`[Routvi] PUT /menu/products/${productId} → businessId: ${businessId}`);

    return response(200, {
      status: 'success',
      message: 'Product updated successfully.',
      data: { businessId, productId, ...fields },
    });

  } catch (err) {
    console.error('[Routvi] Error updating product:', err);
    return response(500, { status: 'error', message: 'Internal error updating the product.' });
  }
};
