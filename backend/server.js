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
const videoCallRoutes  = require('./routes/videocalls')
const notificationRoutes = require('./routes/notifications')

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

  /* ── Live started notification ── */
  socket.on('notify_live_started', async ({ sellerId, sellerName, title, sessionId }) => {
    try {
      const { notify } = require('./utils/notify')
      const { getPool } = require('./config/db')
      const pool = getPool()
      // Notify all buyers about live session
      const [buyers] = await pool.execute("SELECT id FROM users WHERE role = 'buyer' AND status = 'active'")
      for (const buyer of buyers) {
        await notify(buyer.id, 'live_started', `${sellerName} is LIVE!`,
          `${sellerName} started a live session: "${title}". Join now!`,
          { sessionId, sellerId }
        )
      }
      // Push real-time to all connected clients
      io.emit('live_session_started', { sellerId, sellerName, title, sessionId })
    } catch(e) { console.warn('live notify error:', e.message) }
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

  /* ── 1-to-1 Video Call Signaling ── */
  // Notify seller of new call request
  socket.on('call_request', ({ sellerId, requestId, buyerName, productName }) => {
    io.to(`seller_${sellerId}`).emit('incoming_call', { requestId, buyerName, productName })
  })

  // User joins their personal notification room
  socket.on('join_user_room', ({ userId }) => {
    socket.join(`user_${userId}`)
  })

  // Seller joins their notification room
  socket.on('join_seller_room', ({ sellerId }) => {
    socket.join(`seller_${sellerId}`)
    console.log(`Seller ${sellerId} joined notification room`)
  })

  // Seller accepts — notify buyer
  socket.on('call_accepted', ({ roomId, buyerId, requestId }) => {
    io.to(`buyer_${buyerId}`).emit('call_accepted', { roomId, requestId })
  })

  // Seller rejects — notify buyer
  socket.on('call_rejected', ({ buyerId, requestId }) => {
    io.to(`buyer_${buyerId}`).emit('call_rejected', { requestId })
  })

  // Buyer joins their notification room
  socket.on('join_buyer_room', ({ buyerId }) => {
    socket.join(`buyer_${buyerId}`)
  })

  // 1-to-1 call: join private room + WebRTC signaling
  socket.on('join_call_room', ({ roomId, userId }) => {
    socket.join(`call_room_${roomId}`)
    // Notify the other person in the room that someone joined
    socket.to(`call_room_${roomId}`).emit('webrtc_user_joined', { userId, socketId: socket.id })
  })

  socket.on('leave_call_room', ({ roomId }) => {
    socket.leave(`call_room_${roomId}`)
    socket.to(`call_room_${roomId}`).emit('webrtc_user_left', { socketId: socket.id })
  })

  // WebRTC signaling — relay only to call room
  socket.on('webrtc_offer',  ({ roomId, offer })     => socket.to(`call_room_${roomId}`).emit('webrtc_offer',  { offer }))
  socket.on('webrtc_answer', ({ roomId, answer })    => socket.to(`call_room_${roomId}`).emit('webrtc_answer', { answer }))
  socket.on('webrtc_ice',    ({ roomId, candidate }) => socket.to(`call_room_${roomId}`).emit('webrtc_ice',    { candidate }))

  // 1-to-1 call chat — ONLY sends to call_room participants, not broadcast
  socket.on('call_chat_send', ({ roomId, msg }) => {
    // Send to the private call room only (excludes sender)
    socket.to(`call_room_${roomId}`).emit('call_chat_message', msg)
  })

  // Either party ends the 1-to-1 call
  socket.on('end_call', ({ roomId, buyerId, sellerId }) => {
    io.to(`buyer_${buyerId}`).emit('call_ended', { roomId })
    io.to(`seller_${sellerId}`).emit('call_ended', { roomId })
  })

  // Live session: when seller leaves, end session for all buyers
  socket.on('seller_ended_live', ({ sessionId }) => {
    io.to(sessionId).emit('live_session_ended', { sessionId })
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
app.set('io', io)
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
app.use('/api/videocalls',    videoCallRoutes)
app.use('/api/notifications', notificationRoutes)

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