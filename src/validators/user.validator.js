const Joi = require('joi');

const userListSchema = Joi.object({
  body: Joi.object().optional(),
  params: Joi.object().optional(),
  query: Joi.object({
    page: Joi.number().integer().min(1).optional(),
    limit: Joi.number().integer().min(1).max(100).optional(),
    role: Joi.string().valid('CUSTOMER', 'ADMIN', 'DELIVERY').optional(),
    search: Joi.string().trim().max(120).optional(),
  }).optional(),
});

const userBodySchema = Joi.object({
  name: Joi.string().trim().min(2).max(80).optional(),
  email: Joi.string().email().optional(),
  password: Joi.string().min(6).max(100).optional(),
  phone: Joi.string().trim().max(40).optional(),
  role: Joi.string().valid('CUSTOMER', 'ADMIN', 'DELIVERY').optional(),
});

const createUserSchema = Joi.object({
  body: userBodySchema
    .keys({
      name: Joi.string().trim().min(2).max(80).required(),
      email: Joi.string().email().required(),
      password: Joi.string().min(6).max(100).required(),
      phone: Joi.string().trim().max(40).required(),
      role: Joi.string().valid('CUSTOMER', 'ADMIN', 'DELIVERY').required(),
    })
    .required(),
  params: Joi.object().optional(),
  query: Joi.object().optional(),
});

const updateUserSchema = Joi.object({
  body: userBodySchema.min(1).required(),
  params: Joi.object({
    id: Joi.string().hex().length(24).required(),
  }).required(),
  query: Joi.object().optional(),
});

const deleteUserSchema = Joi.object({
  body: Joi.object().optional(),
  params: Joi.object({
    id: Joi.string().hex().length(24).required(),
  }).required(),
  query: Joi.object().optional(),
});

const myProfileSchema = Joi.object({
  body: Joi.object().optional(),
  params: Joi.object().optional(),
  query: Joi.object().optional(),
});

const updateMyProfileSchema = Joi.object({
  body: Joi.object({
    name: Joi.string().trim().min(2).max(80).optional(),
    email: Joi.string().email().optional(),
    password: Joi.string().min(6).max(100).optional(),
    phone: Joi.string().trim().allow('').max(40).optional(),
  }).min(1).required(),
  params: Joi.object().optional(),
  query: Joi.object().optional(),
});

module.exports = {
  userListSchema,
  createUserSchema,
  updateUserSchema,
  deleteUserSchema,
  myProfileSchema,
  updateMyProfileSchema,
};
