const ApiError = require('../utils/apiError');

const allowRoles = (...roles) => {
  return (req, _res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return next(new ApiError(403, 'Forbidden'));
    }

    return next();
  };
};

module.exports = {
  allowRoles,
};
