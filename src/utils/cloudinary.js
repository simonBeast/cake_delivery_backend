const fs = require('fs/promises');
const { v2: cloudinary } = require('cloudinary');

const getConfig = () => ({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const isCloudinaryConfigured = () => {
  const config = getConfig();
  return Boolean(config.cloud_name && config.api_key && config.api_secret);
};

const ensureCloudinaryConfig = () => {
  if (!isCloudinaryConfigured()) {
    return false;
  }

  cloudinary.config(getConfig());
  return true;
};

const safeDeleteFile = async (filePath) => {
  if (!filePath) {
    return;
  }

  try {
    await fs.unlink(filePath);
  } catch {
    // Ignore cleanup failures for temporary upload files.
  }
};

const uploadImageFromPath = async (filePath, options = {}) => {
  if (!filePath) {
    return null;
  }

  const configured = ensureCloudinaryConfig();
  if (!configured) {
    return null;
  }

  const uploadResult = await cloudinary.uploader.upload(filePath, {
    resource_type: 'image',
    folder: options.folder || 'cake-delivery',
  });

  await safeDeleteFile(filePath);

  return uploadResult?.secure_url || uploadResult?.url || null;
};

module.exports = {
  isCloudinaryConfigured,
  uploadImageFromPath,
};
