const mongoose = require('mongoose');

const Cake = require('../models/cake.model');
const Order = require('../models/order.model');
const User = require('../models/user.model');
const ApiError = require('../utils/apiError');
const catchAsync = require('../utils/catchAsync');
const { buildPaginationMeta, parsePagination } = require('../utils/pagination');
const { toPublicImagePath } = require('../middleware/upload.middleware');
const {
  isCloudinaryConfigured,
  uploadImageFromPath,
} = require('../utils/cloudinary');
const {
  emitOrderAssigned,
  emitOrderCreated,
  emitOrderDelivered,
  emitOrderPaymentUpdated,
  emitOrderStatusUpdated,
} = require('../realtime/socket');
const {
  createNotifications,
  createNotificationsForRole,
} = require('../services/notification.service');

const validStatuses = ['PENDING', 'PREPARING', 'OUT_FOR_DELIVERY', 'DELIVERED', 'DECLINED'];
const validOrderTypes = ['PREDEFINED', 'CUSTOM'];
const validPaymentMethods = ['CASH', 'SIMULATED_CARD', 'SIMULATED_TRANSFER'];
const unresolvedPaymentStatuses = ['PENDING', 'PENDING_PROOF', 'SUBMITTED', 'REJECTED'];
const quoteLockStatuses = ['OUT_FOR_DELIVERY', 'DELIVERED', 'DECLINED'];
const assignmentBlockThresholdHours = 24;
const assignmentBlockUnresolvedLimit = 3;
const canonicalOrderItemSizes = ['1KG', '2KG', '3KG', '4KG'];
const legacyOrderSizeToKgMap = {
  SMALL: '1KG',
  MEDIUM: '2KG',
  LARGE: '3KG',
  CUSTOM: '4KG',
};

const orderStatusLabelMap = {
  PENDING: 'Pending',
  PREPARING: 'Preparing',
  OUT_FOR_DELIVERY: 'Out for delivery',
  DELIVERED: 'Delivered',
  DECLINED: 'Declined',
};

const paymentMethodLabelMap = {
  CASH: 'cash',
  SIMULATED_CARD: 'card',
  SIMULATED_TRANSFER: 'bank transfer',
};

const isCashPayment = (method) => method === 'CASH';

const ensurePaymentShape = (order) => {
  if (!order.payment) {
    order.payment = {
      method: 'CASH',
      status: 'PENDING_PROOF',
    };
  }

  if (!Array.isArray(order.payment.auditTrail)) {
    order.payment.auditTrail = [];
  }

  if (!order.payment.status) {
    order.payment.status = 'PENDING_PROOF';
  }

  if (typeof order.payment.bankName !== 'string') {
    order.payment.bankName = '';
  }

  if (typeof order.payment.rejectionReason !== 'string') {
    order.payment.rejectionReason = '';
  }

  if (!Number.isFinite(Number(order.payment.proofVersion))) {
    order.payment.proofVersion = 0;
  }
};

const appendPaymentAudit = ({
  order,
  action,
  actorId,
  note = '',
  bankName = '',
  transactionRef = null,
  proofImage = null,
}) => {
  ensurePaymentShape(order);
  order.payment.auditTrail.push({
    action,
    by: actorId || null,
    at: new Date(),
    note,
    bankName,
    transactionRef,
    proofImage,
  });
};

const getEntityId = (value) => {
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

const getEntityName = (value, fallback = '') => {
  if (!value || typeof value !== 'object') {
    return fallback;
  }

  return String(value.name || '').trim() || fallback;
};

const withNotificationsSafety = async (task) => {
  try {
    await task();
  } catch (error) {
    console.error('Failed to create notifications:', error);
  }
};

const getOrderRef = (order) => {
  const rawId = String(order?._id || '').trim();
  return rawId ? rawId.slice(-6) : '------';
};

const getParticipantRecipientIds = (order) => {
  return [getEntityId(order.customer), getEntityId(order.deliveryPerson)].filter(Boolean);
};

const notifyParticipantsAndAdmins = async ({
  order,
  title,
  message,
  type,
  actorId = null,
  data = {},
}) => {
  const excludeRecipientIds = actorId ? [actorId] : [];

  await Promise.all([
    createNotifications({
      recipientIds: getParticipantRecipientIds(order),
      excludeRecipientIds,
      title,
      message,
      type,
      orderId: order._id,
      data,
    }),
    createNotificationsForRole({
      role: 'ADMIN',
      excludeRecipientIds,
      title,
      message,
      type,
      orderId: order._id,
      data,
    }),
  ]);
};

const appendStatusHistory = (order, nextStatus, at = new Date()) => {
  if (!order.statusHistory) {
    order.statusHistory = [];
  }

  const lastStatus =
    order.statusHistory.length > 0
      ? order.statusHistory[order.statusHistory.length - 1].status
      : null;

  if (lastStatus !== nextStatus) {
    order.statusHistory.push({ status: nextStatus, at });
  }
};

const buildOrderQuery = ({ status, from, to, orderType }) => {
  const query = {};

  if (status) {
    query.status = status;
  }

  if (orderType && validOrderTypes.includes(String(orderType).toUpperCase())) {
    query.orderType = String(orderType).toUpperCase();
  }

  if (from || to) {
    query.createdAt = {};
    if (from) {
      query.createdAt.$gte = new Date(from);
    }
    if (to) {
      query.createdAt.$lte = new Date(to);
    }
  }

  return query;
};

const normalizeReferenceImagesFromFiles = async (files = []) => {
  if (!Array.isArray(files) || files.length === 0) {
    return [];
  }

  const uploaded = await Promise.all(
    files
      .filter((file) => Boolean(file?.path))
      .map(async (file) => {
        const normalizedPath = isCloudinaryConfigured()
          ? await uploadImageFromPath(file.path, {
            folder: 'cake-delivery/custom-orders',
          })
          : toPublicImagePath(file.path);

        return normalizedPath || null;
      }),
  );

  return uploaded.filter(Boolean);
};

const normalizeOrderItemSize = (value) => {
  const normalized = String(value || '').trim().toUpperCase();

  if (canonicalOrderItemSizes.includes(normalized)) {
    return normalized;
  }

  if (legacyOrderSizeToKgMap[normalized]) {
    return legacyOrderSizeToKgMap[normalized];
  }

  return '2KG';
};

const normalizeItemsFromRequest = (body = {}) => {
  if (Array.isArray(body.items) && body.items.length > 0) {
    return body.items.map((item) => ({
      cake: item.cake,
      quantity: Number(item.quantity),
      size: normalizeOrderItemSize(item.size),
      flavour: item.flavour || '',
      designNotes: item.designNotes || '',
    }));
  }

  if (body.cakeId) {
    return [
      {
        cake: body.cakeId,
        quantity: Number(body.quantity || 1),
        size: normalizeOrderItemSize(body.size),
        flavour: body.flavour || '',
        designNotes: body.designNotes || '',
      },
    ];
  }

  return [];
};

const normalizeDeliveryLocation = (value) => {
  if (!value) {
    return null;
  }

  let raw = value;

  if (typeof value === 'string') {
    try {
      raw = JSON.parse(value);
    } catch {
      throw new ApiError(400, 'deliveryLocation must be a valid object or JSON payload');
    }
  }

  if (!raw || typeof raw !== 'object') {
    return null;
  }

  const lat = Number(raw.lat);
  const lng = Number(raw.lng);

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    throw new ApiError(400, 'deliveryLocation lat/lng must be valid numbers');
  }

  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    throw new ApiError(400, 'deliveryLocation lat/lng out of valid range');
  }

  return {
    lat,
    lng,
    label: String(raw.label || '').trim(),
    placeId: String(raw.placeId || '').trim(),
  };
};

const createOrder = catchAsync(async (req, res, next) => {
  const payload = req.body || {};
  const { scheduledDeliveryTime = null, paymentMethod = 'CASH' } = payload;
  const orderType = String(payload.orderType || 'PREDEFINED').toUpperCase();
  const items = normalizeItemsFromRequest(payload);
  const deliveryLocation = normalizeDeliveryLocation(payload.deliveryLocation);
  const deliveryAddress = String(
    payload.deliveryAddress || deliveryLocation?.label || '',
  ).trim();

  if (!validOrderTypes.includes(orderType)) {
    return next(new ApiError(400, 'Invalid order type'));
  }

  if (!validPaymentMethods.includes(paymentMethod)) {
    return next(new ApiError(400, 'Invalid payment method'));
  }

  if (orderType === 'CUSTOM') {
    const description = String(payload.description || '').trim();
    const normalizedBudgetMin = payload.budgetMin === undefined || payload.budgetMin === ''
      ? null
      : Number(payload.budgetMin);
    const normalizedBudgetMax = payload.budgetMax === undefined || payload.budgetMax === ''
      ? null
      : Number(payload.budgetMax);
    const referenceImages = await normalizeReferenceImagesFromFiles(req.files || []);

    if (description.length < 8) {
      return next(new ApiError(400, 'Custom order description must be at least 8 characters'));
    }

    if (referenceImages.length === 0) {
      return next(new ApiError(400, 'At least one reference image is required for custom order'));
    }

    if (normalizedBudgetMin !== null && (!Number.isFinite(normalizedBudgetMin) || normalizedBudgetMin < 0)) {
      return next(new ApiError(400, 'budgetMin must be a valid non-negative number'));
    }

    if (normalizedBudgetMax !== null && (!Number.isFinite(normalizedBudgetMax) || normalizedBudgetMax < 0)) {
      return next(new ApiError(400, 'budgetMax must be a valid non-negative number'));
    }

    if (
      normalizedBudgetMin !== null
      && normalizedBudgetMax !== null
      && normalizedBudgetMax < normalizedBudgetMin
    ) {
      return next(new ApiError(400, 'budgetMax must be greater than or equal to budgetMin'));
    }

    const order = await Order.create({
      orderType: 'CUSTOM',
      customer: req.user._id,
      items: [],
      customRequest: {
        description,
        budgetMin: normalizedBudgetMin,
        budgetMax: normalizedBudgetMax,
        referenceImages,
      },
      totalPrice: 0,
      statusHistory: [{ status: 'PENDING', at: new Date() }],
      deliveryAddress,
      deliveryLocation,
      scheduledDeliveryTime: scheduledDeliveryTime ? new Date(scheduledDeliveryTime) : null,
      payment: {
        method: paymentMethod,
        status: 'PENDING_PROOF',
        transactionRef: null,
        paidAt: null,
      },
    });

    const populatedCustom = await Order.findById(order._id)
      .populate('customer', 'name email role phone')
      .populate('items.cake')
      .populate('deliveryPerson', 'name email role phone');

    emitOrderCreated(populatedCustom);
    await withNotificationsSafety(async () => {
      const customerName = getEntityName(populatedCustom.customer, 'a customer');
      await createNotificationsForRole({
        role: 'ADMIN',
        excludeRecipientIds: [req.user._id],
        title: 'New custom order request',
        message: `Custom order #${getOrderRef(populatedCustom)} was requested by ${customerName}.`,
        type: 'ORDER_CREATED',
        orderId: populatedCustom._id,
        data: {
          status: populatedCustom.status,
          orderType: populatedCustom.orderType,
        },
      });
    });

    return res.status(201).json({ success: true, data: populatedCustom });
  }

  if (items.length === 0) {
    return next(new ApiError(400, 'At least one order item is required'));
  }

  for (const item of items) {
    if (!mongoose.Types.ObjectId.isValid(item.cake)) {
      return next(new ApiError(400, 'Invalid cake id in items'));
    }

    if (!item.quantity || item.quantity < 1) {
      return next(new ApiError(400, 'Each item quantity must be at least 1'));
    }
  }

  const cakeIds = items.map((item) => item.cake);
  const cakes = await Cake.find({ _id: { $in: cakeIds }, isAvailable: true });

  if (cakes.length !== cakeIds.length) {
    return next(new ApiError(400, 'One or more cakes are unavailable'));
  }

  const cakeMap = new Map(cakes.map((cake) => [String(cake._id), cake]));

  const orderItems = items.map((item) => {
    const cake = cakeMap.get(String(item.cake));

    return {
      ...item,
      cakeName: cake?.name || '',
    };
  });

  const totalPrice = orderItems.reduce((sum, item) => {
    const cake = cakeMap.get(String(item.cake));
    return sum + cake.price * item.quantity;
  }, 0);

  const order = await Order.create({
    orderType: 'PREDEFINED',
    customer: req.user._id,
    items: orderItems,
    totalPrice,
    statusHistory: [{ status: 'PENDING', at: new Date() }],
    deliveryAddress,
    deliveryLocation,
    scheduledDeliveryTime: scheduledDeliveryTime ? new Date(scheduledDeliveryTime) : null,
    payment: {
      method: paymentMethod,
      status: 'PENDING_PROOF',
      transactionRef: null,
      paidAt: null,
    },
  });

  const populated = await Order.findById(order._id)
    .populate('customer', 'name email role phone')
    .populate('items.cake')
    .populate('deliveryPerson', 'name email role phone');

  emitOrderCreated(populated);
  await withNotificationsSafety(async () => {
    const customerName = getEntityName(populated.customer, 'a customer');
    await createNotificationsForRole({
      role: 'ADMIN',
      excludeRecipientIds: [req.user._id],
      title: 'New order placed',
      message: `Order #${getOrderRef(populated)} was placed by ${customerName}.`,
      type: 'ORDER_CREATED',
      orderId: populated._id,
      data: {
        status: populated.status,
      },
    });
  });

  return res.status(201).json({ success: true, data: populated });
});

const getAllOrders = catchAsync(async (req, res) => {
  const { page, limit, skip } = parsePagination(req.query);
  const query = buildOrderQuery(req.query);

  const [orders, total] = await Promise.all([
    Order.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate('customer', 'name email role phone')
      .populate('items.cake')
      .populate('deliveryPerson', 'name email role phone'),
    Order.countDocuments(query),
  ]);

  return res.json({
    success: true,
    data: orders,
    pagination: buildPaginationMeta({ page, limit, total }),
  });
});

const getMyOrders = catchAsync(async (req, res) => {
  const { page, limit, skip } = parsePagination(req.query);
  const query = {
    ...buildOrderQuery(req.query),
    customer: req.user._id,
  };

  const [orders, total] = await Promise.all([
    Order.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate('items.cake')
      .populate('deliveryPerson', 'name email role phone'),
    Order.countDocuments(query),
  ]);

  return res.json({
    success: true,
    data: orders,
    pagination: buildPaginationMeta({ page, limit, total }),
  });
});

const getDeliveryOrders = catchAsync(async (req, res) => {
  const { page, limit, skip } = parsePagination(req.query);
  const query = {
    ...buildOrderQuery(req.query),
    deliveryPerson: req.user._id,
  };

  const [orders, total] = await Promise.all([
    Order.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate('customer', 'name email role phone')
      .populate('items.cake'),
    Order.countDocuments(query),
  ]);

  return res.json({
    success: true,
    data: orders,
    pagination: buildPaginationMeta({ page, limit, total }),
  });
});

const updateStatus = catchAsync(async (req, res, next) => {
  const { id } = req.params;
  const { status } = req.body || {};

  if (!validStatuses.includes(status)) {
    return next(new ApiError(400, 'Invalid order status'));
  }

  const order = await Order.findById(id)
    .populate('customer', 'name email role phone')
    .populate('items.cake')
    .populate('deliveryPerson', 'name email role phone');

  if (!order) {
    return next(new ApiError(404, 'Order not found'));
  }

  if (order.orderType === 'CUSTOM' && Number(order.totalPrice || 0) <= 0) {
    return next(new ApiError(400, 'Set a quote price before assigning this custom order'));
  }

  ensurePaymentShape(order);

  if (status === 'DELIVERED' && !['SUBMITTED', 'PAID'].includes(order.payment.status)) {
    return next(new ApiError(400, 'Payment proof must be submitted before marking delivered'));
  }

  order.status = status;
  appendStatusHistory(order, status);

  if (status === 'DELIVERED' && !order.deliveredAt) {
    order.deliveredAt = new Date();
  }

  if (status !== 'DELIVERED' && order.deliveredAt) {
    order.deliveredAt = null;
  }

  await order.save();

  emitOrderStatusUpdated(order);
  await withNotificationsSafety(async () => {
    await notifyParticipantsAndAdmins({
      order,
      title: 'Order status updated',
      message: `Order #${getOrderRef(order)} is now ${orderStatusLabelMap[order.status] || order.status}.`,
      type: 'ORDER_STATUS_UPDATED',
      actorId: req.user?._id,
      data: {
        status: order.status,
      },
    });
  });

  return res.json({ success: true, data: order });
});

const quoteCustomOrder = catchAsync(async (req, res, next) => {
  const { id } = req.params;
  const quotedPrice = Number(req.body?.totalPrice);

  if (!Number.isFinite(quotedPrice) || quotedPrice <= 0) {
    return next(new ApiError(400, 'Quoted price must be a positive number'));
  }

  const order = await Order.findById(id)
    .populate('customer', 'name email role phone')
    .populate('items.cake')
    .populate('deliveryPerson', 'name email role phone');

  if (!order) {
    return next(new ApiError(404, 'Order not found'));
  }

  if (order.orderType !== 'CUSTOM') {
    return next(new ApiError(400, 'Quote update is allowed only for custom orders'));
  }

  if (order.deliveryPerson || quoteLockStatuses.includes(order.status)) {
    return next(new ApiError(400, 'Quote is locked after delivery assignment'));
  }

  order.totalPrice = quotedPrice;
  if (!order.customRequest || typeof order.customRequest !== 'object') {
    order.customRequest = {
      description: '',
      budgetMin: null,
      budgetMax: null,
      referenceImages: [],
    };
  }
  order.customRequest.quotedBy = req.user?._id || null;
  order.customRequest.quotedAt = new Date();

  await order.save();

  await withNotificationsSafety(async () => {
    await notifyParticipantsAndAdmins({
      order,
      title: 'Custom order quoted',
      message: `Custom order #${getOrderRef(order)} was quoted at ${quotedPrice}.`,
      type: 'ORDER_STATUS_UPDATED',
      actorId: req.user?._id,
      data: {
        status: order.status,
        orderType: order.orderType,
        totalPrice: order.totalPrice,
      },
    });
  });

  return res.json({ success: true, data: order });
});

const assignDelivery = catchAsync(async (req, res, next) => {
  const { id } = req.params;
  const {
    deliveryPersonId,
    deliveryId,
    deliveryEmail,
    scheduledDeliveryTime,
  } = req.body || {};
  const deliveryIdentifier =
    deliveryPersonId || deliveryId || deliveryEmail || '';

  if (!deliveryIdentifier) {
    return next(new ApiError(400, 'deliveryPersonId or deliveryEmail is required'));
  }

  const query = {
    role: 'DELIVERY',
  };

  if (mongoose.Types.ObjectId.isValid(deliveryIdentifier)) {
    query._id = deliveryIdentifier;
  } else {
    query.email = String(deliveryIdentifier).toLowerCase();
  }

  const deliveryUser = await User.findOne(query);

  if (!deliveryUser) {
    return next(new ApiError(404, 'Delivery user not found'));
  }

  const updates = {
    deliveryPerson: deliveryUser._id,
    status: 'OUT_FOR_DELIVERY',
  };

  if (scheduledDeliveryTime) {
    updates.scheduledDeliveryTime = new Date(scheduledDeliveryTime);
  }

  const order = await Order.findById(id)
    .populate('customer', 'name email role phone')
    .populate('items.cake')
    .populate('deliveryPerson', 'name email role phone');

  if (!order) {
    return next(new ApiError(404, 'Order not found'));
  }

  const existingDeliveryId = getEntityId(order.deliveryPerson);
  const nextDeliveryId = String(deliveryUser._id);
  const isNewAssignment = existingDeliveryId !== nextDeliveryId;

  if (isNewAssignment) {
    const unresolvedThreshold = new Date(
      Date.now() - assignmentBlockThresholdHours * 60 * 60 * 1000,
    );

    const unresolvedCount = await Order.countDocuments({
      deliveryPerson: deliveryUser._id,
      status: 'DELIVERED',
      deliveredAt: { $lte: unresolvedThreshold },
      'payment.status': { $in: unresolvedPaymentStatuses },
    });

    if (unresolvedCount >= assignmentBlockUnresolvedLimit) {
      return next(
        new ApiError(
          409,
          `Delivery partner is blocked from new assignments with ${unresolvedCount} unresolved payment proofs older than ${assignmentBlockThresholdHours} hours`,
        ),
      );
    }
  }

  order.deliveryPerson = updates.deliveryPerson;
  order.status = updates.status;

  if (updates.scheduledDeliveryTime) {
    order.scheduledDeliveryTime = updates.scheduledDeliveryTime;
  }

  const assignmentAt = new Date();
  const hasPreparingHistory = Array.isArray(order.statusHistory)
    ? order.statusHistory.some((entry) => entry?.status === 'PREPARING')
    : false;

  if (!hasPreparingHistory) {
    appendStatusHistory(order, 'PREPARING', assignmentAt);
  }

  appendStatusHistory(order, updates.status, assignmentAt);
  await order.save();

  await order.populate('customer', 'name email role phone');
  await order.populate('items.cake');
  await order.populate('deliveryPerson', 'name email role phone');

  emitOrderAssigned(order);
  await withNotificationsSafety(async () => {
    const deliveryName = getEntityName(order.deliveryPerson, 'a delivery partner');
    await notifyParticipantsAndAdmins({
      order,
      title: 'Delivery assigned',
      message: `Order #${getOrderRef(order)} was assigned to ${deliveryName}.`,
      type: 'ORDER_ASSIGNED',
      actorId: req.user?._id,
      data: {
        status: order.status,
        deliveryPersonId: getEntityId(order.deliveryPerson),
      },
    });
  });

  return res.json({ success: true, data: order });
});

const markDelivered = catchAsync(async (req, res, next) => {
  const { id } = req.params;

  const order = await Order.findById(id)
    .populate('customer', 'name email role phone')
    .populate('items.cake')
    .populate('deliveryPerson', 'name email role phone');

  if (!order) {
    return next(new ApiError(404, 'Order not found'));
  }

  if (!order.deliveryPerson || String(order.deliveryPerson._id) !== String(req.user._id)) {
    return next(new ApiError(403, 'You are not assigned to this order'));
  }

  ensurePaymentShape(order);

  if (!['SUBMITTED', 'PAID'].includes(order.payment.status)) {
    return next(new ApiError(400, 'Submit payment proof before marking this order as delivered'));
  }

  const paymentStatusBefore = order.payment?.status;

  order.status = 'DELIVERED';
  order.deliveredAt = new Date();
  appendStatusHistory(order, 'DELIVERED', order.deliveredAt);

  await order.save();

  emitOrderDelivered(order);
  await withNotificationsSafety(async () => {
    await notifyParticipantsAndAdmins({
      order,
      title: 'Order delivered',
      message: `Order #${getOrderRef(order)} has been marked as delivered.`,
      type: 'ORDER_DELIVERED',
      actorId: req.user?._id,
      data: {
        status: order.status,
        deliveredAt: order.deliveredAt,
      },
    });
  });

  const paymentJustMarkedPaid = paymentStatusBefore !== 'PAID' && order.payment?.status === 'PAID';
  if (paymentJustMarkedPaid) {
    emitOrderPaymentUpdated(order);
    await withNotificationsSafety(async () => {
      const methodLabel = paymentMethodLabelMap[order.payment?.method] || 'payment';
      await notifyParticipantsAndAdmins({
        order,
        title: 'Payment confirmed',
        message: `Payment confirmed for Order #${getOrderRef(order)} via ${methodLabel}.`,
        type: 'PAYMENT_UPDATED',
        actorId: req.user?._id,
        data: {
          paymentStatus: order.payment?.status,
          paymentMethod: order.payment?.method,
        },
      });
    });
  }

  return res.json({ success: true, data: order });
});

const updatePayment = catchAsync(async (req, res, next) => {
  const { id } = req.params;
  const { method, markAsPaid } = req.body || {};

  const order = await Order.findById(id)
    .populate('customer', 'name email role phone')
    .populate('items.cake')
    .populate('deliveryPerson', 'name email role phone');

  if (!order) {
    return next(new ApiError(404, 'Order not found'));
  }

  ensurePaymentShape(order);

  if (markAsPaid) {
    return next(new ApiError(400, 'Use payment review endpoint to approve payment'));
  }

  if (method && !validPaymentMethods.includes(method)) {
    return next(new ApiError(400, 'Invalid payment method'));
  }

  if (method && validPaymentMethods.includes(method) && method !== order.payment.method) {
    if (order.payment.status === 'PAID') {
      return next(new ApiError(400, 'Cannot change payment method for a paid order'));
    }

    order.payment.method = method;
    order.payment.status = 'PENDING_PROOF';
    order.payment.bankName = '';
    order.payment.transactionRef = null;
    order.payment.proofImage = null;
    order.payment.proofSubmittedBy = null;
    order.payment.proofSubmittedAt = null;
    order.payment.reviewedBy = null;
    order.payment.reviewedAt = null;
    order.payment.rejectionReason = '';
    order.payment.paidAt = null;

    appendPaymentAudit({
      order,
      action: 'METHOD_CHANGED',
      actorId: req.user?._id,
      note: `Payment method changed to ${method}`,
    });
  }

  await order.save();

  return res.json({ success: true, data: order });
});

const submitPaymentProof = catchAsync(async (req, res, next) => {
  const { id } = req.params;
  const { bankName = '', transactionRef = '' } = req.body || {};

  const order = await Order.findById(id)
    .populate('customer', 'name email role phone')
    .populate('items.cake')
    .populate('deliveryPerson', 'name email role phone');

  if (!order) {
    return next(new ApiError(404, 'Order not found'));
  }

  if (!order.deliveryPerson || String(order.deliveryPerson._id) !== String(req.user._id)) {
    return next(new ApiError(403, 'You are not assigned to this order'));
  }

  if (!['OUT_FOR_DELIVERY', 'DELIVERED'].includes(order.status)) {
    return next(new ApiError(400, 'Payment proof can be submitted only for active delivery orders'));
  }

  ensurePaymentShape(order);

  if (order.payment.status === 'PAID') {
    return next(new ApiError(400, 'Payment is already approved and marked as paid'));
  }

  const normalizedRef = String(transactionRef).trim();
  const normalizedBank = String(bankName).trim();

  if (!normalizedRef) {
    return next(new ApiError(400, 'Transaction or receipt number is required'));
  }

  if (!isCashPayment(order.payment.method) && !normalizedBank) {
    return next(new ApiError(400, 'Bank is required for card and transfer payments'));
  }

  if (!req.file?.path) {
    return next(new ApiError(400, 'Payment proof image is required'));
  }

  const normalizedProofImage = isCloudinaryConfigured()
    ? await uploadImageFromPath(req.file.path, {
      folder: 'cake-delivery/payment-proofs',
    })
    : toPublicImagePath(req.file.path);

  if (!normalizedProofImage) {
    return next(new ApiError(500, 'Failed to process payment proof image'));
  }

  order.payment.status = 'SUBMITTED';
  order.payment.bankName = normalizedBank;
  order.payment.transactionRef = normalizedRef;
  order.payment.proofImage = normalizedProofImage;
  order.payment.proofSubmittedBy = req.user._id;
  order.payment.proofSubmittedAt = new Date();
  order.payment.reviewedBy = null;
  order.payment.reviewedAt = null;
  order.payment.rejectionReason = '';
  order.payment.paidAt = null;
  order.payment.proofVersion = Number(order.payment.proofVersion || 0) + 1;

  appendPaymentAudit({
    order,
    action: 'PROOF_SUBMITTED',
    actorId: req.user?._id,
    bankName: normalizedBank,
    transactionRef: normalizedRef,
    proofImage: normalizedProofImage,
    note: `Proof version ${order.payment.proofVersion}`,
  });

  await order.save();

  emitOrderPaymentUpdated(order);
  await withNotificationsSafety(async () => {
    const deliveryName = getEntityName(order.deliveryPerson, 'delivery partner');
    await notifyParticipantsAndAdmins({
      order,
      title: 'Payment proof submitted',
      message: `${deliveryName} submitted payment proof for Order #${getOrderRef(order)}.`,
      type: 'PAYMENT_UPDATED',
      actorId: req.user?._id,
      data: {
        paymentStatus: order.payment?.status,
        paymentMethod: order.payment?.method,
      },
    });
  });

  return res.json({ success: true, data: order });
});

const reviewPayment = catchAsync(async (req, res, next) => {
  const { id } = req.params;
  const { action, rejectionReason = '' } = req.body || {};

  const order = await Order.findById(id)
    .populate('customer', 'name email role phone')
    .populate('items.cake')
    .populate('deliveryPerson', 'name email role phone');

  if (!order) {
    return next(new ApiError(404, 'Order not found'));
  }

  ensurePaymentShape(order);

  if (order.payment.status !== 'SUBMITTED') {
    return next(new ApiError(400, 'Only submitted payment proofs can be reviewed'));
  }

  const normalizedReason = String(rejectionReason || '').trim();

  if (action === 'APPROVE') {
    if (!order.payment.proofImage || !order.payment.transactionRef) {
      return next(new ApiError(400, 'Payment proof details are incomplete'));
    }

    order.payment.status = 'PAID';
    order.payment.paidAt = new Date();
    order.payment.reviewedBy = req.user._id;
    order.payment.reviewedAt = new Date();
    order.payment.rejectionReason = '';

    appendPaymentAudit({
      order,
      action: 'PAYMENT_APPROVED',
      actorId: req.user?._id,
      bankName: String(order.payment.bankName || '').trim(),
      transactionRef: order.payment.transactionRef,
      proofImage: order.payment.proofImage,
    });
  }

  if (action === 'REJECT') {
    if (!normalizedReason) {
      return next(new ApiError(400, 'Rejection reason is required'));
    }

    order.payment.status = 'REJECTED';
    order.payment.paidAt = null;
    order.payment.reviewedBy = req.user._id;
    order.payment.reviewedAt = new Date();
    order.payment.rejectionReason = normalizedReason;

    appendPaymentAudit({
      order,
      action: 'PAYMENT_REJECTED',
      actorId: req.user?._id,
      bankName: String(order.payment.bankName || '').trim(),
      transactionRef: order.payment.transactionRef,
      proofImage: order.payment.proofImage,
      note: normalizedReason,
    });
  }

  await order.save();

  emitOrderPaymentUpdated(order);
  await withNotificationsSafety(async () => {
    const methodLabel = paymentMethodLabelMap[order.payment?.method] || 'payment';
    const statusMessage =
      action === 'APPROVE'
        ? `Payment approved for Order #${getOrderRef(order)} via ${methodLabel}.`
        : `Payment proof rejected for Order #${getOrderRef(order)}. ${normalizedReason}`;

    await notifyParticipantsAndAdmins({
      order,
      title: action === 'APPROVE' ? 'Payment approved' : 'Payment rejected',
      message: statusMessage,
      type: 'PAYMENT_UPDATED',
      actorId: req.user?._id,
      data: {
        paymentStatus: order.payment?.status,
        paymentMethod: order.payment?.method,
      },
    });
  });

  return res.json({ success: true, data: order });
});

const submitFeedback = catchAsync(async (req, res, next) => {
  const { id } = req.params;
  const { rating, comment = '' } = req.body || {};

  const order = await Order.findById(id)
    .populate('customer', 'name email role phone')
    .populate('items.cake')
    .populate('deliveryPerson', 'name email role phone');

  if (!order) {
    return next(new ApiError(404, 'Order not found'));
  }

  if (String(order.customer?._id || order.customer) !== String(req.user._id)) {
    return next(new ApiError(403, 'You can only review your own order'));
  }

  if (order.status !== 'DELIVERED') {
    return next(new ApiError(400, 'Feedback is allowed only after delivery'));
  }

  order.feedback = {
    rating,
    comment,
    createdAt: new Date(),
  };

  await order.save();

  return res.json({ success: true, data: order });
});

module.exports = {
  createOrder,
  getAllOrders,
  getMyOrders,
  updateStatus,
  assignDelivery,
  quoteCustomOrder,
  getDeliveryOrders,
  markDelivered,
  submitPaymentProof,
  reviewPayment,
  updatePayment,
  submitFeedback,
};
