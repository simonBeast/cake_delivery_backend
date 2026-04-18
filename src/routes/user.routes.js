const express = require('express');

const {
  getMyProfile,
  updateMyProfile,
  createUser,
  deleteUser,
  getDeliveryUsers,
  getUsers,
  updateUser,
} = require('../controllers/user.controller');
const authMiddleware = require('../middleware/auth.middleware');
const { allowRoles } = require('../middleware/role.middleware');
const validateRequest = require('../middleware/validateRequest.middleware');
const {
  createUserSchema,
  deleteUserSchema,
  myProfileSchema,
  updateMyProfileSchema,
  updateUserSchema,
  userListSchema,
} = require('../validators/user.validator');

const router = express.Router();

router.get(
  '/me',
  authMiddleware,
  validateRequest(myProfileSchema),
  getMyProfile,
);

router.put(
  '/me',
  authMiddleware,
  validateRequest(updateMyProfileSchema),
  updateMyProfile,
);

router.get(
  '/',
  authMiddleware,
  allowRoles('ADMIN'),
  validateRequest(userListSchema),
  getUsers,
);

router.post(
  '/',
  authMiddleware,
  allowRoles('ADMIN'),
  validateRequest(createUserSchema),
  createUser,
);

router.put(
  '/:id',
  authMiddleware,
  allowRoles('ADMIN'),
  validateRequest(updateUserSchema),
  updateUser,
);

router.delete(
  '/:id',
  authMiddleware,
  allowRoles('ADMIN'),
  validateRequest(deleteUserSchema),
  deleteUser,
);

router.get(
  '/delivery',
  authMiddleware,
  allowRoles('ADMIN'),
  validateRequest(userListSchema),
  getDeliveryUsers,
);

module.exports = router;
