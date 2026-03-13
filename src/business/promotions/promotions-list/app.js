/**
 * Routvi — Promotions List Handler
 * GET /v1/promotions
 *
 * Returns all promotions for the authenticated business.
 * Supports optional filter: ?active=true|false
 *
 * Results sorted by createdAt descending (newest first).
 */

const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, QueryCommand } = require('@aws-sdk/lib-dynamodb');

// ── Constants ─────────────────────────────────────────────────────────
const ALLOWED_METHOD = 'GET';
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

  // 1. Validate HTTP method
  const method = event.httpMethod || event.requestContext?.http?.method;
  if (method !== ALLOWED_METHOD) {
    return response(405, { status: 'error', message: `Method ${method} not allowed. Use GET.` });
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
    return response(403, { status: 'error', message: 'Access denied. Only business accounts can view promotions.' });
  }

  // 4. Optional filter: ?active=true or ?active=false
  const activeParam = event.queryStringParameters?.active;
  const filterActive = activeParam === 'true' ? true
                     : activeParam === 'false' ? false
                     : null; // no filter

  try {
    // 5. Query all promotions for this business
    let queryParams = {
      TableName:                 TABLE_NAME,
      KeyConditionExpression:    'businessId = :businessId',
      ExpressionAttributeValues: { ':businessId': businessId },
    };

    // Optional active filter
    if (filterActive !== null) {
      queryParams.FilterExpression          = '#active = :active';
      queryParams.ExpressionAttributeNames  = { '#active': 'active' };
      queryParams.ExpressionAttributeValues[':active'] = filterActive;
    }

    const result = await docClient.send(new QueryCommand(queryParams));

    // Sort newest first
    const promotions = (result.Items || []).sort(
      (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
    );

    console.log(`[Routvi] GET /promotions → businessId: ${businessId}, filter: ${activeParam || 'none'}, count: ${promotions.length}`);

    return response(200, {
      status: 'success',
      data:   promotions,
      count:  promotions.length,
      filter: filterActive !== null ? { active: filterActive } : null,
    });

  } catch (err) {
    console.error('[Routvi] Error listing promotions:', err);
    return response(500, { status: 'error', message: 'Internal error retrieving promotions.' });
  }
};
