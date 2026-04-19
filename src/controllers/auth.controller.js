const jwt = require('jsonwebtoken');
const crypto = require('crypto');

const User = require('../models/user.model');
const ApiError = require('../utils/apiError');
const catchAsync = require('../utils/catchAsync');
const { isMailerConfigured, sendEmail } = require('../utils/mailer');

const createToken = (user) => {
  return jwt.sign(
    {
      userId: user._id,
      role: user.role,
    },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' },
  );
};

const sanitizeUser = (user) => ({
  id: user._id,
  name: user.name,
  email: user.email,
  role: user.role,
  phone: user.phone || '',
  emailVerified: user.emailVerified !== false,
});

const buildNumericCode = () => String(Math.floor(100000 + Math.random() * 900000));

const hashCode = (code) => crypto.createHash('sha256').update(code).digest('hex');

const sendVerificationCodeEmail = async ({ to, name, code }) => {
  const subject = 'Verify your Cake Delivery account';
  const text = [
    `Hi ${name || 'there'},`,
    '',
    `Your email verification code is: ${code}`,
    'This code expires in 15 minutes.',
    '',
    'If you did not create this account, you can ignore this email.',
  ].join('\n');

  const html = `
    <p>Hi ${name || 'there'},</p>
    <p>Your email verification code is:</p>
    <h2 style="letter-spacing: 2px;">${code}</h2>
    <p>This code expires in 15 minutes.</p>
    <p>If you did not create this account, you can ignore this email.</p>
  `;

  return sendEmail({ to, subject, text, html });
};

const sendResetCodeEmail = async ({ to, name, code }) => {
  const subject = 'Cake Delivery password reset code';
  const text = [
    `Hi ${name || 'there'},`,
    '',
    `Your password reset code is: ${code}`,
    'This code expires in 15 minutes.',
    '',
    'If you did not request this, you can ignore this email.',
  ].join('\n');

  const html = `
    <p>Hi ${name || 'there'},</p>
    <p>Your password reset code is:</p>
    <h2 style="letter-spacing: 2px;">${code}</h2>
    <p>This code expires in 15 minutes.</p>
    <p>If you did not request this, you can ignore this email.</p>
  `;

  return sendEmail({ to, subject, text, html });
};

const register = catchAsync(async (req, res, next) => {
  const { name, email, password, phone, role } = req.body;
  const normalizedEmail = String(email || '').toLowerCase();
  const normalizedRole =
    String(role || 'CUSTOMER').trim().toUpperCase() === 'DELIVERY'
      ? 'DELIVERY'
      : 'CUSTOMER';

  if (!name || !email || !password || !String(phone || '').trim()) {
    return next(new ApiError(400, 'name, email, password, and phone are required'));
  }

  const existing = await User.findOne({ email: normalizedEmail }).select(
    '+emailVerificationCode +emailVerificationExpires +password',
  );

  const verificationCode = buildNumericCode();
  const verificationCodeHash = hashCode(verificationCode);
  const verificationExpires = new Date(Date.now() + 15 * 60 * 1000);

  let user = existing;

  if (existing && existing.emailVerified !== false) {
    return next(new ApiError(409, 'Email already in use'));
  }

  if (existing && existing.emailVerified === false) {
    existing.name = name;
    existing.phone = String(phone).trim();
    existing.role = normalizedRole;
    existing.password = password;
    existing.emailVerificationCode = verificationCodeHash;
    existing.emailVerificationExpires = verificationExpires;
    await existing.save();
  } else {
    user = await User.create({
      name,
      email: normalizedEmail,
      password,
      phone: String(phone).trim(),
      role: normalizedRole,
      emailVerified: false,
      emailVerificationCode: verificationCodeHash,
      emailVerificationExpires: verificationExpires,
    });
  }

  if (isMailerConfigured()) {
    await sendVerificationCodeEmail({
      to: normalizedEmail,
      name,
      code: verificationCode,
    });

    return res.status(existing ? 200 : 201).json({
      success: true,
      message: 'Verification code sent to your email.',
      requiresEmailVerification: true,
      email: normalizedEmail,
    });
  }

  return res.status(existing ? 200 : 201).json({
    success: true,
    message:
      'Verification code generated. Configure SMTP env vars to send emails automatically.',
    requiresEmailVerification: true,
    email: normalizedEmail,
    verificationCode,
  });
});

const verifyEmail = catchAsync(async (req, res, next) => {
  const { email, code } = req.body;
  const normalizedEmail = String(email || '').toLowerCase();

  const user = await User.findOne({ email: normalizedEmail }).select(
    '+emailVerificationCode +emailVerificationExpires',
  );

  if (!user) {
    return next(new ApiError(400, 'Invalid or expired verification code'));
  }

  if (user.emailVerified === true) {
    const token = createToken(user);

    return res.json({
      success: true,
      token,
      user: sanitizeUser(user),
      message: 'Email is already verified.',
    });
  }

  if (!user.emailVerificationCode || !user.emailVerificationExpires) {
    return next(new ApiError(400, 'Invalid or expired verification code'));
  }

  if (user.emailVerificationExpires.getTime() < Date.now()) {
    return next(new ApiError(400, 'Verification code expired'));
  }

  const codeHash = hashCode(String(code || ''));

  if (codeHash !== user.emailVerificationCode) {
    return next(new ApiError(400, 'Invalid verification code'));
  }

  user.emailVerified = true;
  user.emailVerificationCode = null;
  user.emailVerificationExpires = null;
  await user.save();

  const token = createToken(user);

  return res.json({
    success: true,
    token,
    user: sanitizeUser(user),
    message: 'Email verified successfully.',
  });
});

const login = catchAsync(async (req, res, next) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return next(new ApiError(400, 'email and password are required'));
  }

  const user = await User.findOne({ email: email.toLowerCase() });
  if (!user) {
    return next(new ApiError(401, 'Invalid credentials'));
  }

  const isMatch = await user.comparePassword(password);
  if (!isMatch) {
    return next(new ApiError(401, 'Invalid credentials'));
  }

  if (user.emailVerified === false) {
    return next(new ApiError(403, 'Email not verified. Please verify your email first.'));
  }

  const token = createToken(user);

  return res.json({
    success: true,
    token,
    user: sanitizeUser(user),
  });
});

const forgotPassword = catchAsync(async (req, res) => {
  const { email } = req.body;

  const user = await User.findOne({ email: email.toLowerCase() }).select(
    '+passwordResetCode +passwordResetExpires',
  );

  if (!user) {
    return res.json({
      success: true,
      message: 'If the email exists, a reset code has been generated.',
    });
  }

  const code = String(Math.floor(100000 + Math.random() * 900000));
  const codeHash = hashCode(code);

  user.passwordResetCode = codeHash;
  user.passwordResetExpires = new Date(Date.now() + 15 * 60 * 1000);
  await user.save();

  if (isMailerConfigured()) {
    await sendResetCodeEmail({
      to: user.email,
      name: user.name,
      code,
    });

    return res.json({
      success: true,
      message: 'If the email exists, a reset code has been sent.',
    });
  }

  return res.json({
    success: true,
    message:
      'Reset code generated. Configure SMTP env vars to send emails automatically.',
    resetCode: code,
  });
});

const resetPassword = catchAsync(async (req, res, next) => {
  const { email, code, newPassword } = req.body;

  const user = await User.findOne({ email: email.toLowerCase() }).select(
    '+passwordResetCode +passwordResetExpires',
  );

  if (!user || !user.passwordResetCode || !user.passwordResetExpires) {
    return next(new ApiError(400, 'Invalid or expired reset code'));
  }

  if (user.passwordResetExpires.getTime() < Date.now()) {
    return next(new ApiError(400, 'Reset code expired'));
  }

  const codeHash = hashCode(code);

  if (codeHash !== user.passwordResetCode) {
    return next(new ApiError(400, 'Invalid reset code'));
  }

  user.password = newPassword;
  user.passwordResetCode = null;
  user.passwordResetExpires = null;
  await user.save();

  return res.json({
    success: true,
    message: 'Password reset successful. Please login again.',
  });
});

module.exports = {
  register,
  verifyEmail,
  login,
  forgotPassword,
  resetPassword,
};
