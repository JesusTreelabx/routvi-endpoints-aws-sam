/**
 * Routvi — Public Business Menu Handler
 * GET /v1/businesses/{businessId}/menu
 *
 * Returns the full menu (categories and active products) for a business.
 * Fully public endpoint (No Auth).
 */

const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, QueryCommand } = require('@aws-sdk/lib-dynamodb');

const ALLOWED_METHOD = 'GET';
const CATEGORIES_TABLE = process.env.CATEGORIES_TABLE;
const PRODUCTS_TABLE   = process.env.PRODUCTS_TABLE;
const AWS_REGION       = process.env.AWS_REGION || 'us-east-1';

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

  const businessId = event.pathParameters?.businessId;
  if (!businessId) {
    return response(400, { status: 'error', message: '"businessId" is required.' });
  }

  try {
    // 1. Fetch Categories
    const categoriesResult = await docClient.send(new QueryCommand({
      TableName: CATEGORIES_TABLE,
      KeyConditionExpression: '#biz = :biz',
      ExpressionAttributeNames: { '#biz': 'businessId' },
      ExpressionAttributeValues: { ':biz': businessId },
    }));
    
    // Sort categories by 'order'
    const categories = (categoriesResult.Items || []).sort((a, b) => (a.order || 0) - (b.order || 0));

    // 2. Fetch Products
    // We only want active products for the public menu
    const productsResult = await docClient.send(new QueryCommand({
      TableName: PRODUCTS_TABLE,
      KeyConditionExpression: '#biz = :biz',
      FilterExpression: '#isActive = :true',
      ExpressionAttributeNames: { '#biz': 'businessId', '#isActive': 'isActive' },
      ExpressionAttributeValues: { ':biz': businessId, ':true': true },
    }));

    // Sort products by 'order'
    const products = (productsResult.Items || []).sort((a, b) => (a.order || 0) - (b.order || 0));

    // 3. Build the response structure (Nested array: Categories -> Products)
    // We only expose public-safe product fields.
    const menu = categories.map(cat => {
      const catProducts = products
        .filter(p => p.categoryId === cat.categoryId)
        .map(p => ({
          productId:   p.productId,
          name:        p.name,
          description: p.description,
          price:       p.price,
          currency:    p.currency || 'MXN',
          imageUrl:    p.imageUrl || null,
          available:   p.available ?? true, // availability badge
          tags:        p.tags || []
        }));

      return {
        categoryId: cat.categoryId,
        name:       cat.name,
        products:   catProducts
      };
    });

    console.log(`[Routvi] GET /businesses/${businessId}/menu → categories: ${categories.length}, products: ${products.length}`);

    return response(200, { status: 'success', data: menu });

  } catch (err) {
    console.error('[Routvi] Error fetching menu:', err);
    return response(500, { status: 'error', message: 'Internal error fetching menu.' });
  }
};
