require('dotenv').config()
const { getPool } = require('./config/db')

async function debug() {
  const pool = getPool()
  const [orders] = await pool.execute('SELECT id, buyer_id, status, SUBSTRING(items, 1, 500) as items_preview FROM orders ORDER BY id DESC')
  
  console.log('\n=== ORDERS IN DB ===')
  for (const o of orders) {
    console.log(`\nOrder #${o.id} | buyer:${o.buyer_id} | ${o.status}`)
    try {
      const items = JSON.parse(o.items_preview + (o.items_preview.endsWith(']') ? '' : '...'))
      items.forEach(i => console.log(`  Item: ${i.name} | sellerId: ${i.sellerId} | price: ${i.price}`))
    } catch {
      console.log('  items preview:', o.items_preview?.substring(0,100))
    }
  }
  process.exit(0)
}
debug().catch(e => { console.error(e.message); process.exit(1) })