/**
 * Routvi — Verify Code Body Validator
 * Validates: email, code (6-digit PIN) and newPassword (strong policy)
 */

const Joi = require('joi');

const verifyCodeSchema = Joi.object({
  email: Joi.string()
    .email({ tlds: { allow: false } })
    .required()
    .messages({
      'string.empty': '"email" cannot be empty.',
      'string.email': '"email" must be a valid email address.',
      'any.required': '"email" is required.',
    }),

  code: Joi.string()
    .length(6)
    .pattern(/^\d+$/)
    .required()
    .messages({
      'string.empty':   '"code" cannot be empty.',
      'string.length':  '"code" must be exactly 6 digits.',
      'string.pattern.base': '"code" must contain only numbers.',
      'any.required':   '"code" is required.',
    }),

  newPassword: Joi.string()
    .min(8)
    .pattern(/[A-Z]/, 'uppercase letter')
    .pattern(/[0-9]/, 'number')
    .pattern(/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/, 'symbol')
    .required()
    .messages({
      'string.empty':        '"newPassword" cannot be empty.',
      'string.min':          '"newPassword" must be at least 8 characters long.',
      'string.pattern.name': '"newPassword" must contain at least one {#name}.',
      'any.required':        '"newPassword" is required.',
    }),
});

/**
 * Validates the verify-code request body.
 * @param {object} data - The parsed body object
 * @returns {{ value: object, error: string|null }}
 */
function validateVerifyCodeBody(data) {
  const { error, value } = verifyCodeSchema.validate(data, {
    abortEarly: false,  // Return ALL errors, not just the first one
    stripUnknown: true, // Ignore extra fields not defined in the schema
  });

  if (error) {
    const messages = error.details.map((d) => d.message);
    return { value: null, error: messages.join(' | ') };
  }

  return { value, error: null };
}

module.exports = { validateVerifyCodeBody };
