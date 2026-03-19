require('dotenv').config()
const { getPool } = require('./config/db')

async function debug() {
  const pool = getPool()

  // Show users
  const [users] = await pool.execute("SELECT id, name, email, role FROM users WHERE role IN ('seller','buyer')")
  console.log('\n=== USERS ===')
  users.forEach(u => console.log(`  id:${u.id} | ${u.role} | ${u.name} | ${u.email}`))

  // Show orders with sellerId
  const [orders] = await pool.execute('SELECT id, buyer_id, status, items FROM orders ORDER BY id DESC')
  console.log('\n=== ORDERS ===')
  for (const o of orders) {
    try {
      const items = JSON.parse(o.items)
      const sellerIds = [...new Set(items.map(i => i.sellerId))]
      console.log(`Order #${o.id} | buyer:${o.buyer_id} | ${o.status} | sellerIds:[${sellerIds}]`)
      items.forEach(i => console.log(`  - ${i.name} | sellerId:${i.sellerId} | ₹${i.price}`))
    } catch { console.log(`Order #${o.id} - parse error`) }
  }
  process.exit(0)
}
debug().catch(e => { console.error(e.message); process.exit(1) })