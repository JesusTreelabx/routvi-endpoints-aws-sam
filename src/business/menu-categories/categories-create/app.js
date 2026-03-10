/**
 * Routvi — Menu Category Create Handler
 * POST /v1/menu/categories
 *
 * Creates a new menu category for the authenticated business.
 * Stores category in DynamoDB using businessId (JWT sub) as partition key
 * and a generated categoryId as sort key.
 *
 * Request body:
 *   { "name": "Entradas", "description": "...", "order": 1 }
 */

const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, PutCommand, QueryCommand } = require('@aws-sdk/lib-dynamodb');
const Joi = require('joi');

// ── Constants ─────────────────────────────────────────────────────────
const ALLOWED_METHOD = 'POST';
const TABLE_NAME     = process.env.MENU_CATEGORIES_TABLE;
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

// ── Simple UUID generator (no external dependency) ────────────────────
function generateId() {
  return `cat_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

// ── Validation schema ─────────────────────────────────────────────────
const schema = Joi.object({
  name:        Joi.string().min(1).max(80).required().messages({
    'string.empty': '"name" cannot be empty.',
    'any.required': '"name" is required.',
  }),
  description: Joi.string().max(300).optional().allow(''),
  order:       Joi.number().integer().min(0).optional(),
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

  // 3. Only 'negocio' role can manage menu categories
  if (rol !== 'negocio') {
    return response(403, { status: 'error', message: 'Access denied. Only business accounts can manage menu categories.' });
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

  // 5. If order not provided, place the new category at the end
  let order = value.order;
  if (order === undefined) {
    try {
      const existing = await docClient.send(new QueryCommand({
        TableName:                TABLE_NAME,
        KeyConditionExpression:   'businessId = :businessId',
        ExpressionAttributeValues: { ':businessId': businessId },
        Select:                   'COUNT',
      }));
      order = existing.Count || 0;
    } catch {
      order = 0;
    }
  }

  // 6. Build category item
  const now        = new Date().toISOString();
  const categoryId = generateId();

  const item = {
    businessId,
    categoryId,
    name:        value.name,
    description: value.description || '',
    order,
    createdAt:   now,
    updatedAt:   now,
  };

  // 7. Save to DynamoDB
  try {
    await docClient.send(new PutCommand({
      TableName: TABLE_NAME,
      Item:      item,
    }));

    console.log(`[Routvi] POST /menu/categories → businessId: ${businessId}, categoryId: ${categoryId}`);

    return response(201, {
      status: 'success',
      message: 'Category created successfully.',
      data: item,
    });

  } catch (err) {
    console.error('[Routvi] Error creating menu category:', err);
    return response(500, { status: 'error', message: 'Internal error creating the category.' });
  }
};
