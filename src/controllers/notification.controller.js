const Notification = require('../models/notification.model');
const ApiError = require('../utils/apiError');
const catchAsync = require('../utils/catchAsync');
const { buildPaginationMeta, parsePagination } = require('../utils/pagination');

const parseBoolean = (value) => {
  if (typeof value === 'boolean') {
    return value;
  }

  const normalized = String(value || '').trim().toLowerCase();
  return normalized === 'true' || normalized === '1';
};

const getMyNotifications = catchAsync(async (req, res) => {
  const { page, limit, skip } = parsePagination(req.query);
  const unreadOnly = parseBoolean(req.query.unreadOnly);

  const query = {
    recipient: req.user._id,
  };

  if (unreadOnly) {
    query.isRead = false;
  }

  const [notifications, total] = await Promise.all([
    Notification.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit),
    Notification.countDocuments(query),
  ]);

  return res.json({
    success: true,
    data: notifications,
    pagination: buildPaginationMeta({ page, limit, total }),
  });
});

const getUnreadCount = catchAsync(async (req, res) => {
  const count = await Notification.countDocuments({
    recipient: req.user._id,
    isRead: false,
  });

  return res.json({
    success: true,
    data: { count },
  });
});

const markNotificationAsRead = catchAsync(async (req, res, next) => {
  const { id } = req.params;

  const notification = await Notification.findOne({
    _id: id,
    recipient: req.user._id,
  });

  if (!notification) {
    return next(new ApiError(404, 'Notification not found'));
  }

  if (!notification.isRead) {
    notification.isRead = true;
    notification.readAt = new Date();
    await notification.save();
  }

  return res.json({
    success: true,
    data: notification,
  });
});

const markAllNotificationsAsRead = catchAsync(async (req, res) => {
  const readAt = new Date();

  const result = await Notification.updateMany(
    {
      recipient: req.user._id,
      isRead: false,
    },
    {
      $set: {
        isRead: true,
        readAt,
      },
    },
  );

  return res.json({
    success: true,
    data: {
      updatedCount: result.modifiedCount || 0,
    },
  });
});

module.exports = {
  getMyNotifications,
  getUnreadCount,
  markNotificationAsRead,
  markAllNotificationsAsRead,
};
