const express = require('express');

const {
	forgotPassword,
	login,
	register,
	resetPassword,
	verifyEmail,
} = require('../controllers/auth.controller');
const validateRequest = require('../middleware/validateRequest.middleware');
const {
	forgotPasswordSchema,
	loginSchema,
	registerSchema,
	resetPasswordSchema,
	verifyEmailSchema,
} = require('../validators/auth.validator');

const router = express.Router();

router.post('/register', validateRequest(registerSchema), register);
router.post('/verify-email', validateRequest(verifyEmailSchema), verifyEmail);
router.post('/login', validateRequest(loginSchema), login);
router.post('/forgot-password', validateRequest(forgotPasswordSchema), forgotPassword);
router.post('/reset-password', validateRequest(resetPasswordSchema), resetPassword);

module.exports = router;
