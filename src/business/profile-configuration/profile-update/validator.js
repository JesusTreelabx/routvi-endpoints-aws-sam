/**
 * Routvi — Business Profile Update Validator
 * Validates body fields for PUT /v1/business/profile
 */

const Joi = require('joi');

const profileSchema = Joi.object({
  // Basic info
  name: Joi.string().min(2).max(100).optional().messages({
    'string.min': '"name" must be at least 2 characters.',
    'string.max': '"name" must be at most 100 characters.',
  }),

  description: Joi.string().max(500).optional().messages({
    'string.max': '"description" must be at most 500 characters.',
  }),

  // Contact
  phone: Joi.string().max(20).optional(),
  address: Joi.string().max(200).optional(),
  website: Joi.string().uri().optional().messages({
    'string.uri': '"website" must be a valid URL.',
  }),

  // Experience profile
  experienceProfile: Joi.object({
    cuisineType:  Joi.string().optional(),
    atmosphere:   Joi.string().optional(),
    priceRange:   Joi.string().valid('$', '$$', '$$$', '$$$$').optional(),
    features:     Joi.array().items(Joi.string()).optional(),
  }).optional(),
}).min(1).messages({
  'object.min': 'At least one field must be provided to update.',
});

/**
 * @param {object} data - parsed request body
 * @returns {{ value: object|null, error: string|null }}
 */
function validateProfileUpdateBody(data) {
  const { error, value } = profileSchema.validate(data, {
    abortEarly: false,
    stripUnknown: true,
  });

  if (error) {
    return { value: null, error: error.details.map(d => d.message).join(' | ') };
  }

  return { value, error: null };
}

module.exports = { validateProfileUpdateBody };
