/**
 * Routvi — Business Publish Handler
 * POST /v1/business/publish
 *
 * Changes the business status to "published" in DynamoDB.
 * Optionally triggers a Webhook to the SSG frontend for static page rebuild.
 * Protected by Cognito Authorizer — only 'negocio' role can access.
 */

const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, UpdateCommand, GetCommand } = require('@aws-sdk/lib-dynamodb');

// ── Constants ─────────────────────────────────────────────────────────
const ALLOWED_METHOD = 'POST';
const TABLE_NAME     = process.env.BUSINESS_PROFILES_TABLE;
const WEBHOOK_URL    = process.env.WEBHOOK_URL || null;
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

// ── Trigger SSG Webhook (non-blocking) ───────────────────────────────
async function triggerWebhook(userId) {
  if (!WEBHOOK_URL) {
    console.log('[Routvi] No WEBHOOK_URL configured — skipping SSG rebuild.');
    return;
  }
  try {
    const webhookResponse = await fetch(WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, event: 'business.published' }),
    });
    console.log(`[Routvi] Webhook triggered → status: ${webhookResponse.status}`);
  } catch (err) {
    // Webhook failure should NOT block the publish action
    console.warn('[Routvi] Webhook call failed (non-blocking):', err.message);
  }
}

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

  const userId = claims['sub'];
  const rol    = claims['custom:rol'];

  // 3. Only 'negocio' role can publish
  if (rol !== 'negocio') {
    return response(403, { status: 'error', message: 'Access denied. Only business accounts can publish.' });
  }

  // 4. Verify the business profile exists before publishing
  try {
    const existing = await docClient.send(new GetCommand({
      TableName: TABLE_NAME,
      Key: { userId },
    }));

    if (!existing.Item) {
      return response(404, {
        status: 'error',
        message: 'Business profile not found. Please complete your profile before publishing.',
      });
    }

    // 5. Update status to "published" in DynamoDB
    const now = new Date().toISOString();

    await docClient.send(new UpdateCommand({
      TableName: TABLE_NAME,
      Key: { userId },
      UpdateExpression: 'SET #status = :status, #publishedAt = :publishedAt, #updatedAt = :updatedAt',
      ExpressionAttributeNames: {
        '#status':      'status',
        '#publishedAt': 'publishedAt',
        '#updatedAt':   'updatedAt',
      },
      ExpressionAttributeValues: {
        ':status':      'published',
        ':publishedAt': now,
        ':updatedAt':   now,
      },
    }));

    console.log(`[Routvi] POST /business/publish → userId: ${userId} published at ${now}`);

    // 6. Trigger SSG Webhook (non-blocking — won't fail the request)
    await triggerWebhook(userId);

    return response(200, {
      status: 'success',
      message: 'Business profile published successfully.',
      data: {
        userId,
        status: 'published',
        publishedAt: now,
      },
    });

  } catch (err) {
    console.error('[Routvi] Error publishing business profile:', err);
    return response(500, { status: 'error', message: 'Internal error while publishing. Please try again later.' });
  }
};
