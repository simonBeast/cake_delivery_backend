const mongoose = require('mongoose');
const ApiError = require('../utils/apiError');

const isProduction = process.env.NODE_ENV === 'production';

const getDuplicateKeyDetails = (mongoError = {}) => {
  const fields = Object.keys(mongoError.keyPattern || {});
  const values = mongoError.keyValue || {};

  return fields.map((field) => ({
    field,
    value: values[field],
    message: `${field} already exists`,
  }));
};

const normalizeError = (err) => {
  if (err instanceof ApiError) {
    return {
      statusCode: err.statusCode,
      message: err.message,
      code: err.code,
      details: err.details,
      isOperational: err.isOperational,
    };
  }

  if (err instanceof mongoose.Error.ValidationError) {
    const details = Object.values(err.errors).map((item) => ({
      field: item.path,
      message: item.message,
      kind: item.kind,
    }));

    return {
      statusCode: 400,
      message: 'Validation failed',
      code: 'MONGOOSE_VALIDATION_ERROR',
      details,
      isOperational: true,
    };
  }

  if (err instanceof mongoose.Error.CastError) {
    return {
      statusCode: 400,
      message: `Invalid ${err.path} format`,
      code: 'INVALID_IDENTIFIER',
      details: [{ field: err.path, value: err.value }],
      isOperational: true,
    };
  }

  if (err && err.code === 11000) {
    return {
      statusCode: 409,
      message: 'Duplicate key error',
      code: 'DUPLICATE_KEY',
      details: getDuplicateKeyDetails(err),
      isOperational: true,
    };
  }

  if (err && err.name === 'JsonWebTokenError') {
    return {
      statusCode: 401,
      message: 'Invalid authentication token',
      code: 'INVALID_TOKEN',
      isOperational: true,
    };
  }

  if (err && err.name === 'TokenExpiredError') {
    return {
      statusCode: 401,
      message: 'Authentication token expired',
      code: 'TOKEN_EXPIRED',
      isOperational: true,
    };
  }

  if (err && err.name === 'MulterError') {
    return {
      statusCode: 400,
      message: err.message,
      code: 'UPLOAD_ERROR',
      isOperational: true,
    };
  }

  if (err && err.message === 'Only image files are allowed') {
    return {
      statusCode: 400,
      message: err.message,
      code: 'INVALID_FILE_TYPE',
      isOperational: true,
    };
  }

  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    return {
      statusCode: 400,
      message: 'Malformed JSON payload',
      code: 'MALFORMED_JSON',
      isOperational: true,
    };
  }

  return {
    statusCode: 500,
    message: 'Internal Server Error',
    code: 'INTERNAL_SERVER_ERROR',
    isOperational: false,
  };
};

module.exports = (err, req, res, _next) => {
  const normalized = normalizeError(err);

  if (!isProduction || !normalized.isOperational) {
    console.error('[ErrorMiddleware]', {
      method: req.method,
      path: req.originalUrl,
      statusCode: normalized.statusCode,
      code: normalized.code,
      message: err.message,
      stack: err.stack,
    });
  }

  const response = {
    success: false,
    message: normalized.message,
    code: normalized.code,
  };

  if (normalized.details) {
    response.errors = normalized.details;
  }

  if (!isProduction) {
    response.stack = err.stack;
  }

  res.status(normalized.statusCode).json(response);
};
