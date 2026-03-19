/**
 * Routvi Admin — List Access Requests
 * GET /v1/admin/access-requests
 *
 * Returns all pending (or filtered) business access requests.
 * Protected: Only staff with rol 'admin' can access this endpoint.
 */

const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, ScanCommand } = require('@aws-sdk/lib-dynamodb');

const ALLOWED_METHOD        = 'GET';
const ACCESS_REQUESTS_TABLE = process.env.ACCESS_REQUESTS_TABLE;
const AWS_REGION            = process.env.AWS_REGION || 'us-east-1';

const dynamoClient = new DynamoDBClient({ region: AWS_REGION });
const docClient    = DynamoDBDocumentClient.from(dynamoClient);

const headers = { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' };

function response(statusCode, body) {
  return { statusCode, headers, body: JSON.stringify(body) };
}

exports.handler = async (event) => {

  // 1. Validate HTTP method
  const method = event.httpMethod || event.requestContext?.http?.method;
  if (method !== ALLOWED_METHOD) {
    return response(405, { status: 'error', message: `Method ${method} not allowed.` });
  }

  // 2. Verify the caller is an admin via Cognito claims
  const claims = event.requestContext?.authorizer?.claims;
  if (!claims) {
    return response(401, { status: 'error', message: 'Unauthorized. No valid token provided.' });
  }

  const rol = claims['custom:rol'];
  if (rol !== 'admin') {
    return response(403, { status: 'error', message: 'Access denied. Admin role required.' });
  }

  try {
    // 3. Optional filter by status via query param: ?status=pending|approved|rejected
    const filterStatus = event.queryStringParameters?.status;

    let scanParams = {
      TableName: ACCESS_REQUESTS_TABLE,
    };

    if (filterStatus) {
      scanParams.FilterExpression        = '#s = :status';
      scanParams.ExpressionAttributeNames  = { '#s': 'status' };
      scanParams.ExpressionAttributeValues = { ':status': filterStatus };
    }

    const result = await docClient.send(new ScanCommand(scanParams));

    // Sort by createdAt descending (newest first)
    const requests = (result.Items || [])
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    console.log(`[Routvi Admin] GET /admin/access-requests → count: ${requests.length}`);

    return response(200, {
      status:  'success',
      count:   requests.length,
      data:    requests
    });

  } catch (err) {
    console.error('[Routvi Admin] Error listing access requests:', err);
    return response(500, { status: 'error', message: 'Internal error fetching access requests.' });
  }
};
