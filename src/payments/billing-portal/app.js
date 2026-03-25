/**
 * Routvi Billing — Customer Portal
 * GET /v1/billing/portal
 *
 * Generates a Stripe Customer Portal session URL so the authenticated
 * business owner can manage their subscription, view invoices, or cancel.
 *
 * Protected: Requires Cognito authentication (rol: negocio).
 */

const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, GetCommand } = require('@aws-sdk/lib-dynamodb');
const Stripe = require('stripe');

const ALLOWED_METHOD    = 'GET';
const BUSINESS_TABLE    = process.env.BUSINESS_PROFILES_TABLE;
const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;
const PORTAL_RETURN_URL = process.env.PORTAL_RETURN_URL || 'https://app.routvi.mx/dashboard';
const AWS_REGION        = process.env.AWS_REGION || 'us-east-1';

const dynamoClient = new DynamoDBClient({ region: AWS_REGION });
const docClient    = DynamoDBDocumentClient.from(dynamoClient);
const stripe       = new Stripe(STRIPE_SECRET_KEY);

const headers = { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' };

function response(statusCode, body) {
  return { statusCode, headers, body: JSON.stringify(body) };
}

exports.handler = async (event) => {

  const method = event.httpMethod || event.requestContext?.http?.method;
  if (method !== ALLOWED_METHOD) {
    return response(405, { status: 'error', message: `Method ${method} not allowed.` });
  }

  // 1. Verify authenticated user
  const claims = event.requestContext?.authorizer?.claims;
  if (!claims) {
    return response(401, { status: 'error', message: 'Unauthorized.' });
  }

  const userId = claims['sub'];

  try {
    // 2. Fetch the business profile to get the stripeCustomerId
    const bizResult = await docClient.send(new GetCommand({
      TableName: BUSINESS_TABLE,
      Key: { userId }
    }));

    const business = bizResult.Item;

    if (!business) {
      return response(404, { status: 'error', message: 'Business profile not found.' });
    }

    if (!business.stripeCustomerId) {
      return response(400, {
        status:  'error',
        message: 'This business does not have an active Stripe subscription. Please complete checkout first.'
      });
    }

    // 3. Create Stripe Customer Portal session
    const portalSession = await stripe.billingPortal.sessions.create({
      customer:   business.stripeCustomerId,
      return_url: PORTAL_RETURN_URL
    });

    console.log(`[Routvi Billing] GET /billing/portal → userId: ${userId}, portalUrl created`);

    return response(200, {
      status: 'success',
      data: {
        url: portalSession.url
      }
    });

  } catch (err) {
    console.error('[Routvi Billing] Error creating portal session:', err);
    return response(500, { status: 'error', message: 'Internal error creating billing portal session.' });
  }
};
