/**
 * Routvi — Media Delete Handler
 * DELETE /v1/media
 *
 * Deletes an image from the S3 bucket by its fileKey.
 * Only the owner (matching userId in the key) can delete their files.
 *
 * Request body:
 *   { "fileKey": "userId/gallery/1234567890-photo.jpg" }
 */

const { S3Client, DeleteObjectCommand } = require('@aws-sdk/client-s3');

// ── Constants ─────────────────────────────────────────────────────────
const ALLOWED_METHOD = 'DELETE';
const BUCKET_NAME    = process.env.MEDIA_BUCKET_NAME;
const AWS_REGION     = process.env.AWS_REGION || 'us-east-1';

const s3Client = new S3Client({ region: AWS_REGION });

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
    return response(405, { status: 'error', message: `Method ${method} not allowed. Use DELETE.` });
  }

  // 2. Read claims from Cognito Authorizer
  const claims = event.requestContext?.authorizer?.claims;
  if (!claims) {
    return response(401, { status: 'error', message: 'Unauthorized. No valid token provided.' });
  }

  const userId = claims['sub'];
  const rol    = claims['custom:rol'];

  // 3. Only 'negocio' role can delete media
  if (rol !== 'negocio') {
    return response(403, { status: 'error', message: 'Access denied. Only business accounts can delete media.' });
  }

  // 4. Parse body
  let body;
  try {
    body = JSON.parse(event.body || '{}');
  } catch {
    return response(400, { status: 'error', message: 'Request body is not valid JSON.' });
  }

  const { fileKey } = body;

  if (!fileKey || typeof fileKey !== 'string') {
    return response(400, { status: 'error', message: '"fileKey" is required.' });
  }

  // 5. Security check — ensure the file belongs to the authenticated user
  // fileKey format: userId/folder/filename
  if (!fileKey.startsWith(`${userId}/`)) {
    return response(403, { status: 'error', message: 'You can only delete your own files.' });
  }

  // 6. Delete the object from S3
  try {
    await s3Client.send(new DeleteObjectCommand({
      Bucket: BUCKET_NAME,
      Key:    fileKey,
    }));

    console.log(`[Routvi] DELETE /media → userId: ${userId}, key: ${fileKey}`);

    return response(200, {
      status: 'success',
      message: 'Media file deleted successfully.',
      data: { fileKey },
    });

  } catch (err) {
    console.error('[Routvi] Error deleting file from S3:', err);
    return response(500, { status: 'error', message: 'Internal error deleting the file. Please try again later.' });
  }
};
