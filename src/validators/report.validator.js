const Joi = require('joi');

const summaryQuerySchema = Joi.object({
  body: Joi.object().optional(),
  params: Joi.object().optional(),
  query: Joi.object({
    period: Joi.string()
      .valid('today', 'week', 'month', 'quarter', 'year')
      .optional(),
  }).optional(),
});

module.exports = {
  summaryQuerySchema,
};
