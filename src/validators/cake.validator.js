const Joi = require('joi');

const cakeBodySchema = Joi.object({
  name: Joi.string().trim().min(2).max(120),
  description: Joi.string().trim().allow('').max(500),
  price: Joi.number().greater(0),
  isAvailable: Joi.boolean(),
  primaryImageIndex: Joi.number().integer().min(0),
  primaryImage: Joi.string().trim().allow(''),
  clearImages: Joi.boolean(),
});

const createCakeSchema = Joi.object({
  body: cakeBodySchema.keys({
    name: Joi.string().trim().min(2).max(120).required(),
    price: Joi.number().greater(0).required(),
  }).required(),
  query: Joi.object().optional(),
  params: Joi.object().optional(),
});

const updateCakeSchema = Joi.object({
  body: cakeBodySchema.min(1).required(),
  params: Joi.object({
    id: Joi.string().hex().length(24).required(),
  }).required(),
  query: Joi.object().optional(),
});

const listCakesSchema = Joi.object({
  body: Joi.object().optional(),
  params: Joi.object().optional(),
  query: Joi.object({
    page: Joi.number().integer().min(1).optional(),
    limit: Joi.number().integer().min(1).max(100).optional(),
    search: Joi.string().trim().max(120).optional(),
    minPrice: Joi.number().min(0).optional(),
    maxPrice: Joi.number().min(0).optional(),
    isAvailable: Joi.boolean().optional(),
    sortBy: Joi.string().valid('createdAt', 'price', 'name').optional(),
    sortOrder: Joi.string().valid('asc', 'desc').optional(),
  }).optional(),
});

module.exports = {
  createCakeSchema,
  updateCakeSchema,
  listCakesSchema,
};
