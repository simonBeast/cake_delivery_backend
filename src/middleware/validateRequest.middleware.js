const ApiError = require('../utils/apiError');

const validateRequest = (schema) => {
  return (req, _res, next) => {
    const payload = {
      body: req.body || {},
      query: req.query || {},
      params: req.params || {},
    };

    const { error, value } = schema.validate(payload, {
      abortEarly: false,
      allowUnknown: true,
      stripUnknown: false,
    });

    if (error) {
      const details = error.details.map((detail) => ({
        message: detail.message,
        path: detail.path,
        type: detail.type,
      }));

      return next(
        new ApiError(400, 'Validation failed', {
          code: 'VALIDATION_ERROR',
          details,
        }),
      );
    }

    req.body = value.body;
    req.query = value.query;
    req.params = value.params;

    return next();
  };
};

module.exports = validateRequest;
