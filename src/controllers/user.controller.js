const User = require('../models/user.model');
const ApiError = require('../utils/apiError');
const catchAsync = require('../utils/catchAsync');
const { buildPaginationMeta, parsePagination } = require('../utils/pagination');

const getUsers = catchAsync(async (req, res) => {
  const { page, limit, skip } = parsePagination(req.query);
  const { role, search } = req.query || {};

  const query = role ? { role } : {};

  if (search) {
    query.$or = [
      { name: { $regex: search, $options: 'i' } },
      { email: { $regex: search, $options: 'i' } },
    ];
  }

  const [users, total] = await Promise.all([
    User.find(query)
      .select('-password')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit),
    User.countDocuments(query),
  ]);

  return res.json({
    success: true,
    data: users,
    pagination: buildPaginationMeta({ page, limit, total }),
  });
});

const getDeliveryUsers = catchAsync(async (req, res) => {
  const { page, limit, skip } = parsePagination(req.query);

  const query = { role: 'DELIVERY' };

  const [users, total] = await Promise.all([
    User.find(query)
      .select('-password')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit),
    User.countDocuments(query),
  ]);

  return res.json({
    success: true,
    data: users,
    pagination: buildPaginationMeta({ page, limit, total }),
  });
});

const getMyProfile = catchAsync(async (req, res) => {
  const user = await User.findById(req.user._id).select('-password');

  return res.json({
    success: true,
    data: user,
  });
});

const updateMyProfile = catchAsync(async (req, res, next) => {
  const { name, email, password, phone } = req.body;

  const user = await User.findById(req.user._id).select('+password');
  if (!user) {
    return next(new ApiError(404, 'User not found'));
  }

  if (email && email.toLowerCase() !== user.email) {
    const emailTaken = await User.findOne({ email: email.toLowerCase() });
    if (emailTaken) {
      return next(new ApiError(409, 'Email already exists'));
    }
    user.email = email.toLowerCase();
  }

  if (name !== undefined) user.name = name;
  if (phone !== undefined) {
    const normalizedPhone = String(phone).trim();
    if (!normalizedPhone) {
      return next(new ApiError(400, 'phone cannot be empty'));
    }
    user.phone = normalizedPhone;
  }
  if (password !== undefined) user.password = password;

  await user.save();

  const userObject = user.toObject();
  delete userObject.password;

  return res.json({ success: true, data: userObject });
});

const createUser = catchAsync(async (req, res, next) => {
  const { name, email, password, phone, role } = req.body;

  if (!String(phone || '').trim()) {
    return next(new ApiError(400, 'phone is required'));
  }

  const existing = await User.findOne({ email: email.toLowerCase() });
  if (existing) {
    return next(new ApiError(409, 'Email already exists'));
  }

  const user = await User.create({
    name,
    email: email.toLowerCase(),
    password,
    phone: String(phone).trim(),
    role,
  });

  const userObject = user.toObject();
  delete userObject.password;

  return res.status(201).json({
    success: true,
    data: userObject,
  });
});

const updateUser = catchAsync(async (req, res, next) => {
  const { id } = req.params;
  const { name, email, password, phone, role } = req.body;

  const user = await User.findById(id).select('+password');
  if (!user) {
    return next(new ApiError(404, 'User not found'));
  }

  if (email && email.toLowerCase() !== user.email) {
    const emailTaken = await User.findOne({ email: email.toLowerCase() });
    if (emailTaken) {
      return next(new ApiError(409, 'Email already exists'));
    }
    user.email = email.toLowerCase();
  }

  if (name !== undefined) user.name = name;
  if (phone !== undefined) {
    const normalizedPhone = String(phone).trim();
    if (!normalizedPhone) {
      return next(new ApiError(400, 'phone cannot be empty'));
    }
    user.phone = normalizedPhone;
  }
  if (role !== undefined) user.role = role;
  if (password !== undefined) user.password = password;

  await user.save();

  const userObject = user.toObject();
  delete userObject.password;

  return res.json({ success: true, data: userObject });
});

const deleteUser = catchAsync(async (req, res, next) => {
  const { id } = req.params;

  if (String(req.user._id) === String(id)) {
    return next(new ApiError(400, 'Admin cannot delete own account'));
  }

  const user = await User.findByIdAndDelete(id);

  if (!user) {
    return next(new ApiError(404, 'User not found'));
  }

  return res.json({ success: true, message: 'User deleted' });
});

module.exports = {
  getUsers,
  getDeliveryUsers,
  getMyProfile,
  updateMyProfile,
  createUser,
  updateUser,
  deleteUser,
};
