const Cake = require('../models/cake.model');
const ApiError = require('../utils/apiError');
const catchAsync = require('../utils/catchAsync');
const { toPublicImagePath } = require('../middleware/upload.middleware');
const { buildPaginationMeta, parsePagination } = require('../utils/pagination');
const {
  isCloudinaryConfigured,
  uploadImageFromPath,
} = require('../utils/cloudinary');

const parseBooleanField = (value, defaultValue) => {
  if (value === undefined || value === null || value === '') {
    return defaultValue;
  }

  if (typeof value === 'boolean') {
    return value;
  }

  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (['true', '1', 'yes', 'on'].includes(normalized)) {
      return true;
    }

    if (['false', '0', 'no', 'off'].includes(normalized)) {
      return false;
    }
  }

  return Boolean(value);
};

const parsePrimaryImageIndex = (value) => {
  if (value === undefined || value === null || value === '') {
    return null;
  }

  const parsed = Number(value);

  if (!Number.isInteger(parsed) || parsed < 0) {
    return null;
  }

  return parsed;
};

const normalizeUploadedImages = async (req) => {
  const files = [];

  if (Array.isArray(req.files?.images)) {
    files.push(...req.files.images);
  }

  if (Array.isArray(req.files?.image)) {
    files.push(...req.files.image);
  }

  if (req.file) {
    files.push(req.file);
  }

  const imagePaths = await Promise.all(
    files.map(async (file) => {
      if (!file?.path) {
        return null;
      }

      if (isCloudinaryConfigured()) {
        const uploaded = await uploadImageFromPath(file.path, {
          folder: 'cake-delivery/cakes',
        });
        return uploaded;
      }

      return toPublicImagePath(file.path);
    }),
  );

  return imagePaths
    .filter(Boolean)
    .filter((value, index, all) => all.indexOf(value) === index);
};

const resolvePrimaryImage = (images, primaryImageIndex) => {
  if (!Array.isArray(images) || images.length === 0) {
    return null;
  }

  if (
    primaryImageIndex !== null &&
    primaryImageIndex >= 0 &&
    primaryImageIndex < images.length
  ) {
    return images[primaryImageIndex];
  }

  return images[0];
};

const createCake = catchAsync(async (req, res, next) => {
  const { name, description, price, isAvailable } = req.body;

  if (!name || price === undefined) {
    return next(new ApiError(400, 'name and price are required'));
  }

  const uploadedImages = await normalizeUploadedImages(req);
  const primaryImageIndex = parsePrimaryImageIndex(req.body?.primaryImageIndex);
  const primaryImage = resolvePrimaryImage(uploadedImages, primaryImageIndex);

  const cake = await Cake.create({
    name,
    description,
    price: Number(price),
    image: primaryImage,
    images: uploadedImages,
    primaryImage,
    isAvailable: parseBooleanField(isAvailable, true),
  });

  return res.status(201).json({ success: true, data: cake });
});

const getCakes = catchAsync(async (req, res) => {
  const { page, limit, skip } = parsePagination(req.query);
  const {
    search,
    minPrice,
    maxPrice,
    isAvailable,
    sortBy = 'createdAt',
    sortOrder = 'desc',
  } = req.query;

  const query = {};

  if (search) {
    query.$or = [
      { name: { $regex: search, $options: 'i' } },
      { description: { $regex: search, $options: 'i' } },
    ];
  }

  if (minPrice !== undefined || maxPrice !== undefined) {
    query.price = {};
    if (minPrice !== undefined) {
      query.price.$gte = Number(minPrice);
    }
    if (maxPrice !== undefined) {
      query.price.$lte = Number(maxPrice);
    }
  }

  if (isAvailable !== undefined) {
    query.isAvailable = Boolean(isAvailable);
  }

  const sortDirection = sortOrder === 'asc' ? 1 : -1;
  const sort = { [sortBy]: sortDirection };

  const [cakes, total] = await Promise.all([
    Cake.find(query).sort(sort).skip(skip).limit(limit),
    Cake.countDocuments(query),
  ]);

  return res.json({
    success: true,
    data: cakes,
    pagination: buildPaginationMeta({ page, limit, total }),
  });
});

const updateCake = catchAsync(async (req, res, next) => {
  const { id } = req.params;
  const updates = { ...req.body };
  const cake = await Cake.findById(id);

  if (!cake) {
    return next(new ApiError(404, 'Cake not found'));
  }

  const uploadedImages = await normalizeUploadedImages(req);
  const primaryImageIndex = parsePrimaryImageIndex(req.body?.primaryImageIndex);
  const clearImages = parseBooleanField(req.body?.clearImages, false);

  delete updates.primaryImageIndex;
  delete updates.clearImages;

  if (clearImages) {
    updates.images = [];
    updates.primaryImage = null;
    updates.image = null;
  } else if (uploadedImages.length > 0) {
    const primaryImage = resolvePrimaryImage(uploadedImages, primaryImageIndex);
    updates.images = uploadedImages;
    updates.primaryImage = primaryImage;
    updates.image = primaryImage;
  } else if (typeof req.body?.primaryImage === 'string') {
    const candidate = req.body.primaryImage.trim();

    if (candidate && Array.isArray(cake.images) && cake.images.includes(candidate)) {
      updates.primaryImage = candidate;
      updates.image = candidate;
    }
  } else if (primaryImageIndex !== null && Array.isArray(cake.images) && cake.images.length > 0) {
    const primaryImage = resolvePrimaryImage(cake.images, primaryImageIndex);
    updates.primaryImage = primaryImage;
    updates.image = primaryImage;
  }

  if (updates.primaryImage !== undefined && !updates.image) {
    updates.image = updates.primaryImage;
  }

  if (updates.price !== undefined) {
    updates.price = Number(updates.price);
  }

  if (updates.isAvailable !== undefined) {
    updates.isAvailable = parseBooleanField(updates.isAvailable, true);
  }

  const updatedCake = await Cake.findByIdAndUpdate(id, updates, {
    returnDocument: 'after',
    runValidators: true,
  });

  return res.json({ success: true, data: updatedCake });
});

const deleteCake = catchAsync(async (req, res, next) => {
  const { id } = req.params;
  const cake = await Cake.findByIdAndDelete(id);

  if (!cake) {
    return next(new ApiError(404, 'Cake not found'));
  }

  return res.json({ success: true, message: 'Cake deleted' });
});

module.exports = {
  createCake,
  getCakes,
  updateCake,
  deleteCake,
};
