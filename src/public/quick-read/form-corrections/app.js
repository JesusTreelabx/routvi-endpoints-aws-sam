/**
 * Routvi — Public Corrections Form Handler
 * POST /v1/corrections
 *
 * Saves a community correction/report for an existing business (e.g., "wrong hours").
 * Fully public endpoint (No Auth).
 */

const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, PutCommand } = require('@aws-sdk/lib-dynamodb');
const { v4: uuidv4 } = require('uuid');
const Joi = require('joi');

const ALLOWED_METHOD = 'POST';
const CORRECTIONS_TABLE = process.env.CORRECTIONS_TABLE;
const AWS_REGION        = process.env.AWS_REGION || 'us-east-1';

const dynamoClient = new DynamoDBClient({ region: AWS_REGION });
const docClient    = DynamoDBDocumentClient.from(dynamoClient);

const headers = { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' };

function response(statusCode, body) {
  return { statusCode, headers, body: JSON.stringify(body) };
}

const correctionSchema = Joi.object({
  businessId:     Joi.string().required(),
  correctionType: Joi.string().valid('hours', 'location', 'closed_permanently', 'other').required(),
  details:        Joi.string().max(500).required(),
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

  const { error, value } = correctionSchema.validate(bodyData, { abortEarly: false, stripUnknown: true });
  if (error) {
    const errorDetails = error.details.map(d => d.message).join(' | ');
    return response(400, { status: 'error', message: errorDetails });
  }

  try {
    const correctionId = uuidv4();
    const now = new Date().toISOString();

    const item = {
      correctionId,
      ...value,
      status: 'pending', // pending | reviewed | resolved
      createdAt: now
    };

    await docClient.send(new PutCommand({
      TableName: CORRECTIONS_TABLE,
      Item: item,
    }));

    console.log(`[Routvi] POST /corrections → Saved correctionId: ${correctionId} for biz: ${value.businessId}`);

    return response(201, {
      status: 'success',
      message: 'Correction submitted successfully. Our team will review it.',
      data: item
    });

  } catch (err) {
    console.error('[Routvi] Error saving correction:', err);
    return response(500, { status: 'error', message: 'Internal error submitting correction.' });
  }
};
