class ApiError extends Error {
  constructor(statusCode, message, options = {}) {
    super(message);

    const {
      code,
      details,
      isOperational = true,
    } = options;

    this.statusCode = statusCode;
    this.name = 'ApiError';
    this.code = code || 'API_ERROR';
    this.details = details;
    this.isOperational = isOperational;

    Error.captureStackTrace(this, this.constructor);
  }
}

module.exports = ApiError;
