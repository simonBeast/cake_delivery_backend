const mongoose = require('mongoose');

const cakeSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      trim: true,
      default: '',
    },
    price: {
      type: Number,
      required: true,
      min: 0,
    },
    image: {
      type: String,
      default: null,
    },
    images: {
      type: [String],
      default: [],
    },
    primaryImage: {
      type: String,
      default: null,
    },
    isAvailable: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true },
);

cakeSchema.pre('validate', function syncPrimaryImage() {
  if (!Array.isArray(this.images)) {
    this.images = [];
  }

  const normalizedImages = this.images.filter(Boolean);
  this.images = normalizedImages;

  if (!this.primaryImage || !normalizedImages.includes(this.primaryImage)) {
    this.primaryImage = normalizedImages[0] || null;
  }

  this.image = this.primaryImage || null;
});

module.exports = mongoose.model('Cake', cakeSchema);
