const express  = require('express')
const { body } = require('express-validator')
const { authenticate, authorize } = require('../middleware/auth')
const ctrl = require('../controllers/productController')

const router = express.Router()

router.get('/',    ctrl.getProducts)
router.get('/:id', ctrl.getProductById)
router.get('/:id/model', ctrl.getProductModel)

router.post('/', authenticate, authorize('seller', 'admin'), [
  body('name').trim().notEmpty().withMessage('Product name is required'),
  body('category').notEmpty().withMessage('Category is required'),
  body('price').isFloat({ min: 0 }).withMessage('Valid price is required'),
], ctrl.createProduct)

router.put('/:id', authenticate, authorize('seller', 'admin'), ctrl.updateProduct)
router.delete('/:id', authenticate, authorize('seller','admin'), ctrl.deleteProduct)

module.exports = router