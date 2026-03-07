/**
 * Routvi — Business Profile Update Handler
 * PUT /v1/business/profile
 *
 * Creates or updates the business profile in DynamoDB.
 * Protected by Cognito Authorizer — only 'negocio' role can access.
 * Uses UpdateItem to apply partial updates (only provided fields are changed).
 */

const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, UpdateCommand } = require('@aws-sdk/lib-dynamodb');
const { validateProfileUpdateBody } = require('./validator');

// ── Constants ─────────────────────────────────────────────────────────
const ALLOWED_METHOD = 'PUT';
const TABLE_NAME     = process.env.BUSINESS_PROFILES_TABLE;
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

  const userId = claims['sub'];
  const rol    = claims['custom:rol'];

  // 3. Only 'negocio' role can update business profile
  if (rol !== 'negocio') {
    return response(403, { status: 'error', message: 'Access denied. Only business accounts can access this resource.' });
  }

  // 4. Parse body
  let bodyData;
  try {
    bodyData = JSON.parse(event.body || '{}');
  } catch {
    return response(400, { status: 'error', message: 'Request body is not valid JSON.' });
  }

  // 5. Validate body fields
  const { value, error: validationError } = validateProfileUpdateBody(bodyData);
  if (validationError) {
    return response(400, { status: 'error', message: validationError });
  }

  // 6. Build DynamoDB UpdateExpression dynamically from provided fields
  const now = new Date().toISOString();
  const fields = { ...value, updatedAt: now };

  // If this is the first time, also set createdAt
  const updateParts    = [];
  const expressionVals = { ':updatedAt': now };
  const expressionNames = {};

  for (const [key, val] of Object.entries(fields)) {
    const placeholder = `#${key}`;
    const valKey      = `:${key}`;
    updateParts.push(`${placeholder} = ${valKey}`);
    expressionNames[placeholder] = key;
    expressionVals[valKey]       = val;
  }

  const updateExpression = 'SET ' + updateParts.join(', ');

  try {
    await docClient.send(new UpdateCommand({
      TableName:                 TABLE_NAME,
      Key:                       { userId },
      UpdateExpression:          updateExpression,
      ExpressionAttributeNames:  expressionNames,
      ExpressionAttributeValues: expressionVals,
      ReturnValues:              'ALL_NEW',
    }));

    console.log(`[Routvi] PUT /business/profile → userId: ${userId}`);

    return response(200, {
      status: 'success',
      message: 'Business profile updated successfully.',
      data: { userId, ...fields },
    });

  } catch (err) {
    console.error('[Routvi] Error updating business profile:', err);
    return response(500, { status: 'error', message: 'Internal error while updating the business profile.' });
  }
};
