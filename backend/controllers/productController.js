const { validationResult } = require('express-validator')
const { getPool } = require('../config/db')

/* ── helper: normalize a DB row for the frontend ── */
const transform = (row) => ({
  ...row,
  price:          parseFloat(row.price),
  original_price: row.original_price ? parseFloat(row.original_price) : null,
  rating:         parseFloat(row.rating || 0),
  review_count:   parseInt(row.review_count || 0),
  featured:       Boolean(row.featured),
  active:         Boolean(row.active),
  colors: (() => {
    try { return typeof row.colors === 'string' ? JSON.parse(row.colors) : (row.colors || []) }
    catch { return [] }
  })(),
  sizes: (() => {
    try { return typeof row.sizes === 'string' ? JSON.parse(row.sizes) : (row.sizes || []) }
    catch { return [] }
  })(),
  // Ensure image_url always has correct Unsplash format
  image_url: (row.image_url || '').replace(/\?w=600(?!&auto)/, '?w=600&auto=format&fit=crop&q=80'),
})

/* ─── GET /api/products ───────────────────────────── */
exports.getProducts = async (req, res) => {
  try {
    const pool = getPool()
    const { category, search, arMode, featured, sellerId, limit = 50, offset = 0 } = req.query

    let sql    = 'SELECT p.*, u.name AS seller_name FROM products p LEFT JOIN users u ON p.seller_id = u.id WHERE p.active = 1'
    const params = []

    if (category) { sql += ' AND p.category = ?';  params.push(category) }
    if (arMode)   { sql += ' AND p.ar_mode = ?';   params.push(arMode)   }
    if (featured) { sql += ' AND p.featured = 1'                          }
    if (sellerId) { sql += ' AND p.seller_id = ?'; params.push(parseInt(sellerId)) }
    if (search) {
      sql += ' AND (p.name LIKE ? OR p.description LIKE ? OR p.category LIKE ?)'
      const q = `%${search}%`
      params.push(q, q, q)
    }

    const limitNum  = Math.max(1, parseInt(limit)  || 50)
    const offsetNum = Math.max(0, parseInt(offset) || 0)
    sql += ` ORDER BY p.featured DESC, p.created_at DESC LIMIT ${limitNum} OFFSET ${offsetNum}`

    const [rows]     = await pool.query(sql, params)
    const [countRow] = await pool.query('SELECT COUNT(*) AS total FROM products WHERE active = 1')

    return res.json({ success: true, products: rows.map(transform), total: countRow[0].total })
  } catch (err) {
    console.error('Products fetch error:', err)
    return res.status(500).json({ success: false, message: 'Failed to fetch products' })
  }
}

/* ─── GET /api/products/:id ──────────────────────── */
exports.getProductById = async (req, res) => {
  try {
    const pool   = getPool()
    const [rows] = await pool.query(
      'SELECT p.*, u.name AS seller_name, u.email AS seller_email FROM products p LEFT JOIN users u ON p.seller_id = u.id WHERE p.id = ? AND p.active = 1',
      [req.params.id]
    )
    if (!rows.length)
      return res.status(404).json({ success: false, message: 'Product not found' })
    return res.json({ success: true, product: transform(rows[0]) })
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Failed to fetch product' })
  }
}

/* ─── GET /api/products/:id/model ───────────────── */
exports.getProductModel = async (req, res) => {
  try {
    const pool   = getPool()
    const [rows] = await pool.query(
      'SELECT id, name, category, ar_mode, model_url, colors, sizes FROM products WHERE id = ? AND active = 1',
      [req.params.id]
    )
    if (!rows.length)
      return res.status(404).json({ success: false, message: 'Product not found' })
    return res.json({ success: true, ...transform(rows[0]) })
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Failed to fetch model data' })
  }
}

/* ─── POST /api/products ─────────────────────────── */
exports.createProduct = async (req, res) => {
  const errors = validationResult(req)
  if (!errors.isEmpty())
    return res.status(400).json({ success: false, message: errors.array()[0].msg })

  const {
    name, category, price, original_price, description,
    image_url, model_url, ar_mode, badge, colors, sizes, featured
  } = req.body

  try {
    const pool = getPool()
    const [result] = await pool.query(
      `INSERT INTO products
         (name, category, ar_mode, price, original_price, description,
          image_url, model_url, badge, colors, sizes, featured, seller_id, active)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`,
      [
        name, category, ar_mode || '3d', parseFloat(price),
        original_price ? parseFloat(original_price) : null,
        description || '', image_url || '', model_url || '', badge || '',
        JSON.stringify(colors || []), JSON.stringify(sizes || []),
        featured ? 1 : 0, req.user.id
      ]
    )
    return res.status(201).json({ success: true, productId: result.insertId, message: 'Product created' })
  } catch (err) {
    console.error('Create product error:', err)
    return res.status(500).json({ success: false, message: 'Failed to create product' })
  }
}

/* ─── PUT /api/products/:id ─────────────────────── */
exports.updateProduct = async (req, res) => {
  try {
    const pool   = getPool()
    const [rows] = await pool.query('SELECT seller_id FROM products WHERE id = ?', [req.params.id])
    if (!rows.length)
      return res.status(404).json({ success: false, message: 'Product not found' })

    if (req.user.role === 'seller' && rows[0].seller_id !== req.user.id)
      return res.status(403).json({ success: false, message: 'You can only edit your own products' })

    const { name, price, description, image_url, featured, active } = req.body
    await pool.query(
      'UPDATE products SET name = ?, price = ?, description = ?, image_url = ?, featured = ?, active = ?, updated_at = NOW() WHERE id = ?',
      [name, parseFloat(price), description, image_url, featured ? 1 : 0, active !== false ? 1 : 0, req.params.id]
    )
    return res.json({ success: true, message: 'Product updated' })
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Failed to update product' })
  }
}

/* ─── DELETE /api/products/:id ──────────────────── */
exports.deleteProduct = async (req, res) => {
  try {
    const pool = getPool()
    // Sellers can only delete their own products; admins can delete any
    if (req.user.role === 'seller') {
      const [rows] = await pool.execute('SELECT seller_id FROM products WHERE id = ?', [req.params.id])
      if (!rows.length) return res.status(404).json({ success: false, message: 'Product not found' })
      if (rows[0].seller_id !== req.user.id)
        return res.status(403).json({ success: false, message: 'You can only delete your own products' })
    }
    await pool.execute('DELETE FROM products WHERE id = ?', [req.params.id])
    return res.json({ success: true, message: 'Product deleted' })
  } catch (err) {
    console.error('Delete product error:', err.message)
    return res.status(500).json({ success: false, message: 'Failed to delete product' })
  }
}