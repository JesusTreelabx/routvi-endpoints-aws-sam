/**
 * Routvi Admin — Approve Access Request & Generate Invite
 * POST /v1/admin/access-requests/{requestId}/approve
 *
 * Approves a pending access request and generates a unique invite code (e.g. INV-7H2K9).
 * Protected: Only staff with rol 'admin' can access this endpoint.
 */

const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const {
  DynamoDBDocumentClient,
  GetCommand,
  UpdateCommand,
  PutCommand
} = require('@aws-sdk/lib-dynamodb');
const { v4: uuidv4 } = require('uuid');

const ALLOWED_METHOD        = 'POST';
const ACCESS_REQUESTS_TABLE = process.env.ACCESS_REQUESTS_TABLE;
const INVITES_TABLE         = process.env.INVITES_TABLE;
const AWS_REGION            = process.env.AWS_REGION || 'us-east-1';

const dynamoClient = new DynamoDBClient({ region: AWS_REGION });
const docClient    = DynamoDBDocumentClient.from(dynamoClient);

const headers = { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' };

function response(statusCode, body) {
  return { statusCode, headers, body: JSON.stringify(body) };
}

/**
 * Generates a human-readable invite code like: INV-7H2K9
 */
function generateInviteCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // No 0,O,1,I for readability
  let suffix = '';
  for (let i = 0; i < 5; i++) {
    suffix += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return `INV-${suffix}`;
}

exports.handler = async (event) => {

  // 1. Validate HTTP method
  const method = event.httpMethod || event.requestContext?.http?.method;
  if (method !== ALLOWED_METHOD) {
    return response(405, { status: 'error', message: `Method ${method} not allowed.` });
  }

  // 2. Verify the caller is an admin
  const claims = event.requestContext?.authorizer?.claims;
  if (!claims) {
    return response(401, { status: 'error', message: 'Unauthorized. No valid token provided.' });
  }

  const rol     = claims['custom:rol'];
  const adminId = claims['sub'];

  if (rol !== 'admin') {
    return response(403, { status: 'error', message: 'Access denied. Admin role required.' });
  }

  // 3. Get requestId from path
  const requestId = event.pathParameters?.requestId;
  if (!requestId) {
    return response(400, { status: 'error', message: '"requestId" path parameter is required.' });
  }

  try {
    // 4. Fetch the access request
    const existing = await docClient.send(new GetCommand({
      TableName: ACCESS_REQUESTS_TABLE,
      Key: { requestId }
    }));

    if (!existing.Item) {
      return response(404, { status: 'error', message: 'Access request not found.' });
    }

    if (existing.Item.status !== 'pending') {
      return response(409, {
        status:  'error',
        message: `Cannot approve a request with status "${existing.Item.status}". Only pending requests can be approved.`
      });
    }

    const now = new Date().toISOString();

    // 5. Mark request as approved
    await docClient.send(new UpdateCommand({
      TableName:                 ACCESS_REQUESTS_TABLE,
      Key:                       { requestId },
      UpdateExpression:          'SET #status = :approved, #approvedBy = :adminId, #approvedAt = :now',
      ExpressionAttributeNames:  { '#status': 'status', '#approvedBy': 'approvedBy', '#approvedAt': 'approvedAt' },
      ExpressionAttributeValues: { ':approved': 'approved', ':adminId': adminId, ':now': now }
    }));

    // 6. Generate unique invite code and save it
    const inviteCode = generateInviteCode();
    const inviteId   = uuidv4();

    const invite = {
      inviteId,
      code:          inviteCode,
      requestId,
      recipientEmail: existing.Item.email || null,
      createdBy:     adminId,
      status:        'active',   // active | used | expired
      createdAt:     now,
      expiresAt:     new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString() // 7 days
    };

    await docClient.send(new PutCommand({
      TableName: INVITES_TABLE,
      Item: invite
    }));

    console.log(`[Routvi Admin] POST /admin/access-requests/${requestId}/approve → inviteCode: ${inviteCode}`);

    return response(200, {
      status:  'success',
      message: 'Access request approved. Invite code generated.',
      data: {
        requestId,
        inviteCode,
        inviteId,
        expiresAt: invite.expiresAt
      }
    });

  } catch (err) {
    console.error('[Routvi Admin] Error approving access request:', err);
    return response(500, { status: 'error', message: 'Internal error approving access request.' });
  }
};
