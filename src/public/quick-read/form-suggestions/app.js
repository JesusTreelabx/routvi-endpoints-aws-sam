/**
 * Routvi — Public Suggestions Form Handler
 * POST /v1/suggestions
 *
 * Saves a user suggestion for a new taco stand/business.
 * Fully public endpoint (No Auth).
 */

const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, PutCommand } = require('@aws-sdk/lib-dynamodb');
const { v4: uuidv4 } = require('uuid');
const Joi = require('joi');

const ALLOWED_METHOD = 'POST';
const SUGGESTIONS_TABLE = process.env.SUGGESTIONS_TABLE;
const AWS_REGION        = process.env.AWS_REGION || 'us-east-1';

const dynamoClient = new DynamoDBClient({ region: AWS_REGION });
const docClient    = DynamoDBDocumentClient.from(dynamoClient);

const headers = { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' };

function response(statusCode, body) {
  return { statusCode, headers, body: JSON.stringify(body) };
}

const suggestionSchema = Joi.object({
  businessName: Joi.string().min(2).max(100).required(),
  address:      Joi.string().max(200).required(),
  city:         Joi.string().max(100).required(),
  state:        Joi.string().max(100).required(),
  description:  Joi.string().max(500).optional().allow(''),
  submitterEmail: Joi.string().email().optional().allow('')
});

exports.handler = async (event) => {

  const method = event.httpMethod || event.requestContext?.http?.method;
  if (method !== ALLOWED_METHOD) {
    return response(405, { status: 'error', message: `Method ${method} not allowed.` });
  }

  let bodyData;
  try {
    bodyData = JSON.parse(event.body || '{}');
  } catch {
    return response(400, { status: 'error', message: 'Request body is not valid JSON.' });
  }

  const { error, value } = suggestionSchema.validate(bodyData, { abortEarly: false, stripUnknown: true });
  if (error) {
    const errorDetails = error.details.map(d => d.message).join(' | ');
    return response(400, { status: 'error', message: errorDetails });
  }

  try {
    const suggestionId = uuidv4();
    const now = new Date().toISOString();

    const item = {
      suggestionId,
      ...value,
      status: 'pending', // pending | reviewed | approved | rejected
      createdAt: now
    };

    await docClient.send(new PutCommand({
      TableName: SUGGESTIONS_TABLE,
      Item: item,
    }));

    console.log(`[Routvi] POST /suggestions → Saved suggestionId: ${suggestionId} for ${value.businessName}`);

    return response(201, {
      status: 'success',
      message: 'Suggestion submitted successfully. Thank you for helping the community!',
      data: item
    });

  } catch (err) {
    console.error('[Routvi] Error saving suggestion:', err);
    return response(500, { status: 'error', message: 'Internal error submitting suggestion.' });
  }
};
