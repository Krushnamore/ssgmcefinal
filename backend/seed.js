require('dotenv').config()
const bcrypt = require('bcryptjs')
const { getPool } = require('./config/db')

async function seed() {
  console.log('🌱 Seeding demo users...')
  const pool = getPool()
  const hash = await bcrypt.hash('demo1234', 12)
  console.log('✓ Password hash generated')

  await pool.execute(
    `INSERT INTO users (name, email, password, role, status) VALUES (?, ?, ?, 'admin', 'active')
     ON DUPLICATE KEY UPDATE password = VALUES(password), status = 'active'`,
    ['Admin User', 'admin@vivmart.com', hash]
  )

  await pool.execute(
    `INSERT INTO users (name, email, password, role, status) VALUES (?, ?, ?, 'seller', 'active')
     ON DUPLICATE KEY UPDATE password = VALUES(password), status = 'active'`,
    ['Demo Seller', 'seller@vivmart.com', hash]
  )

  await pool.execute(
    `INSERT INTO users (name, email, password, role, status) VALUES (?, ?, ?, 'buyer', 'active')
     ON DUPLICATE KEY UPDATE password = VALUES(password), status = 'active'`,
    ['Demo Buyer', 'buyer@vivmart.com', hash]
  )

  console.log('✅ Done!')
  console.log('   admin@vivmart.com  / demo1234')
  console.log('   seller@vivmart.com / demo1234')
  console.log('   buyer@vivmart.com  / demo1234')
  process.exit(0)
}

seed().catch(err => { console.error('❌', err.message); process.exit(1) })