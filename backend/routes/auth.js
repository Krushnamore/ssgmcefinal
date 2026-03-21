const express  = require('express')
const { body } = require('express-validator')
const { authenticate } = require('../middleware/auth')
const ctrl = require('../controllers/authController')

const router = express.Router()

router.post('/register', [
  body('name').trim().isLength({ min: 2 }).withMessage('Name must be at least 2 characters'),
  body('email').isEmail().normalizeEmail().withMessage('Enter a valid email'),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
  body('role').optional().isIn(['buyer', 'seller']).withMessage('Role must be buyer or seller'),
], ctrl.register)

router.post('/login', [
  body('email').isEmail().withMessage('Enter a valid email'),
  body('password').notEmpty().withMessage('Password is required'),
], ctrl.login)

router.get('/profile', authenticate, ctrl.getProfile)
router.put('/profile', authenticate, ctrl.updateProfile)

module.exports = router