const mongoose = require('mongoose');

const orderItemSchema = new mongoose.Schema(
  {
    cake: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Cake',
      required: true,
    },
    cakeName: {
      type: String,
      trim: true,
      default: '',
      maxlength: 160,
    },
    quantity: {
      type: Number,
      required: true,
      min: 1,
    },
    size: {
      type: String,
      enum: ['SMALL', 'MEDIUM', 'LARGE', 'CUSTOM'],
      default: 'MEDIUM',
    },
    flavour: {
      type: String,
      trim: true,
      default: '',
      maxlength: 120,
    },
    designNotes: {
      type: String,
      trim: true,
      default: '',
      maxlength: 400,
    },
  },
  { _id: false },
);

const orderSchema = new mongoose.Schema(
  {
    customer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    items: [orderItemSchema],
    totalPrice: {
      type: Number,
      required: true,
      min: 0,
    },
    status: {
      type: String,
      enum: ['PENDING', 'PREPARING', 'OUT_FOR_DELIVERY', 'DELIVERED', 'DECLINED'],
      default: 'PENDING',
    },
    statusHistory: [
      {
        status: {
          type: String,
          enum: ['PENDING', 'PREPARING', 'OUT_FOR_DELIVERY', 'DELIVERED', 'DECLINED'],
          required: true,
        },
        at: {
          type: Date,
          required: true,
          default: Date.now,
        },
      },
    ],
    deliveryPerson: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    deliveryAddress: {
      type: String,
      default: '',
      trim: true,
    },
    deliveryLocation: {
      lat: {
        type: Number,
        default: null,
      },
      lng: {
        type: Number,
        default: null,
      },
      label: {
        type: String,
        trim: true,
        default: '',
        maxlength: 220,
      },
      placeId: {
        type: String,
        trim: true,
        default: '',
        maxlength: 200,
      },
    },
    scheduledDeliveryTime: {
      type: Date,
      default: null,
    },
    deliveredAt: {
      type: Date,
      default: null,
    },
    payment: {
      method: {
        type: String,
        enum: ['CASH', 'SIMULATED_CARD', 'SIMULATED_TRANSFER'],
        default: 'CASH',
      },
      status: {
        type: String,
        enum: ['PENDING', 'PENDING_PROOF', 'SUBMITTED', 'PAID', 'REJECTED', 'FAILED', 'REFUNDED'],
        default: 'PENDING_PROOF',
      },
      bankName: {
        type: String,
        trim: true,
        default: '',
        maxlength: 120,
      },
      transactionRef: {
        type: String,
        default: null,
      },
      proofImage: {
        type: String,
        default: null,
      },
      proofSubmittedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        default: null,
      },
      proofSubmittedAt: {
        type: Date,
        default: null,
      },
      reviewedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        default: null,
      },
      reviewedAt: {
        type: Date,
        default: null,
      },
      rejectionReason: {
        type: String,
        trim: true,
        default: '',
        maxlength: 300,
      },
      proofVersion: {
        type: Number,
        default: 0,
        min: 0,
      },
      auditTrail: [
        {
          _id: false,
          action: {
            type: String,
            enum: ['METHOD_CHANGED', 'PROOF_SUBMITTED', 'PAYMENT_APPROVED', 'PAYMENT_REJECTED'],
            required: true,
          },
          by: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            default: null,
          },
          at: {
            type: Date,
            required: true,
            default: Date.now,
          },
          note: {
            type: String,
            trim: true,
            default: '',
            maxlength: 300,
          },
          bankName: {
            type: String,
            trim: true,
            default: '',
            maxlength: 120,
          },
          transactionRef: {
            type: String,
            default: null,
          },
          proofImage: {
            type: String,
            default: null,
          },
        },
      ],
      paidAt: {
        type: Date,
        default: null,
      },
    },
    feedback: {
      rating: {
        type: Number,
        min: 1,
        max: 5,
        default: null,
      },
      comment: {
        type: String,
        trim: true,
        default: '',
        maxlength: 500,
      },
      createdAt: {
        type: Date,
        default: null,
      },
    },
  },
  { timestamps: true },
);

module.exports = mongoose.model('Order', orderSchema);
