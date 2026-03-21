/**
 * Routvi Admin — List Community Corrections
 * GET /v1/admin/corrections
 *
 * Returns all community corrections (reports) for admin review.
 * Protected: Only staff with rol 'admin' can access this endpoint.
 */

const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, ScanCommand } = require('@aws-sdk/lib-dynamodb');

const ALLOWED_METHOD     = 'GET';
const CORRECTIONS_TABLE  = process.env.CORRECTIONS_TABLE;
const AWS_REGION         = process.env.AWS_REGION || 'us-east-1';

const dynamoClient = new DynamoDBClient({ region: AWS_REGION });
const docClient    = DynamoDBDocumentClient.from(dynamoClient);

const headers = { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' };

function response(statusCode, body) {
  return { statusCode, headers, body: JSON.stringify(body) };
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

  try {
    // Optional filter: ?status=pending|reviewed|resolved
    const filterStatus = event.queryStringParameters?.status;

    let scanParams = { TableName: CORRECTIONS_TABLE };

    if (filterStatus) {
      scanParams.FilterExpression        = '#s = :status';
      scanParams.ExpressionAttributeNames  = { '#s': 'status' };
      scanParams.ExpressionAttributeValues = { ':status': filterStatus };
    }

    const result = await docClient.send(new ScanCommand(scanParams));

    // Sort by createdAt descending (newest first)
    const corrections = (result.Items || [])
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    console.log(`[Routvi Admin] GET /admin/corrections → count: ${corrections.length}`);

    return response(200, {
      status: 'success',
      count:  corrections.length,
      data:   corrections
    });

  } catch (err) {
    console.error('[Routvi Admin] Error listing corrections:', err);
    return response(500, { status: 'error', message: 'Internal error fetching corrections.' });
  }
};
