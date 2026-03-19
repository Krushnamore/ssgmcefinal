/**
 * Fix existing orders — strip base64 images from items JSON
 * Run: node fix-orders.js
 */
require('dotenv').config()
const { getPool } = require('./config/db')

async function fixOrders() {
  const pool = getPool()
  console.log('Connecting to DB...')

  const [orders] = await pool.execute('SELECT id, items FROM orders')
  console.log(`Found ${orders.length} orders to check`)

  let fixed = 0
  for (const order of orders) {
    try {
      const items = typeof order.items === 'string'
        ? JSON.parse(order.items) : (order.items || [])

      const cleanItems = items.map(item => ({
        ...item,
        // Remove base64 — keep only URL images
        image: (item.image || '').startsWith('data:') ? '' : (item.image || ''),
      }))

      // Only update if something changed
      const before = JSON.stringify(items)
      const after  = JSON.stringify(cleanItems)
      if (before !== after) {
        await pool.execute('UPDATE orders SET items = ? WHERE id = ?', [after, order.id])
        console.log(`  ✓ Fixed order #${order.id} (removed base64 image)`)
        fixed++
      }
    } catch (e) {
      console.error(`  ✗ Order #${order.id} failed:`, e.message)
    }
  }

  console.log(`\nDone! Fixed ${fixed}/${orders.length} orders.`)
  process.exit(0)
}

fixOrders().catch(err => {
  console.error('Fatal:', err.message)
  process.exit(1)
})