/**
 * Routvi — Login Body Validator
 * Validates: email and password (presence only — Cognito handles policy on login)
 */

const Joi = require('joi');

const loginSchema = Joi.object({
  email: Joi.string()
    .email({ tlds: { allow: false } })
    .required()
    .messages({
      'string.empty': '"email" cannot be empty.',
      'string.email': '"email" must be a valid email address.',
      'any.required': '"email" is required.',
    }),

  password: Joi.string()
    .min(1)
    .required()
    .messages({
      'string.empty': '"password" cannot be empty.',
      'any.required': '"password" is required.',
    }),
});

/**
 * Validates the login request body.
 * @param {object} data - The parsed body object
 * @returns {{ value: object, error: string|null }}
 */
function validateLoginBody(data) {
  const { error, value } = loginSchema.validate(data, {
    abortEarly: false,  // Return ALL errors, not just the first one
    stripUnknown: true, // Ignore extra fields not defined in the schema
  });

  if (error) {
    const messages = error.details.map((d) => d.message);
    return { value: null, error: messages.join(' | ') };
  }

  return { value, error: null };
}

module.exports = { validateLoginBody };
