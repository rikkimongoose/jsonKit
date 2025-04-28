const Joi = require('joi');

const configSchema = Joi.object({
  server: Joi.object({
    port: Joi.number().integer().min(1).max(65535).required(),
    portHttps: Joi.number().integer().min(1).max(65535),
    host: Joi.string().hostname().default("localhost"),
    backlog: Joi.number().integer().default(511).min(0)
  }).required(),

  websocket: Joi.object({
    port: Joi.number().integer().min(1).max(65535).required(),
    portHttps: Joi.number().integer().min(1).max(65535),
    path: Joi.string().pattern(/^\/[a-zA-Z0-9/_-]*$/).default("/"),
    maxPayload: Joi.number().integer().min(1),
    clientTracking: Joi.boolean(),
    perMessageDeflate: Joi.boolean()
  }).required(),

  http: Joi.object({
    timeout: Joi.number().integer().min(0),
    headersTimeout: Joi.number().integer().min(0),
    keepAliveTimeout: Joi.number().integer().min(0)
  }),

  https: Joi.object({
    key: Joi.string().required(),
    cert: Joi.string().required(),
    ca: Joi.array().items(Joi.string()),
    requestCert: Joi.boolean(),
    rejectUnauthorized: Joi.boolean(),
    sessionTimeout: Joi.number().integer().min(1)
  }),

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
  })
});

module.exports = configSchema;