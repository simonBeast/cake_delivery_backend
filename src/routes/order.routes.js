const express = require('express');

const {
  assignDelivery,
  createOrder,
  getAllOrders,
  getDeliveryOrders,
  getMyOrders,
  markDelivered,
  reviewPayment,
  submitPaymentProof,
  submitFeedback,
  updatePayment,
  updateStatus,
} = require('../controllers/order.controller');
const authMiddleware = require('../middleware/auth.middleware');
const { upload } = require('../middleware/upload.middleware');
const { allowRoles } = require('../middleware/role.middleware');
const validateRequest = require('../middleware/validateRequest.middleware');
const {
  assignDeliverySchema,
  createOrderSchema,
  deliverSchema,
  orderListSchema,
  reviewPaymentSchema,
  submitPaymentProofSchema,
  submitFeedbackSchema,
  updatePaymentSchema,
  updateStatusSchema,
} = require('../validators/order.validator');

const router = express.Router();

router.post(
  '/',
  authMiddleware,
  allowRoles('CUSTOMER'),
  validateRequest(createOrderSchema),
  createOrder,
);
router.get(
  '/',
  authMiddleware,
  allowRoles('ADMIN'),
  validateRequest(orderListSchema),
  getAllOrders,
);
router.get(
  '/my',
  authMiddleware,
  allowRoles('CUSTOMER'),
  validateRequest(orderListSchema),
  getMyOrders,
);
router.get(
  '/delivery',
  authMiddleware,
  allowRoles('DELIVERY'),
  validateRequest(orderListSchema),
  getDeliveryOrders,
);

router.put(
  '/:id/status',
  authMiddleware,
  allowRoles('ADMIN'),
  validateRequest(updateStatusSchema),
  updateStatus,
);
router.patch(
  '/:id/status',
  authMiddleware,
  allowRoles('ADMIN'),
  validateRequest(updateStatusSchema),
  updateStatus,
);

router.put(
  '/:id/assign',
  authMiddleware,
  allowRoles('ADMIN'),
  validateRequest(assignDeliverySchema),
  assignDelivery,
);
router.patch(
  '/:id/assign',
  authMiddleware,
  allowRoles('ADMIN'),
  validateRequest(assignDeliverySchema),
  assignDelivery,
);

router.put(
  '/:id/deliver',
  authMiddleware,
  allowRoles('DELIVERY'),
  validateRequest(deliverSchema),
  markDelivered,
);
router.patch(
  '/:id/delivered',
  authMiddleware,
  allowRoles('DELIVERY'),
  validateRequest(deliverSchema),
  markDelivered,
);

router.patch(
  '/:id/payment',
  authMiddleware,
  allowRoles('ADMIN'),
  validateRequest(updatePaymentSchema),
  updatePayment,
);

router.patch(
  '/:id/payment/proof',
  authMiddleware,
  allowRoles('DELIVERY'),
  upload.single('proofImage'),
  validateRequest(submitPaymentProofSchema),
  submitPaymentProof,
);

router.patch(
  '/:id/payment/review',
  authMiddleware,
  allowRoles('ADMIN'),
  validateRequest(reviewPaymentSchema),
  reviewPayment,
);

router.patch(
  '/:id/feedback',
  authMiddleware,
  allowRoles('CUSTOMER'),
  validateRequest(submitFeedbackSchema),
  submitFeedback,
);

module.exports = router;
