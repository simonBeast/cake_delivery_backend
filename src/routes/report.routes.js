const express = require('express');

const { getSummary } = require('../controllers/report.controller');
const authMiddleware = require('../middleware/auth.middleware');
const { allowRoles } = require('../middleware/role.middleware');
const validateRequest = require('../middleware/validateRequest.middleware');
const { summaryQuerySchema } = require('../validators/report.validator');

const router = express.Router();

router.get(
	'/summary',
	authMiddleware,
	allowRoles('ADMIN'),
	validateRequest(summaryQuerySchema),
	getSummary,
);

module.exports = router;
