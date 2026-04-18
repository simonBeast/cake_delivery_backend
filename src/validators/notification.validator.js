const Joi = require('joi');

const objectIdSchema = Joi.string().hex().length(24);

const listNotificationsSchema = Joi.object({
  body: Joi.object().optional(),
  params: Joi.object().optional(),
  query: Joi.object({
    page: Joi.number().integer().min(1).optional(),
    limit: Joi.number().integer().min(1).max(100).optional(),
    unreadOnly: Joi.alternatives()
      .try(Joi.boolean(), Joi.string().valid('true', 'false', '1', '0'))
      .optional(),
  }).optional(),
});

const notificationIdSchema = Joi.object({
  body: Joi.object().optional(),
  params: Joi.object({
    id: objectIdSchema.required(),
  }).required(),
  query: Joi.object().optional(),
});

const readAllNotificationsSchema = Joi.object({
  body: Joi.object().optional(),
  params: Joi.object().optional(),
  query: Joi.object().optional(),
});

module.exports = {
  listNotificationsSchema,
  notificationIdSchema,
  readAllNotificationsSchema,
};
