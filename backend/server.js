require('dotenv').config()
const path       = require('path')
const express    = require('express')
const cors       = require('cors')
const http       = require('http')
const { Server } = require('socket.io')

const authRoutes         = require('./routes/auth')
const productRoutes      = require('./routes/products')
const orderRoutes        = require('./routes/orders')
const userRoutes         = require('./routes/users')
const liveRoutes         = require('./routes/live')
const videoCallRoutes    = require('./routes/videocalls')
const notificationRoutes = require('./routes/notifications')

const { getPool } = require('./config/db')

const app    = express()
const server = http.createServer(app)

getPool().getConnection()
  .then(conn => { console.log('✅ MySQL connected'); conn.release() })
  .catch(err  => { console.error('❌ MySQL failed:', err.message); process.exit(1) })

const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173'

const io = new Server(server, {
  cors: { origin: FRONTEND_URL, methods: ['GET','POST'], credentials: true }
})

const sessions = {}

io.on('connection', (socket) => {

  socket.on('join_session', ({ sessionId, userId, userName, role }) => {
    socket.join(sessionId)
    if (!sessions[sessionId]) sessions[sessionId] = { messages:[], viewers: new Set() }
    sessions[sessionId].viewers.add(socket.id)
    io.to(sessionId).emit('viewer_count', sessions[sessionId].viewers.size)
    socket.to(sessionId).emit('user_joined', { userName, role })
    socket.emit('message_history', sessions[sessionId].messages.slice(-50))
  })

  socket.on('notify_live_started', async ({ sellerId, sellerName, title, sessionId }) => {
    try {
      const { notify } = require('./utils/notify')
      const pool = getPool()
      const [buyers] = await pool.execute("SELECT id FROM users WHERE role='buyer' AND status='active'")
      for (const b of buyers) {
        await notify(b.id, 'live_started', `${sellerName} is LIVE!`,
          `${sellerName} started: "${title}". Join now!`, { sessionId, sellerId })
      }
      io.emit('live_session_started', { sellerId, sellerName, title, sessionId })
    } catch(e) { console.warn('live notify error:', e.message) }
  })

  socket.on('send_message', ({ sessionId, userId, userName, role, text }) => {
    const msg = { id:Date.now(), userId, userName, role, text, time:new Date().toISOString() }
    if (sessions[sessionId]) sessions[sessionId].messages.push(msg)
    io.to(sessionId).emit('new_message', msg)
  })

  socket.on('showcase_product', ({ sessionId, product }) => socket.to(sessionId).emit('product_showcased', product))
  socket.on('trigger_ar',       ({ sessionId, productId, arMode }) => socket.to(sessionId).emit('ar_triggered', { productId, arMode }))

  socket.on('leave_session', ({ sessionId, userName }) => {
    socket.leave(sessionId)
    if (sessions[sessionId]) {
      sessions[sessionId].viewers.delete(socket.id)
      io.to(sessionId).emit('viewer_count', sessions[sessionId].viewers.size)
    }
  })

  socket.on('call_request',    ({ sellerId, requestId, buyerName, productName }) =>
    io.to(`seller_${sellerId}`).emit('incoming_call', { requestId, buyerName, productName }))

  socket.on('join_seller_room', ({ sellerId }) => socket.join(`seller_${sellerId}`))
  socket.on('join_buyer_room',  ({ buyerId })  => socket.join(`buyer_${buyerId}`))

  socket.on('call_accepted', ({ roomId, buyerId, requestId }) =>
    io.to(`buyer_${buyerId}`).emit('call_accepted', { roomId, requestId }))
  socket.on('call_rejected', ({ buyerId, requestId }) =>
    io.to(`buyer_${buyerId}`).emit('call_rejected', { requestId }))

  socket.on('join_call_room', ({ roomId, userId }) => {
    socket.join(`call_room_${roomId}`)
    socket.to(`call_room_${roomId}`).emit('webrtc_user_joined', { userId, socketId: socket.id })
  })
  socket.on('leave_call_room', ({ roomId }) => {
    socket.leave(`call_room_${roomId}`)
    socket.to(`call_room_${roomId}`).emit('webrtc_user_left', { socketId: socket.id })
  })

  socket.on('webrtc_offer',  ({ roomId, offer })     => socket.to(`call_room_${roomId}`).emit('webrtc_offer',  { offer }))
  socket.on('webrtc_answer', ({ roomId, answer })    => socket.to(`call_room_${roomId}`).emit('webrtc_answer', { answer }))
  socket.on('webrtc_ice',    ({ roomId, candidate }) => socket.to(`call_room_${roomId}`).emit('webrtc_ice',    { candidate }))
  socket.on('call_chat_send', ({ roomId, msg })      => socket.to(`call_room_${roomId}`).emit('call_chat_message', msg))

  socket.on('end_call', ({ roomId, buyerId, sellerId }) => {
    io.to(`buyer_${buyerId}`).emit('call_ended', { roomId })
    io.to(`seller_${sellerId}`).emit('call_ended', { roomId })
  })

  socket.on('seller_ended_live', ({ sessionId }) => io.to(sessionId).emit('live_session_ended', { sessionId }))

  socket.on('disconnect', () => {
    Object.keys(sessions).forEach(sid => {
      if (sessions[sid]?.viewers?.has(socket.id)) {
        sessions[sid].viewers.delete(socket.id)
        io.to(sid).emit('viewer_count', sessions[sid].viewers.size)
      }
    })
  })
})

app.set('io', io)
app.use(cors({ origin: FRONTEND_URL, credentials: true }))
app.use(express.json({ limit: '50mb' }))
app.use(express.urlencoded({ extended: true, limit: '50mb' }))

app.use('/api/auth',          authRoutes)
app.use('/api/products',      productRoutes)
app.use('/api/orders',        orderRoutes)
app.use('/api/users',         userRoutes)
app.use('/api/live',          liveRoutes)
app.use('/api/videocalls',    videoCallRoutes)
app.use('/api/notifications', notificationRoutes)

app.get('/api/health', (_req, res) =>
  res.json({ status:'ok', time: new Date().toISOString() }))

// ── Serve React frontend in production ──────────────────────
if (process.env.NODE_ENV === 'production') {
  const dist = path.join(__dirname, '../frontend/dist')
  app.use(express.static(dist))
  app.get('*', (req, res) => {
    if (!req.path.startsWith('/api') && !req.path.startsWith('/socket.io')) {
      res.sendFile(path.join(dist, 'index.html'))
    }
  })
}

app.use((_req, res) => res.status(404).json({ success:false, message:'Not found' }))
app.use((err, _req, res, _next) => {
  console.error(err)
  res.status(500).json({ success:false, message:'Server error' })
})

const PORT = process.env.PORT || 5000
server.listen(PORT, () => {
  console.log(`\n🚀 VivMart running on http://localhost:${PORT}`)
  console.log(`   Mode: ${process.env.NODE_ENV || 'development'}\n`)
})

module.exports = { app, server, io }