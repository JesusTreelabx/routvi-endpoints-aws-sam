/**
 * Routvi — WhatsApp Preview Compiler
 * POST /v1/whatsapp/preview
 *
 * Compiles a shopping cart into a WhatsApp-ready text block and URL.
 * Does not interact with DynamoDB natively, just formats text dynamically.
 * Fully public endpoint (No Auth).
 */

const Joi = require('joi');

const ALLOWED_METHOD = 'POST';
const headers = { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' };

function response(statusCode, body) {
  return { statusCode, headers, body: JSON.stringify(body) };
}

const payloadSchema = Joi.object({
  businessPhone: Joi.string().required(),
  businessName:  Joi.string().required(),
  customerName:  Joi.string().optional().allow(''),
  items: Joi.array().items(
    Joi.object({
      name:     Joi.string().required(),
      quantity: Joi.number().integer().min(1).required(),
      price:    Joi.number().min(0).required(),
      notes:    Joi.string().optional().allow('')
    })
  ).min(1).required(),
  deliveryType: Joi.string().valid('pickup', 'delivery', 'dine_in').optional(),
  deliveryAddress: Joi.string().optional().allow('')
});

exports.handler = async (event) => {

  const method = event.httpMethod || event.requestContext?.http?.method;
  if (method !== ALLOWED_METHOD) {
    return response(405, { status: 'error', message: `Method ${method} not allowed.` });
  }

  let bodyData;
  try {
    bodyData = JSON.parse(event.body || '{}');
  } catch {
    return response(400, { status: 'error', message: 'Request body is not valid JSON.' });
  }

  const { error, value } = payloadSchema.validate(bodyData, { abortEarly: false, stripUnknown: true });
  if (error) {
    const errorDetails = error.details.map(d => d.message).join(' | ');
    return response(400, { status: 'error', message: errorDetails });
  }

  try {
    const { businessPhone, businessName, customerName, items, deliveryType, deliveryAddress } = value;

    // Compile items text and calculate total
    let total = 0;
    const itemsTextLines = items.map(item => {
      const subtotal = item.quantity * item.price;
      total += subtotal;
      let line = `▪️ ${item.quantity}x ${item.name} - $${subtotal}`;
      if (item.notes) {
        line += `\n   Nota: _${item.notes}_`;
      }
      return line;
    });

    // Determine delivery method text
    let deliveryText = '';
    if (deliveryType === 'delivery') {
      deliveryText = `📍 *Entrega a Domicilio*\nDirección: ${deliveryAddress || 'Pendiente'}`;
    } else if (deliveryType === 'pickup') {
      deliveryText = `🛍️ *Pasar a Recoger*`;
    } else if (deliveryType === 'dine_in') {
      deliveryText = `🍽️ *Para Comer Ahí*`;
    }

    // Build the final message text
    const messageParts = [
      `Hola *${businessName}* 👋`,
      customerName ? `Mi nombre es ${customerName} y me gustaría hacer el siguiente pedido:\n` : `Me gustaría hacer el siguiente pedido:\n`,
      `========================`,
      ...itemsTextLines,
      `========================\n`,
      `💰 *Total Estimado: $${total}*\n`,
      deliveryText,
      `\n_Pedido enviado vía Routvi_ 🚀`
    ];

    const rawMessage = messageParts.filter(Boolean).join('\n');
    
    // Clean and strictly format the WhatsApp number (remove non-digits, ensure length)
    let cleanPhone = businessPhone.replace(/\D/g, '');
    
    // Generate the wa.me protocol link
    const waLink = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(rawMessage)}`;

    console.log(`[Routvi] POST /whatsapp/preview → Link generated for phone: ${cleanPhone}`);

    return response(200, {
      status: 'success',
      data: {
        rawMessage,
        whatsappLink: waLink,
        total
      }
    });

  } catch (err) {
    console.error('[Routvi] Error compiling WhatsApp preview:', err);
    return response(500, { status: 'error', message: 'Internal error compiling preview.' });
  }
};
