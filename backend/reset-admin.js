require('dotenv').config()
const bcrypt = require('bcryptjs')
const { getPool } = require('./config/db')

async function reset() {
  const pool = getPool()
  const hash = await bcrypt.hash('demo1234', 12)
  
  const [result] = await pool.execute(
    'UPDATE users SET password = ? WHERE email = ?',
    [hash, 'admin@vivmart.com']
  )
  console.log('Updated rows:', result.affectedRows)
  
  // Verify it works
  const [rows] = await pool.execute('SELECT * FROM users WHERE email = ?', ['admin@vivmart.com'])
  const ok = await bcrypt.compare('demo1234', rows[0].password)
  console.log('Password verify:', ok ? '✅ CORRECT' : '❌ WRONG')
  console.log('User:', rows[0].email, rows[0].role, rows[0].status)
  process.exit(0)
}

reset().catch(e => { console.error(e.message); process.exit(1) })