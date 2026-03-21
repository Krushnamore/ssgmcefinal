const { getPool } = require('../config/db')

/* ─── GET /api/users  (admin) ─────────────────────── */
exports.getUsers = async (req, res) => {
  try {
    const pool = getPool()
    const { role, status, search } = req.query
    let sql    = 'SELECT id, name, email, role, phone, status, created_at, last_login FROM users WHERE 1=1'
    const params = []

    if (role)   { sql += ' AND role = ?';   params.push(role)   }
    if (status) { sql += ' AND status = ?'; params.push(status) }
    if (search) {
      sql += ' AND (name LIKE ? OR email LIKE ?)'
      const q = `%${search}%`
      params.push(q, q)
    }
    sql += ' ORDER BY created_at DESC'

    const [rows] = await pool.execute(sql, params)
    return res.json({ success: true, users: rows })
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Failed to fetch users' })
  }
}

/* ─── GET /api/users/:id ─────────────────────────── */
exports.getUserById = async (req, res) => {
  if (req.user.role !== 'admin' && req.user.id !== parseInt(req.params.id))
    return res.status(403).json({ success: false, message: 'Access denied' })

  try {
    const pool   = getPool()
    const [rows] = await pool.execute(
      'SELECT id, name, email, role, phone, status, created_at FROM users WHERE id = ?',
      [req.params.id]
    )
    if (!rows.length)
      return res.status(404).json({ success: false, message: 'User not found' })
    return res.json({ success: true, user: rows[0] })
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Failed to fetch user' })
  }
}

/* ─── PUT /api/users/:id/status  (admin) ─────────── */
exports.updateUserStatus = async (req, res) => {
  const { status } = req.body
  if (!['active', 'suspended', 'pending'].includes(status))
    return res.status(400).json({ success: false, message: 'Invalid status value' })

  try {
    const pool = getPool()
    await pool.execute(
      'UPDATE users SET status = ?, updated_at = NOW() WHERE id = ?',
      [status, req.params.id]
    )
    return res.json({ success: true, message: `User status updated to ${status}` })
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Failed to update user status' })
  }
}

/* ─── DELETE /api/users/:id  (admin) ─────────────── */
exports.deleteUser = async (req, res) => {
  if (req.user.id === parseInt(req.params.id))
    return res.status(400).json({ success: false, message: 'Cannot delete your own account' })

  try {
    const pool = getPool()
    await pool.execute("UPDATE users SET status = 'suspended' WHERE id = ?", [req.params.id])
    return res.json({ success: true, message: 'User account suspended' })
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Failed to suspend user' })
  }
}

/* ─── GET /api/users/stats/admin ─────────────────── */
exports.getAdminStats = async (req, res) => {
  try {
    const pool = getPool()
    const [[buyers]]    = await pool.execute('SELECT COUNT(*) AS cnt FROM users WHERE role = "buyer"')
    const [[sellers]]   = await pool.execute('SELECT COUNT(*) AS cnt FROM users WHERE role = "seller"')
    const [[products]]  = await pool.execute('SELECT COUNT(*) AS cnt FROM products WHERE active = 1')
    const [[orders]]    = await pool.execute('SELECT COUNT(*) AS cnt FROM orders')
    const [[revenue]]   = await pool.execute('SELECT COALESCE(SUM(total), 0) AS total FROM orders WHERE status != "cancelled"')

    return res.json({
      success: true,
      stats: {
        buyers:   buyers.cnt,
        sellers:  sellers.cnt,
        products: products.cnt,
        orders:   orders.cnt,
        revenue:  revenue.total,
      }
    })
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Failed to fetch stats' })
  }
}

/* ─── GET pending sellers ──────────────────────────── */
exports.getPendingSellers = async (req, res) => {
  try {
    const pool = getPool()
    const [rows] = await pool.execute(
      `SELECT id, name, email, status, created_at FROM users
       WHERE role = 'seller' AND status = 'pending'
       ORDER BY created_at DESC`
    )
    return res.json({ success: true, sellers: rows })
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Failed to fetch pending sellers' })
  }
}

/* ─── Approve seller ───────────────────────────────── */
exports.approveSeller = async (req, res) => {
  try {
    const pool = getPool()
    const [rows] = await pool.execute('SELECT * FROM users WHERE id = ? AND role = ?', [req.params.id, 'seller'])
    if (!rows.length) return res.status(404).json({ success: false, message: 'Seller not found' })

    await pool.execute("UPDATE users SET status = 'active' WHERE id = ?", [req.params.id])

    // Notify seller
    const { notify } = require('../utils/notify')
    await notify(req.params.id, 'seller_approved',
      '🎉 Seller Account Approved!',
      'Your seller account has been approved by admin. You can now login and start selling!',
      {}
    )
    return res.json({ success: true, message: 'Seller approved successfully' })
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Failed to approve seller' })
  }
}

/* ─── Reject seller ────────────────────────────────── */
exports.rejectSeller = async (req, res) => {
  const { reason } = req.body
  try {
    const pool = getPool()
    await pool.execute("UPDATE users SET status = 'rejected' WHERE id = ?", [req.params.id])

    const { notify } = require('../utils/notify')
    await notify(req.params.id, 'seller_rejected',
      'Seller Application Rejected',
      reason || 'Your seller application was not approved. Contact support for more info.',
      {}
    )
    return res.json({ success: true, message: 'Seller rejected' })
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Failed to reject seller' })
  }
}