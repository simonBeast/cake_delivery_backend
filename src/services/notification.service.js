const mongoose = require('mongoose');

const Notification = require('../models/notification.model');
const User = require('../models/user.model');
const { emitNotificationCreated } = require('../realtime/socket');

const toEntityId = (value) => {
  if (!value) {
    return '';
  }

  if (typeof value === 'string') {
    return value;
  }

  if (typeof value === 'object') {
    if (value._id) {
      return String(value._id);
    }

    if (value.id) {
      return String(value.id);
    }
  }

  return String(value);
};

const normalizeRecipientIds = (recipientIds = []) => {
  const unique = new Set(
    recipientIds
      .map((value) => toEntityId(value))
      .filter((value) => mongoose.Types.ObjectId.isValid(value)),
  );

  return Array.from(unique);
};

const createNotifications = async ({
  recipientIds,
  title,
  message,
  type = 'SYSTEM',
  orderId = null,
  data = {},
}) => {
  const normalizedRecipientIds = normalizeRecipientIds(recipientIds);

  if (normalizedRecipientIds.length === 0) {
    return [];
  }

  const docs = normalizedRecipientIds.map((recipientId) => ({
    recipient: recipientId,
    title,
    message,
    type,
    order: orderId,
    data,
  }));

  const created = await Notification.insertMany(docs);

  created.forEach((notification) => {
    emitNotificationCreated(notification);
  });

  return created;
};

const createNotificationsForRole = async ({ role, ...payload }) => {
  const users = await User.find({ role }).select('_id');
  const recipientIds = users.map((user) => user._id);

  return createNotifications({
    ...payload,
    recipientIds,
  });
};

module.exports = {
  createNotifications,
  createNotificationsForRole,
};
