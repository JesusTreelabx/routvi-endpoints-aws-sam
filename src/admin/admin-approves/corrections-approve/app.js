/**
 * Routvi Admin — Approve Community Correction (CRITICAL)
 * POST /v1/admin/corrections/{correctionId}/approve
 *
 * Approves a community correction report.
 * CRITICAL: Increments `correctionsAcceptedCount` on the business profile.
 * When count reaches the threshold → business receives the "Verificado" badge.
 *
 * Badge threshold: 5 approved corrections = Verificado badge.
 * Protected: Only staff with rol 'admin' can access this endpoint.
 */

const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const {
  DynamoDBDocumentClient,
  GetCommand,
  UpdateCommand
} = require('@aws-sdk/lib-dynamodb');

const ALLOWED_METHOD       = 'POST';
const CORRECTIONS_TABLE    = process.env.CORRECTIONS_TABLE;
const BUSINESS_TABLE       = process.env.BUSINESS_PROFILES_TABLE;
const AWS_REGION           = process.env.AWS_REGION || 'us-east-1';

// Number of approved corrections to earn the "Verificado" badge
const VERIFIED_THRESHOLD = 5;

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

  const correctionId = event.pathParameters?.correctionId;
  if (!correctionId) {
    return response(400, { status: 'error', message: '"correctionId" path parameter is required.' });
  }

  try {
    const now = new Date().toISOString();

    // 1. Fetch the correction
    const correctionResult = await docClient.send(new GetCommand({
      TableName: CORRECTIONS_TABLE,
      Key: { correctionId }
    }));

    const correction = correctionResult.Item;
    if (!correction) {
      return response(404, { status: 'error', message: 'Correction not found.' });
    }

    if (correction.status !== 'pending') {
      return response(409, {
        status:  'error',
        message: `Cannot approve a correction with status "${correction.status}". Only pending corrections can be approved.`
      });
    }

    // 2. Mark correction as resolved
    await docClient.send(new UpdateCommand({
      TableName:                 CORRECTIONS_TABLE,
      Key:                       { correctionId },
      UpdateExpression:          'SET #status = :resolved, #approvedBy = :adminId, #resolvedAt = :now',
      ExpressionAttributeNames:  { '#status': 'status', '#approvedBy': 'approvedBy', '#resolvedAt': 'resolvedAt' },
      ExpressionAttributeValues: { ':resolved': 'resolved', ':adminId': claims['sub'], ':now': now }
    }));

    // 3. Increment correctionsAcceptedCount on the business profile
    //    and conditionally award the "verified" badge
    let badgeAwarded = false;

    if (correction.businessId) {
      const updateResult = await docClient.send(new UpdateCommand({
        TableName:                 BUSINESS_TABLE,
        Key:                       { businessId: correction.businessId },
        UpdateExpression:          'SET correctionsAcceptedCount = if_not_exists(correctionsAcceptedCount, :zero) + :inc',
        ExpressionAttributeValues: { ':zero': 0, ':inc': 1 },
        ReturnValues:              'ALL_NEW'
      }));

      const updatedBusiness = updateResult.Attributes;
      const newCount        = updatedBusiness?.correctionsAcceptedCount || 0;

      // Award "verificado" badge if threshold reached and not already awarded
      if (newCount >= VERIFIED_THRESHOLD && !updatedBusiness?.isVerified) {
        await docClient.send(new UpdateCommand({
          TableName:                 BUSINESS_TABLE,
          Key:                       { businessId: correction.businessId },
          UpdateExpression:          'SET isVerified = :true, verifiedAt = :now',
          ExpressionAttributeValues: { ':true': true, ':now': now }
        }));
        badgeAwarded = true;
        console.log(`[Routvi Admin] 🏅 Badge "Verificado" awarded to businessId: ${correction.businessId}`);
      }

      console.log(`[Routvi Admin] POST /admin/corrections/${correctionId}/approve → businessId: ${correction.businessId}, count: ${newCount}`);
    }

    return response(200, {
      status:  'success',
      message: 'Correction approved successfully.',
      data: {
        correctionId,
        businessId:   correction.businessId,
        badgeAwarded,
        resolvedAt:   now
      }
    });

  } catch (err) {
    console.error('[Routvi Admin] Error approving correction:', err);
    return response(500, { status: 'error', message: 'Internal error approving correction.' });
  }
};
