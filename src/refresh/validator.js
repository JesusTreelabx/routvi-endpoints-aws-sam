/**
 * Routvi — Refresh Body Validator
 * Validates: refreshToken (presence only)
 */

const Joi = require('joi');

const refreshSchema = Joi.object({
  refreshToken: Joi.string()
    .required()
    .messages({
      'string.empty': '"refreshToken" cannot be empty.',
      'any.required': '"refreshToken" is required.',
    }),
});

/**
 * Validates the refresh token request body.
 * @param {object} data - The parsed body object
 * @returns {{ value: object, error: string|null }}
 */
function validateRefreshBody(data) {
  const { error, value } = refreshSchema.validate(data, {
    abortEarly: false,  // Return ALL errors, not just the first one
    stripUnknown: true, // Ignore extra fields not defined in the schema
  });

  if (error) {
    const messages = error.details.map((d) => d.message);
    return { value: null, error: messages.join(' | ') };
  }

  return { value, error: null };
}

module.exports = { validateRefreshBody };
