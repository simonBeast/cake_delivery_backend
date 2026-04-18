const express = require('express');

const {
  getMyNotifications,
  getUnreadCount,
  markNotificationAsRead,
  markAllNotificationsAsRead,
} = require('../controllers/notification.controller');
const authMiddleware = require('../middleware/auth.middleware');
const validateRequest = require('../middleware/validateRequest.middleware');
const {
  listNotificationsSchema,
  notificationIdSchema,
  readAllNotificationsSchema,
} = require('../validators/notification.validator');

const router = express.Router();

router.get(
  '/',
  authMiddleware,
  validateRequest(listNotificationsSchema),
  getMyNotifications,
);

router.get(
  '/unread-count',
  authMiddleware,
  validateRequest(readAllNotificationsSchema),
  getUnreadCount,
);

router.patch(
  '/:id/read',
  authMiddleware,
  validateRequest(notificationIdSchema),
  markNotificationAsRead,
);

router.patch(
  '/read-all',
  authMiddleware,
  validateRequest(readAllNotificationsSchema),
  markAllNotificationsAsRead,
);

module.exports = router;
