const bcrypt = require('bcryptjs')
const jwt    = require('jsonwebtoken')
const { validationResult } = require('express-validator')
const { getPool } = require('../config/db')
const { notify }  = require('../utils/notify')

const JWT_SECRET  = process.env.JWT_SECRET  || 'vivmart_secret'
const JWT_EXPIRES = process.env.JWT_EXPIRES_IN || '7d'

const signToken = (user) =>
  jwt.sign(
    { id: user.id, email: user.email, role: user.role, name: user.name },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES }
  )

/* ─── Register ─────────────────────────────────────── */
exports.register = async (req, res) => {
  const errors = validationResult(req)
  if (!errors.isEmpty())
    return res.status(400).json({ success: false, message: errors.array()[0].msg })

  const { name, email, password, role = 'buyer' } = req.body

  try {
    const pool = getPool()
    const [existing] = await pool.execute('SELECT id FROM users WHERE email = ?', [email])
    if (existing.length)
      return res.status(409).json({ success: false, message: 'Email already registered' })

    const hashedPw = await bcrypt.hash(password, 12)
    const safeRole = role === 'admin' ? 'buyer' : role

    // Sellers start as 'pending' — need admin approval
    const status = safeRole === 'seller' ? 'pending' : 'active'

    const [result] = await pool.execute(
      'INSERT INTO users (name, email, password, role, status) VALUES (?, ?, ?, ?, ?)',
      [name, email, hashedPw, safeRole, status]
    )

    if (safeRole === 'seller') {
      // Notify all admins about new seller registration
      const [admins] = await pool.execute("SELECT id FROM users WHERE role = 'admin'")
      for (const admin of admins) {
        await notify(admin.id, 'seller_pending',
          'New Seller Registration',
          `${name} (${email}) has registered as a seller and is awaiting approval.`,
          { sellerId: result.insertId, sellerName: name, sellerEmail: email }
        )
      }
      return res.status(201).json({
        success: true,
        pending: true,
        message: 'Registration successful! Your seller account is pending admin approval. You will be notified once approved.',
      })
    }

    // Buyers get immediate access
    const user  = { id: result.insertId, name, email, role: safeRole }
    const token = signToken(user)
    return res.status(201).json({ success: true, user, token })
  } catch (err) {
    console.error('Register error:', err)
    return res.status(500).json({ success: false, message: 'Registration failed' })
  }
}

/* ─── Login ────────────────────────────────────────── */
exports.login = async (req, res) => {
  const errors = validationResult(req)
  if (!errors.isEmpty())
    return res.status(400).json({ success: false, message: errors.array()[0].msg })

  const { email, password } = req.body
  console.log('Login attempt:', email)

  try {
    const pool   = getPool()
    const [rows] = await pool.execute('SELECT * FROM users WHERE email = ?', [email])
    console.log('Found users:', rows.length, rows[0]?.email, rows[0]?.role)
    if (!rows.length)
      return res.status(401).json({ success: false, message: 'Invalid email or password' })

    const dbUser = rows[0]
    const valid  = await bcrypt.compare(password, dbUser.password)
    if (!valid)
      return res.status(401).json({ success: false, message: 'Invalid email or password' })

    // Admin always gets access regardless of status
    if (dbUser.role !== 'admin') {
      // Seller pending approval
      if (dbUser.role === 'seller' && dbUser.status === 'pending')
        return res.status(403).json({
          success: false,
          pending: true,
          message: 'Your seller account is pending admin approval. Please wait for approval.',
        })

      if (dbUser.status === 'suspended')
        return res.status(403).json({ success: false, message: 'Account suspended. Contact support.' })

      if (dbUser.status === 'rejected')
        return res.status(403).json({ success: false, message: 'Your seller application was rejected. Contact support.' })
    }

    const user  = { id: dbUser.id, name: dbUser.name, email: dbUser.email, role: dbUser.role }
    const token = signToken(user)

    await pool.execute('UPDATE users SET last_login = NOW() WHERE id = ?', [dbUser.id])
    return res.json({ success: true, user, token })
  } catch (err) {
    console.error('Login error:', err)
    return res.status(500).json({ success: false, message: 'Login failed' })
  }
}

/* ─── Get Profile ──────────────────────────────────── */
exports.getProfile = async (req, res) => {
  try {
    const pool   = getPool()
    const [rows] = await pool.execute(
      'SELECT id, name, email, role, phone, avatar_url, status, created_at, last_login FROM users WHERE id = ?',
      [req.user.id]
    )
    if (!rows.length)
      return res.status(404).json({ success: false, message: 'User not found' })
    return res.json({ success: true, user: rows[0] })
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Failed to fetch profile' })
  }
}

/* ─── Update Profile ───────────────────────────────── */
exports.updateProfile = async (req, res) => {
  const { name, phone } = req.body
  try {
    const pool = getPool()
    await pool.execute(
      'UPDATE users SET name = ?, phone = ?, updated_at = NOW() WHERE id = ?',
      [name, phone, req.user.id]
    )
    return res.json({ success: true, message: 'Profile updated' })
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Failed to update profile' })
  }
}