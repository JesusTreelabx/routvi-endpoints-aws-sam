/**
 * Routvi Admin — Create Invite Manually
 * POST /v1/admin/invites
 *
 * Generates a manual invite code (e.g. INV-7H2K9) for a specific email.
 * Protected: Only staff with rol 'admin' can access this endpoint.
 */

const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, PutCommand } = require('@aws-sdk/lib-dynamodb');
const { v4: uuidv4 } = require('uuid');

const ALLOWED_METHOD  = 'POST';
const INVITES_TABLE   = process.env.INVITES_TABLE;
const AWS_REGION      = process.env.AWS_REGION || 'us-east-1';

const dynamoClient = new DynamoDBClient({ region: AWS_REGION });
const docClient    = DynamoDBDocumentClient.from(dynamoClient);

const headers = { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' };

function response(statusCode, body) {
  return { statusCode, headers, body: JSON.stringify(body) };
}

function generateInviteCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let suffix = '';
  for (let i = 0; i < 5; i++) {
    suffix += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return `INV-${suffix}`;
}

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

  // recipientEmail is optional — admin can create a blank invite
  const { recipientEmail, note } = bodyData;

  try {
    const inviteCode = generateInviteCode();
    const inviteId   = uuidv4();
    const now        = new Date().toISOString();

    const invite = {
      inviteId,
      code:           inviteCode,
      recipientEmail: recipientEmail || null,
      note:           note || null,
      createdBy:      claims['sub'],
      status:         'active',   // active | used | expired
      createdAt:      now,
      expiresAt:      new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString() // 7 days
    };

    await docClient.send(new PutCommand({
      TableName: INVITES_TABLE,
      Item: invite
    }));

    console.log(`[Routvi Admin] POST /admin/invites → code: ${inviteCode}`);

    return response(201, {
      status:  'success',
      message: 'Invite code generated successfully.',
      data:    invite
    });

  } catch (err) {
    console.error('[Routvi Admin] Error creating invite:', err);
    return response(500, { status: 'error', message: 'Internal error creating invite.' });
  }
};
