require('dotenv').config()
const express    = require('express')
const cors       = require('cors')
const http       = require('http')
const { Server } = require('socket.io')

// Routes
const authRoutes     = require('./routes/auth')
const productRoutes  = require('./routes/products')
const orderRoutes    = require('./routes/orders')
const userRoutes     = require('./routes/users')
const liveRoutes     = require('./routes/live')

// Database
const { getPool } = require('./config/db')

const app    = express()
const server = http.createServer(app)

/* ─────────────────────────────────────────────────────────────
   Test DB Connection on Startup
───────────────────────────────────────────────────────────── */
getPool().getConnection()
  .then(conn => {
    console.log('✅ MySQL connected successfully')
    conn.release()
  })
  .catch(err => {
    console.error('❌ MySQL connection failed:', err.message)
    process.exit(1)
  })

/* ─────────────────────────────────────────────────────────────
   Socket.io — real-time chat for live sessions
───────────────────────────────────────────────────────────── */
const io = new Server(server, {
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:5173',
    methods: ['GET', 'POST'],
    credentials: true,
  }
})

// Track active sessions: { [sessionId]: { messages: [], viewers: Set } }
const sessions = {}

io.on('connection', (socket) => {
  console.log('Socket connected:', socket.id)

  /* ── Join a live session room ── */
  socket.on('join_session', ({ sessionId, userId, userName, role }) => {
    socket.join(sessionId)
    if (!sessions[sessionId]) sessions[sessionId] = { messages: [], viewers: new Set() }
    sessions[sessionId].viewers.add(socket.id)

    const viewerCount = sessions[sessionId].viewers.size
    io.to(sessionId).emit('viewer_count', viewerCount)

    // Notify room
    socket.to(sessionId).emit('user_joined', { userName, role, viewerCount })

    // Send message history to newly joined user
    socket.emit('message_history', sessions[sessionId].messages.slice(-50))

    console.log(`${userName} joined session ${sessionId}`)
  })

  /* ── Send a chat message ── */
  socket.on('send_message', ({ sessionId, userId, userName, role, text }) => {
    const msg = {
      id:        Date.now(),
      userId,
      userName,
      role,
      text,
      time:      new Date().toISOString(),
    }
    if (sessions[sessionId]) sessions[sessionId].messages.push(msg)
    io.to(sessionId).emit('new_message', msg)
  })

  /* ── Seller showcases a product (AR trigger for buyers) ── */
  socket.on('showcase_product', ({ sessionId, product }) => {
    socket.to(sessionId).emit('product_showcased', product)
  })

  /* ── Seller triggers AR for all viewers ── */
  socket.on('trigger_ar', ({ sessionId, productId, arMode }) => {
    socket.to(sessionId).emit('ar_triggered', { productId, arMode })
  })

  /* ── Leave session ── */
  socket.on('leave_session', ({ sessionId, userName }) => {
    socket.leave(sessionId)
    if (sessions[sessionId]) {
      sessions[sessionId].viewers.delete(socket.id)
      const viewerCount = sessions[sessionId].viewers.size
      io.to(sessionId).emit('viewer_count', viewerCount)
      socket.to(sessionId).emit('user_left', { userName, viewerCount })
    }
  })

  /* ── Disconnect ── */
  socket.on('disconnect', () => {
    Object.keys(sessions).forEach(sessionId => {
      if (sessions[sessionId]?.viewers?.has(socket.id)) {
        sessions[sessionId].viewers.delete(socket.id)
        io.to(sessionId).emit('viewer_count', sessions[sessionId].viewers.size)
      }
    })
    console.log('Socket disconnected:', socket.id)
  })
})

/* ─────────────────────────────────────────────────────────────
   Middleware
───────────────────────────────────────────────────────────── */
app.use(cors({
  origin:      process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true,
}))
app.use(express.json({ limit: '50mb' }))
app.use(express.urlencoded({ extended: true, limit: '50mb' }))

// Request logger in dev mode
if (process.env.NODE_ENV !== 'production') {
  app.use((req, _res, next) => {
    console.log(`${req.method} ${req.path}`)
    next()
  })
}

/* ─────────────────────────────────────────────────────────────
   Routes
───────────────────────────────────────────────────────────── */
app.use('/api/auth',     authRoutes)
app.use('/api/products', productRoutes)
app.use('/api/orders',   orderRoutes)
app.use('/api/users',    userRoutes)
app.use('/api/live',     liveRoutes)

/* ─── Health check ─────────────────────────────────────────── */
app.get('/api/health', (_req, res) =>
  res.json({ status: 'ok', timestamp: new Date().toISOString(), env: process.env.NODE_ENV })
)

/* ─── 404 handler ──────────────────────────────────────────── */
app.use((_req, res) => res.status(404).json({ success: false, message: 'Route not found' }))

/* ─── Global error handler ─────────────────────────────────── */
app.use((err, _req, res, _next) => {
  console.error('Unhandled error:', err)
  res.status(500).json({ success: false, message: 'Internal server error' })
})

/* ─────────────────────────────────────────────────────────────
   Start
───────────────────────────────────────────────────────────── */
const PORT = process.env.PORT || 5000
server.listen(PORT, () => {
  console.log(`\n🚀 VivMart API + Socket.io running on http://localhost:${PORT}`)
  console.log(`   Environment: ${process.env.NODE_ENV || 'development'}`)
  console.log(`   Frontend:    ${process.env.FRONTEND_URL || 'http://localhost:5173'}\n`)
})

module.exports = { app, server, io }
// TEMP DEBUG — remove after testing
app.get('/api/debug/orders', async (req, res) => {
  try {
    const { getPool } = require('./config/db')
    const pool = getPool()
    const [rows] = await pool.execute('SELECT id, buyer_id, items, status FROM orders ORDER BY id DESC LIMIT 5')
    res.json({ orders: rows.map(r => ({
      id: r.id,
      buyer_id: r.buyer_id,
      status: r.status,
      items: (() => { try { return JSON.parse(r.items) } catch { return r.items } })()
    }))})
  } catch(e) { res.status(500).json({ error: e.message }) }
})