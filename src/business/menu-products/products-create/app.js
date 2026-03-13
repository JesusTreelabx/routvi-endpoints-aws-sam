/**
 * Routvi — Menu Product Create Handler
 * POST /v1/menu/products
 *
 * Creates a new product under a category in the business menu.
 * Stores in DynamoDB using businessId (JWT sub) as PK and productId as SK.
 *
 * Request body:
 *   {
 *     "name": "Tacos al Pastor",
 *     "description": "Deliciosos tacos...",
 *     "price": 85.00,
 *     "categoryId": "cat_xxx",       ← required, links product to a category
 *     "imageUrl": "userId/gallery/photo.jpg",  ← optional, S3 fileKey
 *     "available": true,             ← optional, default true
 *     "order": 0                     ← optional, position in the list
 *   }
 */

const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, PutCommand, QueryCommand } = require('@aws-sdk/lib-dynamodb');
const Joi = require('joi');

// ── Constants ─────────────────────────────────────────────────────────
const ALLOWED_METHOD = 'POST';
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

// ── Simple ID generator ───────────────────────────────────────────────
function generateId() {
  return `prod_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

// ── Validation schema ─────────────────────────────────────────────────
const schema = Joi.object({
  name:        Joi.string().min(1).max(120).required().messages({
    'string.empty': '"name" cannot be empty.',
    'any.required': '"name" is required.',
  }),
  categoryId:  Joi.string().required().messages({
    'any.required': '"categoryId" is required.',
  }),
  description: Joi.string().max(500).optional().allow(''),
  price:       Joi.number().min(0).precision(2).required().messages({
    'any.required': '"price" is required.',
    'number.min':   '"price" must be 0 or greater.',
  }),
  imageUrl:    Joi.string().optional().allow(''),
  available:   Joi.boolean().optional().default(true),
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

  // 3. Role check
  if (rol !== 'negocio') {
    return response(403, { status: 'error', message: 'Access denied. Only business accounts can manage menu products.' });
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

  // 5. Auto-assign order if not provided
  let order = value.order;
  if (order === undefined) {
    try {
      const existing = await docClient.send(new QueryCommand({
        TableName:                 TABLE_NAME,
        KeyConditionExpression:    'businessId = :businessId',
        ExpressionAttributeValues: { ':businessId': businessId },
        Select:                    'COUNT',
      }));
      order = existing.Count || 0;
    } catch {
      order = 0;
    }
  }

  // 6. Build product item
  const now       = new Date().toISOString();
  const productId = generateId();

  const item = {
    businessId,
    productId,
    name:        value.name,
    description: value.description || '',
    price:       value.price,
    categoryId:  value.categoryId,
    imageUrl:    value.imageUrl || '',
    available:   value.available ?? true,
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

    console.log(`[Routvi] POST /menu/products → businessId: ${businessId}, productId: ${productId}`);

    return response(201, {
      status: 'success',
      message: 'Product created successfully.',
      data: item,
    });

  } catch (err) {
    console.error('[Routvi] Error creating product:', err);
    return response(500, { status: 'error', message: 'Internal error creating the product.' });
  }
};
