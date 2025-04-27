const Joi = require('joi');

// Схема для валидации config.json
const configSchema = Joi.object({
  server: Joi.object({
    port: Joi.number().integer().min(1).max(65535).required(),
    location: Joi.string().default('localhost')
  }).required(),
  wss: Joi.object({
    port: Joi.number().integer().min(1).max(65535).required()
  }).required(),
  navigation: Joi.object({
    jsonDirectory: Joi.string()
      .default('.')
      .custom((value, helpers) => {
        if (value.includes('..')) {
          return helpers.error('any.invalid');
        }
        return value;
      }, 'path validation'),
      extDataFilterSize:  Joi.number().integer().min(1).max(65535).default(2).required(),
    extData: Joi.object().default(null)
  }).default()
});

module.exports = configSchema;