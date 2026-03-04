/**
 * Routvi — Reset Password Body Validator
 * Validates: email (required, valid format)
 */

const Joi = require('joi');

const resetPasswordSchema = Joi.object({
  email: Joi.string()
    .email({ tlds: { allow: false } })
    .required()
    .messages({
      'string.empty': '"email" cannot be empty.',
      'string.email': '"email" must be a valid email address.',
      'any.required': '"email" is required.',
    }),
});

/**
 * Validates the reset password request body.
 * @param {object} data - The parsed body object
 * @returns {{ value: object, error: string|null }}
 */
function validateResetPasswordBody(data) {
  const { error, value } = resetPasswordSchema.validate(data, {
    abortEarly: false,  // Return ALL errors, not just the first one
    stripUnknown: true, // Ignore extra fields not defined in the schema
  });

  if (error) {
    const messages = error.details.map((d) => d.message);
    return { value: null, error: messages.join(' | ') };
  }

  return { value, error: null };
}

module.exports = { validateResetPasswordBody };
