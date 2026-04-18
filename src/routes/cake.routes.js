const express = require('express');

const {
  createCake,
  deleteCake,
  getCakes,
  updateCake,
} = require('../controllers/cake.controller');
const authMiddleware = require('../middleware/auth.middleware');
const { allowRoles } = require('../middleware/role.middleware');
const { upload } = require('../middleware/upload.middleware');
const validateRequest = require('../middleware/validateRequest.middleware');
const {
  createCakeSchema,
  listCakesSchema,
  updateCakeSchema,
} = require('../validators/cake.validator');

const router = express.Router();

router.get('/', validateRequest(listCakesSchema), getCakes);
router.post(
  '/',
  authMiddleware,
  allowRoles('ADMIN'),
  upload.fields([
    { name: 'images', maxCount: 8 },
    { name: 'image', maxCount: 1 },
  ]),
  validateRequest(createCakeSchema),
  createCake,
);
router.put(
  '/:id',
  authMiddleware,
  allowRoles('ADMIN'),
  upload.fields([
    { name: 'images', maxCount: 8 },
    { name: 'image', maxCount: 1 },
  ]),
  validateRequest(updateCakeSchema),
  updateCake,
);
router.delete('/:id', authMiddleware, allowRoles('ADMIN'), deleteCake);

module.exports = router;
