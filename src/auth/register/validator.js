/**
 * Routvi — Register Body Validator
 * Validates: email, password (strong security policy) and rol (optional)
 */

const Joi = require('joi');

const registerSchema = Joi.object({
  email: Joi.string()
    .email({ tlds: { allow: false } })
    .required()
    .messages({
      'string.empty':  '"email" cannot be empty.',
      'string.email':  '"email" must be a valid email address.',
      'any.required':  '"email" is required.',
    }),

  password: Joi.string()
    .min(8)
    .pattern(/[A-Z]/, 'uppercase letter')
    .pattern(/[0-9]/, 'number')
    .pattern(/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/, 'symbol')
    .required()
    .messages({
      'string.empty':        '"password" cannot be empty.',
      'string.min':          '"password" must be at least 8 characters long.',
      'string.pattern.name': '"password" must contain at least one {#name}.',
      'any.required':        '"password" is required.',
    }),

  rol: Joi.string()
    .valid('cliente', 'negocio')
    .default('cliente')
    .messages({
      'any.only': '"rol" must be "cliente" or "negocio".',
    }),
});

/**
 * Validates the register request body.
 * @param {object} data - The parsed body object
 * @returns {{ value: object, error: string|null }}
 */
function validateRegisterBody(data) {
  const { error, value } = registerSchema.validate(data, {
    abortEarly: false,   // Return ALL errors, not just the first one
    stripUnknown: true,  // Ignore extra fields not defined in the schema
  });

  if (error) {
    const messages = error.details.map((d) => d.message);
    return { value: null, error: messages.join(' | ') };
  }

  return { value, error: null };
}

module.exports = { validateRegisterBody };
