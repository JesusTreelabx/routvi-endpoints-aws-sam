/**
 * Routvi — Media Upload URL Handler
 * POST /v1/media/upload-url
 *
 * Generates a presigned PUT URL so the frontend can upload images
 * directly to S3 — the file never passes through the Lambda (no size limit).
 *
 * Request body:
 *   { "fileName": "my-photo.jpg", "contentType": "image/jpeg", "folder": "gallery" }
 *
 * Response:
 *   { "uploadUrl": "https://s3.amazonaws.com/...", "fileKey": "userId/gallery/my-photo.jpg" }
 */

const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');

// ── Constants ─────────────────────────────────────────────────────────
const ALLOWED_METHOD   = 'POST';
const BUCKET_NAME      = process.env.MEDIA_BUCKET_NAME;
const AWS_REGION       = process.env.AWS_REGION || 'us-east-1';
const URL_EXPIRY_SECS  = 300; // presigned URL valid for 5 minutes

// Allowed image content types
const ALLOWED_CONTENT_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
];

// Allowed upload folders
const ALLOWED_FOLDERS = ['gallery', 'banner', 'logo', 'profile'];

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
    return response(405, { status: 'error', message: `Method ${method} not allowed. Use POST.` });
  }

  // 2. Read claims from Cognito Authorizer
  const claims = event.requestContext?.authorizer?.claims;
  if (!claims) {
    return response(401, { status: 'error', message: 'Unauthorized. No valid token provided.' });
  }

  const userId = claims['sub'];
  const rol    = claims['custom:rol'];

  // 3. Only 'negocio' role can upload media
  if (rol !== 'negocio') {
    return response(403, { status: 'error', message: 'Access denied. Only business accounts can upload media.' });
  }

  // 4. Parse and validate request body
  let body;
  try {
    body = JSON.parse(event.body || '{}');
  } catch {
    return response(400, { status: 'error', message: 'Request body is not valid JSON.' });
  }

  const { fileName, contentType, folder = 'gallery' } = body;

  if (!fileName || typeof fileName !== 'string') {
    return response(400, { status: 'error', message: '"fileName" is required.' });
  }

  if (!contentType || !ALLOWED_CONTENT_TYPES.includes(contentType)) {
    return response(400, {
      status: 'error',
      message: `"contentType" must be one of: ${ALLOWED_CONTENT_TYPES.join(', ')}.`,
    });
  }

  if (!ALLOWED_FOLDERS.includes(folder)) {
    return response(400, {
      status: 'error',
      message: `"folder" must be one of: ${ALLOWED_FOLDERS.join(', ')}.`,
    });
  }

  // 5. Build S3 key: userId/folder/timestamp-fileName
  const timestamp = Date.now();
  const sanitizedFileName = fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
  const fileKey = `${userId}/${folder}/${timestamp}-${sanitizedFileName}`;

  // 6. Generate presigned PUT URL
  try {
    const command = new PutObjectCommand({
      Bucket:      BUCKET_NAME,
      Key:         fileKey,
      ContentType: contentType,
    });

    const uploadUrl = await getSignedUrl(s3Client, command, { expiresIn: URL_EXPIRY_SECS });

    console.log(`[Routvi] POST /media/upload-url → userId: ${userId}, key: ${fileKey}`);

    return response(200, {
      status: 'success',
      data: {
        uploadUrl,   // Frontend uses this URL to PUT the file directly to S3
        fileKey,     // Save this key to reference the file later (e.g., in DynamoDB)
        expiresIn: URL_EXPIRY_SECS,
      },
    });

  } catch (err) {
    console.error('[Routvi] Error generating presigned URL:', err);
    return response(500, { status: 'error', message: 'Internal error generating upload URL.' });
  }
};
