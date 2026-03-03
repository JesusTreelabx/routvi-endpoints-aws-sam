/**
 * Routvi — Validador del body de registro
 * Valida: email, password (con política de seguridad) y rol (opcional)
 */

const Joi = require('joi');

const registerSchema = Joi.object({
  email: Joi.string()
    .email({ tlds: { allow: false } })
    .required()
    .messages({
      'string.empty':      '"email" no puede estar vacío.',
      'string.email':      '"email" debe ser una dirección de correo válida.',
      'any.required':      '"email" es obligatorio.',
    }),

  password: Joi.string()
    .min(8)
    .pattern(/[A-Z]/, 'mayúscula')
    .pattern(/[0-9]/, 'número')
    .pattern(/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/, 'símbolo')
    .required()
    .messages({
      'string.empty':       '"password" no puede estar vacío.',
      'string.min':         '"password" debe tener al menos 8 caracteres.',
      'string.pattern.name': '"password" debe contener al menos una {#name}.',
      'any.required':       '"password" es obligatorio.',
    }),

  rol: Joi.string()
    .valid('cliente', 'negocio')
    .default('cliente')
    .messages({
      'any.only': '"rol" debe ser "cliente" o "negocio".',
    }),
});

/**
 * Valida el body del request de registro.
 * @param {object} data - El objeto parseado del body
 * @returns {{ value: object, error: string|null }}
 */
function validateRegisterBody(data) {
  const { error, value } = registerSchema.validate(data, {
    abortEarly: false,   // Devuelve TODOS los errores, no solo el primero
    stripUnknown: true,  // Ignora campos extras que no están en el schema
  });

  if (error) {
    const mensajes = error.details.map((d) => d.message);
    return { value: null, error: mensajes.join(' | ') };
  }

  return { value, error: null };
}

module.exports = { validateRegisterBody };
