import { object, number, boolean, array, string } from 'joi';

// Схема для валидации config.json
const configSchema = object({
  server: object({
    port: number().integer().min(1).max(65535).required(),
    portWss: number().integer().min(1).max(65535).required(),
    cors: object({
      enabled: boolean().default(false),
      origins: array().items(string()).optional()
    }).optional()
  }).required(),
  wss: object({
    port: number().integer().min(1).max(65535).required()
  }).required(),
  navigation: object({
    jsonDirectory: string()
      .default('.')
      .custom((value, helpers) => {
        if (value.includes('..')) {
          return helpers.error('any.invalid');
        }
        return value;
      }, 'path validation'),
      extDataFilterSize:  number().integer().min(1).max(65535).default(2).required(),
    extData: object().default(null)
  }).default()
});

export default configSchema;