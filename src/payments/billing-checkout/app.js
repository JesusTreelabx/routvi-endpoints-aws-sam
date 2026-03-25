/**
 * Routvi Billing — Create Checkout Session
 * POST /v1/billing/checkout
 *
 * Creates a Stripe Checkout session for the business owner to subscribe
 * to a Routvi plan. On success, saves the stripeCustomerId to DynamoDB.
 *
 * Protected: Requires Cognito authentication (rol: negocio).
 */

const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, GetCommand, UpdateCommand } = require('@aws-sdk/lib-dynamodb');
const Stripe = require('stripe');
const Joi = require('joi');

const ALLOWED_METHOD      = 'POST';
const BUSINESS_TABLE      = process.env.BUSINESS_PROFILES_TABLE;
const STRIPE_SECRET_KEY   = process.env.STRIPE_SECRET_KEY;
const SUCCESS_URL         = process.env.CHECKOUT_SUCCESS_URL || 'https://app.routvi.mx/dashboard?checkout=success';
const CANCEL_URL          = process.env.CHECKOUT_CANCEL_URL  || 'https://app.routvi.mx/dashboard?checkout=cancelled';
const AWS_REGION          = process.env.AWS_REGION || 'us-east-1';

const dynamoClient = new DynamoDBClient({ region: AWS_REGION });
const docClient    = DynamoDBDocumentClient.from(dynamoClient);
const stripe       = new Stripe(STRIPE_SECRET_KEY);

const headers = { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' };

function response(statusCode, body) {
  return { statusCode, headers, body: JSON.stringify(body) };
}

const checkoutSchema = Joi.object({
  priceId: Joi.string().required()   // Stripe Price ID (e.g. price_1ABC...)
});

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
  const email  = claims['email'];

  // 2. Validate body
  let bodyData;
  try {
    bodyData = JSON.parse(event.body || '{}');
  } catch {
    return response(400, { status: 'error', message: 'Request body is not valid JSON.' });
  }

  const { error, value } = checkoutSchema.validate(bodyData, { abortEarly: false, stripUnknown: true });
  if (error) {
    return response(400, { status: 'error', message: error.details.map(d => d.message).join(' | ') });
  }

  try {
    // 3. Get business profile (to check if customer already exists in Stripe)
    const bizResult = await docClient.send(new GetCommand({
      TableName: BUSINESS_TABLE,
      Key: { userId }
    }));

    const business = bizResult.Item;
    if (!business) {
      return response(404, { status: 'error', message: 'Business profile not found.' });
    }

    let customerId = business.stripeCustomerId;

    // 4. Create or reuse Stripe customer
    if (!customerId) {
      const customer = await stripe.customers.create({
        email,
        metadata: { userId, businessName: business.name || '' }
      });
      customerId = customer.id;

      // Save stripeCustomerId immediately to DynamoDB
      await docClient.send(new UpdateCommand({
        TableName:                 BUSINESS_TABLE,
        Key:                       { userId },
        UpdateExpression:          'SET stripeCustomerId = :cid',
        ExpressionAttributeValues: { ':cid': customerId }
      }));
    }

    // 5. Create Stripe Checkout session (Subscription mode)
    const session = await stripe.checkout.sessions.create({
      mode:        'subscription',
      customer:    customerId,
      line_items: [
        {
          price:    value.priceId,
          quantity: 1
        }
      ],
      success_url: `${SUCCESS_URL}&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url:  CANCEL_URL,
      metadata: { userId }
    });

    console.log(`[Routvi Billing] POST /billing/checkout → userId: ${userId}, sessionId: ${session.id}`);

    return response(201, {
      status:  'success',
      message: 'Checkout session created.',
      data: {
        checkoutUrl: session.url,
        sessionId:   session.id
      }
    });

  } catch (err) {
    console.error('[Routvi Billing] Error creating checkout session:', err);
    return response(500, { status: 'error', message: err.message || 'Internal error creating checkout session.' });
  }
};
