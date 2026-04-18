const jwt = require('jsonwebtoken');

const User = require('../models/user.model');
const ApiError = require('../utils/apiError');

const authMiddleware = async (req, _res, next) => {
  const authHeader = req.headers.authorization || '';

  if (!authHeader.startsWith('Bearer ')) {
    return next(new ApiError(401, 'Unauthorized: missing token'));
  }

  const token = authHeader.slice(7);

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const user = await User.findById(decoded.userId).select('-password');

    if (!user) {
      return next(new ApiError(401, 'Unauthorized: user not found'));
    }

    req.user = user;
    return next();
  } catch {
    return next(new ApiError(401, 'Unauthorized: invalid token'));
  }
};

module.exports = authMiddleware;
