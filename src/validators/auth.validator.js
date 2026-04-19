const Joi = require('joi');

const registerSchema = Joi.object({
  body: Joi.object({
    name: Joi.string().trim().min(2).max(80).required(),
    email: Joi.string().email().required(),
    password: Joi.string().min(6).max(100).required(),
    phone: Joi.string().trim().max(30).required(),
    role: Joi.string().trim().uppercase().valid('CUSTOMER', 'DELIVERY').optional(),
  }).required(),
  query: Joi.object().optional(),
  params: Joi.object().optional(),
});

const loginSchema = Joi.object({
  body: Joi.object({
    email: Joi.string().email().required(),
    password: Joi.string().min(6).max(100).required(),
  }).required(),
  query: Joi.object().optional(),
  params: Joi.object().optional(),
});

const verifyEmailSchema = Joi.object({
  body: Joi.object({
    email: Joi.string().email().required(),
    code: Joi.string().trim().length(6).required(),
  }).required(),
  query: Joi.object().optional(),
  params: Joi.object().optional(),
});

const forgotPasswordSchema = Joi.object({
  body: Joi.object({
    email: Joi.string().email().required(),
  }).required(),
  query: Joi.object().optional(),
  params: Joi.object().optional(),
});

const resetPasswordSchema = Joi.object({
  body: Joi.object({
    email: Joi.string().email().required(),
    code: Joi.string().trim().length(6).required(),
    newPassword: Joi.string().min(6).max(100).required(),
  }).required(),
  query: Joi.object().optional(),
  params: Joi.object().optional(),
});

module.exports = {
  registerSchema,
  verifyEmailSchema,
  loginSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
};
