const Joi = require('joi');

const objectIdSchema = Joi.string().hex().length(24);

const deliveryLocationSchema = Joi.object({
  lat: Joi.number().required(),
  lng: Joi.number().required(),
  label: Joi.string().trim().allow('').max(220).optional(),
  placeId: Joi.string().trim().allow('').max(200).optional(),
});

const allowedOrderSizes = [
  '1KG',
  '2KG',
  '3KG',
  '4KG',
  'SMALL',
  'MEDIUM',
  'LARGE',
  'CUSTOM',
];

const itemSchema = Joi.object({
  cake: objectIdSchema.required(),
  quantity: Joi.number().integer().greater(0).required(),
  size: Joi.string().valid(...allowedOrderSizes).optional(),
  flavour: Joi.string().trim().max(120).allow('').optional(),
  designNotes: Joi.string().trim().max(400).allow('').optional(),
});

const createOrderSchema = Joi.object({
  body: Joi.object({
    cakeId: objectIdSchema.optional(),
    quantity: Joi.number().integer().greater(0).optional(),
    size: Joi.string().valid(...allowedOrderSizes).optional(),
    items: Joi.array().items(itemSchema).min(1).optional(),
    deliveryAddress: Joi.string().trim().allow('').max(300).optional(),
    scheduledDeliveryTime: Joi.date().iso().optional(),
    paymentMethod: Joi.string()
      .valid('CASH', 'SIMULATED_CARD', 'SIMULATED_TRANSFER')
      .optional(),
  })
    .or('cakeId', 'items')
    .required(),
  params: Joi.object().optional(),
  query: Joi.object().optional(),
});

const createCustomOrderSchema = Joi.object({
  body: Joi.object({
    description: Joi.string().trim().min(8).max(1500).required(),
    budgetMin: Joi.number().min(0).optional(),
    budgetMax: Joi.number().min(0).optional(),
    deliveryAddress: Joi.string().trim().allow('').max(300).optional(),
    deliveryLocation: Joi.alternatives().try(deliveryLocationSchema, Joi.string().trim()).optional(),
    scheduledDeliveryTime: Joi.date().iso().optional(),
    paymentMethod: Joi.string()
      .valid('CASH', 'SIMULATED_CARD', 'SIMULATED_TRANSFER')
      .optional(),
  })
    .custom((value, helpers) => {
      const hasMin = Number.isFinite(Number(value.budgetMin));
      const hasMax = Number.isFinite(Number(value.budgetMax));

      if (hasMin && hasMax && Number(value.budgetMax) < Number(value.budgetMin)) {
        return helpers.error('any.invalid');
      }

      return value;
    }, 'budget range validation')
    .messages({
      'any.invalid': 'budgetMax must be greater than or equal to budgetMin',
    })
    .required(),
  params: Joi.object().optional(),
  query: Joi.object().optional(),
});

const orderListSchema = Joi.object({
  body: Joi.object().optional(),
  params: Joi.object().optional(),
  query: Joi.object({
    page: Joi.number().integer().min(1).optional(),
    limit: Joi.number().integer().min(1).max(100).optional(),
    orderType: Joi.string().valid('PREDEFINED', 'CUSTOM').optional(),
    status: Joi.string()
      .valid('PENDING', 'PREPARING', 'OUT_FOR_DELIVERY', 'DELIVERED', 'DECLINED')
      .optional(),
    from: Joi.date().iso().optional(),
    to: Joi.date().iso().optional(),
  }).optional(),
});

const updateStatusSchema = Joi.object({
  body: Joi.object({
    status: Joi.string()
      .valid('PENDING', 'PREPARING', 'OUT_FOR_DELIVERY', 'DELIVERED', 'DECLINED')
      .required(),
  }).required(),
  params: Joi.object({
    id: objectIdSchema.required(),
  }).required(),
  query: Joi.object().optional(),
});

const assignDeliverySchema = Joi.object({
  body: Joi.object({
    deliveryPersonId: objectIdSchema.optional(),
    deliveryId: Joi.alternatives().try(objectIdSchema, Joi.string().email()).optional(),
    deliveryEmail: Joi.string().email().optional(),
    scheduledDeliveryTime: Joi.date().iso().optional(),
  })
    .or('deliveryPersonId', 'deliveryId', 'deliveryEmail')
    .required(),
  params: Joi.object({
    id: objectIdSchema.required(),
  }).required(),
  query: Joi.object().optional(),
});

const deliverSchema = Joi.object({
  body: Joi.object().optional(),
  params: Joi.object({
    id: objectIdSchema.required(),
  }).required(),
  query: Joi.object().optional(),
});

const updatePaymentSchema = Joi.object({
  body: Joi.object({
    method: Joi.string()
      .valid('CASH', 'SIMULATED_CARD', 'SIMULATED_TRANSFER')
      .optional(),
    markAsPaid: Joi.boolean().optional(),
  })
    .or('method', 'markAsPaid')
    .required(),
  params: Joi.object({
    id: objectIdSchema.required(),
  }).required(),
  query: Joi.object().optional(),
});

const submitPaymentProofSchema = Joi.object({
  body: Joi.object({
    bankName: Joi.string().trim().max(120).allow('').optional(),
    transactionRef: Joi.string().trim().max(120).required(),
  }).required(),
  params: Joi.object({
    id: objectIdSchema.required(),
  }).required(),
  query: Joi.object().optional(),
});

const reviewPaymentSchema = Joi.object({
  body: Joi.object({
    action: Joi.string().valid('APPROVE', 'REJECT').required(),
    rejectionReason: Joi.string().trim().max(300).allow('').when('action', {
      is: 'REJECT',
      then: Joi.string().trim().min(3).max(300).required(),
      otherwise: Joi.optional(),
    }),
  }).required(),
  params: Joi.object({
    id: objectIdSchema.required(),
  }).required(),
  query: Joi.object().optional(),
});

const quoteCustomOrderSchema = Joi.object({
  body: Joi.object({
    totalPrice: Joi.number().positive().required(),
  }).required(),
  params: Joi.object({
    id: objectIdSchema.required(),
  }).required(),
  query: Joi.object().optional(),
});

const submitFeedbackSchema = Joi.object({
  body: Joi.object({
    rating: Joi.number().integer().min(1).max(5).required(),
    comment: Joi.string().trim().max(500).allow('').optional(),
  }).required(),
  params: Joi.object({
    id: objectIdSchema.required(),
  }).required(),
  query: Joi.object().optional(),
});

module.exports = {
  createOrderSchema,
  createCustomOrderSchema,
  orderListSchema,
  updateStatusSchema,
  assignDeliverySchema,
  deliverSchema,
  updatePaymentSchema,
  submitPaymentProofSchema,
  reviewPaymentSchema,
  quoteCustomOrderSchema,
  submitFeedbackSchema,
};
