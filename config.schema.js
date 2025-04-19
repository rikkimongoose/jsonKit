const Joi = require('joi');

// Схема для валидации config.json
const configSchema = Joi.object({
  server: Joi.object({
    port: Joi.number().integer().min(1).max(65535).required(),
    portWss: Joi.number().integer().min(1).max(65535).required(),
    staticFiles: Joi.string().required(),
    cors: Joi.object({
      enabled: Joi.boolean().default(false),
      origins: Joi.array().items(Joi.string()).optional()
    }).optional()
  }).required(),
  app: Joi.object({
    title: Joi.string().min(1).required().default("JSON Kit"),
    version: Joi.string().min(1).required().default("0.0"),
    enableSplitPanel: Joi.boolean().default(true)
  }).required(),
  navigation: Joi.object({
    jsonDirectory: Joi.string()
      .default('.')
      .custom((value, helpers) => {
        if (value.includes('..')) {
          return helpers.error('any.invalid');
        }
        return value;
      }, 'path validation')
  }).default()
});

module.exports = configSchema;