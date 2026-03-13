/**
 * Routvi — Promotion Delete Handler
 * DELETE /v1/promotions/{promoId}
 *
 * Deletes a promotion from DynamoDB.
 * Verifies the promotion belongs to the authenticated business before deleting.
 */

const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, GetCommand, DeleteCommand } = require('@aws-sdk/lib-dynamodb');

// ── Constants ─────────────────────────────────────────────────────────
const ALLOWED_METHOD = 'DELETE';
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

// ── Handler ──────────────────────────────────────────────────────────
exports.handler = async (event) => {

  const method = event.httpMethod || event.requestContext?.http?.method;
  if (method !== ALLOWED_METHOD) {
    return response(405, { status: 'error', message: `Method ${method} not allowed. Use DELETE.` });
  }

  const claims = event.requestContext?.authorizer?.claims;
  if (!claims) {
    return response(401, { status: 'error', message: 'Unauthorized. No valid token provided.' });
  }

  const businessId = claims['sub'];
  const rol        = claims['custom:rol'];

  if (rol !== 'negocio') {
    return response(403, { status: 'error', message: 'Access denied. Only business accounts can delete promotions.' });
  }

  const promotionId = event.pathParameters?.promoId;
  if (!promotionId) {
    return response(400, { status: 'error', message: '"promoId" path parameter is required.' });
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

    await docClient.send(new DeleteCommand({
      TableName: TABLE_NAME,
      Key: { businessId, promotionId },
    }));

    console.log(`[Routvi] DELETE /promotions/${promotionId} → businessId: ${businessId}`);

    return response(200, {
      status: 'success',
      message: 'Promotion deleted successfully.',
      data: { promotionId },
    });

  } catch (err) {
    console.error('[Routvi] Error deleting promotion:', err);
    return response(500, { status: 'error', message: 'Internal error deleting the promotion.' });
  }
};
