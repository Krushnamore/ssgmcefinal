const express = require('express')
const { authenticate, authorize } = require('../middleware/auth')
const ctrl = require('../controllers/userController')

const router = express.Router()

// Specific routes FIRST (before /:id which catches everything)
router.get('/stats/admin',        authenticate, authorize('admin'), ctrl.getAdminStats)
router.get('/pending-sellers',    authenticate, authorize('admin'), ctrl.getPendingSellers)
router.get('/',                   authenticate, authorize('admin'), ctrl.getUsers)

// Parameterized routes AFTER specific ones
router.get('/:id',                authenticate, ctrl.getUserById)
router.put('/:id/status',         authenticate, authorize('admin'), ctrl.updateUserStatus)
router.put('/:id/approve-seller', authenticate, authorize('admin'), ctrl.approveSeller)
router.put('/:id/reject-seller',  authenticate, authorize('admin'), ctrl.rejectSeller)
router.delete('/:id',             authenticate, authorize('admin'), ctrl.deleteUser)

module.exports = router