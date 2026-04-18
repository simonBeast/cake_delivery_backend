const path = require('path');
const multer = require('multer');

const storage = multer.diskStorage({
  destination: 'src/uploads/',
  filename: (_req, file, cb) => {
    const sanitized = file.originalname.replace(/\s+/g, '-').toLowerCase();
    cb(null, `${Date.now()}-${sanitized}`);
  },
});

const fileFilter = (_req, file, cb) => {
  if (!file.mimetype.startsWith('image/')) {
    cb(new Error('Only image files are allowed'));
    return;
  }

  cb(null, true);
};

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 2 * 1024 * 1024,
  },
});

const toPublicImagePath = (relativePath) => {
  if (!relativePath) {
    return null;
  }

  const normalized = relativePath.split(path.sep).join('/');
  return normalized.replace(/^src\//, '');
};

module.exports = {
  upload,
  toPublicImagePath,
};
