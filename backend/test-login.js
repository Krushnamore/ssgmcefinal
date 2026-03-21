require('dotenv').config()
const bcrypt = require('bcryptjs')
const { getPool } = require('./config/db')

async function test() {
  const pool = getPool()
  const [rows] = await pool.execute('SELECT * FROM users WHERE email = ?', ['admin@vivmart.com'])
  
  if (!rows.length) { console.log('❌ User not found'); process.exit(1) }
  
  const user = rows[0]
  console.log('Found user:', user.email, '| role:', user.role, '| status:', user.status)
  console.log('Password hash:', user.password?.substring(0, 20) + '...')
  
  const valid = await bcrypt.compare('demo1234', user.password)
  console.log('Password match:', valid ? '✅ YES' : '❌ NO')
  
  // Check if normalizeEmail is changing admin@vivmart.com
  const { default: normalizeEmail } = await import('validator/lib/normalizeEmail.js').catch(() => ({ default: null }))
  if (normalizeEmail) {
    console.log('Normalized email:', normalizeEmail('admin@vivmart.com'))
  }
  
  process.exit(0)
}
test().catch(e => { console.error(e.message); process.exit(1) })