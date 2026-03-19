import React, { useEffect, useRef, useState, useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Eye, Send, Video, Users, ShoppingCart, Sparkles, ArrowLeft, Package } from 'lucide-react'
import AgoraRTC from 'agora-rtc-sdk-ng'
import { io } from 'socket.io-client'
import { useAuth } from '../../context/AuthContext'
import { useCart } from '../../context/CartContext'
import api from '../../api'

AgoraRTC.setLogLevel(4)

const SOCKET_URL   = import.meta.env.VITE_SOCKET_URL   || 'http://localhost:5000'
const AGORA_APP_ID = import.meta.env.VITE_AGORA_APP_ID || ''

function SessionCard({ session, onJoin }) {
  return (
    <div onClick={() => onJoin(session)} className="card overflow-hidden cursor-pointer hover:shadow-lg transition-all">
      <div className="aspect-video bg-gradient-to-br from-gray-900 to-gray-800 flex items-center justify-center relative">
        <Video size={32} className="text-white/30"/>
        <div className="absolute top-3 left-3 flex items-center gap-1.5 bg-red-500 text-white text-xs font-bold px-2.5 py-1 rounded-full">
          <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse"/>LIVE
        </div>
        <div className="absolute top-3 right-3 flex items-center gap-1 bg-black/60 text-white text-xs px-2.5 py-1 rounded-full">
          <Eye size={11}/> {session.viewers || 0}
        </div>
      </div>
      <div className="p-4">
        <p className="font-semibold text-gray-800 truncate">{session.title}</p>
        <p className="text-sm text-gray-500 mt-0.5">by {session.seller_name}</p>
        <button className="btn-primary w-full justify-center mt-3 text-sm py-2.5">Join Live</button>
      </div>
    </div>
  )
}

export default function BuyerLiveSession() {
  const { user }   = useAuth()
  const { addItem} = useCart()
  const [searchParams] = useSearchParams()

  const [sessions, setSessions]         = useState([])
  const [loading, setLoading]           = useState(true)
  const [activeSession, setActiveSession] = useState(null)
  const [messages, setMessages]         = useState([])
  const [msgInput, setMsgInput]         = useState('')
  const [streamActive, setStreamActive] = useState(false)
  const [viewerCount, setViewerCount]   = useState(0)
  const [showcasedProduct, setShowcasedProduct] = useState(null)
  const [sessionProducts, setSessionProducts]   = useState([])

  const socketRef  = useRef(null)
  const clientRef  = useRef(null)
  const vidElRef   = useRef(null)
  const chatEndRef = useRef(null)

  const loadSessions = useCallback(() => {
    api.get('/live/sessions').then(r => setSessions(r.data.sessions || [])).finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    loadSessions()
    const t = setInterval(loadSessions, 10000)
    return () => clearInterval(t)
  }, [loadSessions])

  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior:'smooth' }) }, [messages])

  // Auto-join from URL param
  useEffect(() => {
    const paramId = searchParams.get('session')
    if (paramId && sessions.length && !activeSession) {
      const found = sessions.find(s => s.id === parseInt(paramId))
      if (found) joinSession(found)
    }
  }, [sessions, searchParams])

  const joinSession = async (session) => {
    setActiveSession(session)
    setMessages([])
    setStreamActive(false)
    setViewerCount(0)
    setSessionProducts([])

    api.put(`/live/${session.id}/viewers`, { action:'join' }).catch(()=>{})

    // Load session products
    try {
      const ids = JSON.parse(session.product_ids || '[]')
      if (ids.length) {
        const results = await Promise.all(ids.map(id => api.get(`/products/${id}`).then(r => r.data.product).catch(()=>null)))
        setSessionProducts(results.filter(Boolean))
      }
    } catch {}

    // Socket
    const socket = io(SOCKET_URL, { transports:['websocket','polling'] })
    socketRef.current = socket
    socket.emit('join_session', { sessionId: String(session.id), userId: user?.id, userName: user?.name, role:'buyer' })

    socket.on('new_message',      msg  => setMessages(prev => [...prev, msg]))
    socket.on('viewer_count',     n    => setViewerCount(n))
    socket.on('product_showcased', p   => { setShowcasedProduct(p); setTimeout(()=>setShowcasedProduct(null), 8000) })
    socket.on('live_session_ended', () => { alert('The seller has ended this live session.'); leaveSession() })

    // Agora audience
    if (AGORA_APP_ID && session.channel) {
      try {
        const client = AgoraRTC.createClient({ mode:'live', codec:'vp8' })
        clientRef.current = client

        // MUST set role before join
        await client.setClientRole('audience', { level: 1 })
        await client.join(AGORA_APP_ID, session.channel, null, user?.id || null)

        // Listen for host publishing stream
        client.on('user-published', async (remoteUser, mediaType) => {
          await client.subscribe(remoteUser, mediaType)

          if (mediaType === 'video') {
            // Give DOM a moment to render
            await new Promise(r => setTimeout(r, 500))
            if (vidElRef.current) {
              remoteUser.videoTrack.play(vidElRef.current)
              setStreamActive(true)
            }
          }
          if (mediaType === 'audio') {
            remoteUser.audioTrack?.play()
          }
        })

        client.on('user-unpublished', (_, mt) => {
          if (mt === 'video') setStreamActive(false)
        })
        client.on('user-left', () => setStreamActive(false))

      } catch(e) {
        console.warn('Agora audience error:', e.message)
      }
    }
  }

  const leaveSession = async () => {
    if (activeSession) {
      socketRef.current?.emit('leave_session', { sessionId: String(activeSession.id), userName: user?.name })
      api.put(`/live/${activeSession.id}/viewers`, { action:'leave' }).catch(()=>{})
    }
    socketRef.current?.disconnect()
    try { await clientRef.current?.leave() } catch {}
    setActiveSession(null); setMessages([]); setStreamActive(false)
    setViewerCount(0); setSessionProducts([]); setShowcasedProduct(null)
    loadSessions()
  }

  const sendMsg = () => {
    if (!msgInput.trim() || !activeSession) return
    socketRef.current?.emit('send_message', {
      sessionId: String(activeSession.id), userId: user?.id,
      userName: user?.name || 'Guest', role:'buyer', text: msgInput.trim(),
    })
    setMsgInput('')
  }

  // ── Sessions list ─────────────────────────────────────────────
  if (!activeSession) return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-title">Live Shopping</h1>
          <p className="text-sm text-gray-500 mt-0.5">Watch sellers demo products in real-time</p>
        </div>
        <button onClick={loadSessions} className="btn-secondary text-sm py-2">Refresh</button>
      </div>
      {loading ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(3)].map((_,i) => <div key={i} className="card h-64 animate-pulse"/>)}
        </div>
      ) : sessions.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <div className="w-20 h-20 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-4">
            <Video size={32} className="text-red-400"/>
          </div>
          <p className="font-semibold text-gray-700 text-lg">No live sessions right now</p>
          <p className="text-sm text-gray-400 mt-1">Check back soon!</p>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {sessions.map(s => <SessionCard key={s.id} session={s} onJoin={joinSession}/>)}
        </div>
      )}
    </div>
  )

  // ── Active live session ───────────────────────────────────────
  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={leaveSession} className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-xl">
            <ArrowLeft size={18}/>
          </button>
          <span className="flex items-center gap-1.5 bg-red-500 text-white text-xs font-bold px-3 py-1.5 rounded-full">
            <span className="w-2 h-2 rounded-full bg-white animate-pulse"/> LIVE
          </span>
          <div>
            <p className="font-semibold text-gray-800">{activeSession.title}</p>
            <p className="text-xs text-gray-500">by {activeSession.seller_name} · <Users size={10} className="inline"/> {viewerCount} watching</p>
          </div>
        </div>
        <button onClick={leaveSession} className="btn-secondary text-sm py-2">Leave</button>
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        {/* Video */}
        <div className="lg:col-span-2 space-y-3">
          <div className="relative rounded-2xl overflow-hidden bg-gray-900 aspect-video">
            {/* Agora remote video container */}
            <div ref={vidElRef} className="w-full h-full absolute inset-0"/>

            {!streamActive && (
              <div className="absolute inset-0 flex flex-col items-center justify-center text-white">
                <div className="w-16 h-16 rounded-full bg-white/10 flex items-center justify-center mb-3">
                  <Video size={28} className="text-white/50"/>
                </div>
                <p className="font-semibold">Connecting to stream...</p>
                <p className="text-sm text-white/60 mt-1">
                  {AGORA_APP_ID ? 'Stream will appear when seller starts broadcasting' : '⚠️ VITE_AGORA_APP_ID not set'}
                </p>
              </div>
            )}

            {/* Showcased product popup */}
            {showcasedProduct && (
              <div className="absolute bottom-4 left-4 right-4 bg-white/95 backdrop-blur rounded-2xl p-3 shadow-xl flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl overflow-hidden bg-gray-100 flex-shrink-0">
                  {showcasedProduct.image_url
                    ? <img src={showcasedProduct.image_url} alt={showcasedProduct.name} className="w-full h-full object-cover"/>
                    : <div className="w-full h-full flex items-center justify-center">📦</div>
                  }
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-gray-800 text-sm truncate">{showcasedProduct.name}</p>
                  <p className="text-brand-600 font-bold text-sm">₹{Number(showcasedProduct.price).toLocaleString('en-IN')}</p>
                </div>
                <button onClick={() => addItem(showcasedProduct)}
                  className="p-2 bg-brand-500 text-white rounded-xl hover:bg-brand-600 flex-shrink-0">
                  <ShoppingCart size={16}/>
                </button>
              </div>
            )}

            <div className="absolute top-3 right-3 flex items-center gap-1.5 bg-black/60 text-white text-xs px-2.5 py-1.5 rounded-full">
              <Eye size={12}/> {viewerCount}
            </div>
          </div>

          {/* Products being showcased */}
          {sessionProducts.length > 0 && (
            <div>
              <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2 flex items-center gap-1">
                <Package size={12}/> Products in this session
              </p>
              <div className="flex gap-2 overflow-x-auto pb-1">
                {sessionProducts.map(p => (
                  <div key={p.id} className="flex-shrink-0 flex flex-col items-center gap-1 p-2 rounded-xl border border-gray-200 w-24">
                    <div className="w-14 h-14 rounded-lg overflow-hidden bg-gray-100">
                      {p.image_url
                        ? <img src={p.image_url} alt={p.name} className="w-full h-full object-cover"/>
                        : <div className="w-full h-full flex items-center justify-center text-xl">📦</div>
                      }
                    </div>
                    <p className="text-xs font-semibold text-gray-700 truncate w-full text-center">{p.name}</p>
                    <p className="text-xs font-bold text-brand-600">₹{Number(p.price).toLocaleString('en-IN')}</p>
                    <button onClick={() => addItem(p)} className="w-full text-xs bg-brand-500 text-white rounded-lg py-1 hover:bg-brand-600">
                      Add
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Live chat */}
        <div className="card flex flex-col h-80 lg:h-auto">
          <div className="p-3 border-b border-gray-100">
            <p className="font-semibold text-gray-800 text-sm flex items-center gap-2"><Users size={14}/> Live Chat</p>
          </div>
          <div className="flex-1 overflow-y-auto p-3 space-y-2 min-h-0">
            {messages.map((msg, i) => (
              <div key={msg.id || i}>
                {msg.system ? (
                  <p className="text-xs text-gray-400 text-center italic">{msg.text}</p>
                ) : (
                  <div className={`flex flex-col ${msg.userId === user?.id ? 'items-end' : 'items-start'}`}>
                    <p className="text-xs text-gray-400 mb-0.5">{msg.userName}</p>
                    <div className={`px-3 py-1.5 rounded-2xl text-sm max-w-[85%] break-words ${msg.userId===user?.id ? 'bg-brand-500 text-white' : 'bg-gray-100 text-gray-800'}`}>
                      {msg.text}
                    </div>
                  </div>
                )}
              </div>
            ))}
            <div ref={chatEndRef}/>
          </div>
          <div className="p-2 border-t border-gray-100 flex gap-2">
            <input className="input flex-1 text-sm" placeholder="Say something..."
              value={msgInput} onChange={e => setMsgInput(e.target.value)}
              onKeyDown={e => e.key==='Enter' && sendMsg()}/>
            <button onClick={sendMsg} className="p-2 bg-brand-500 text-white rounded-xl hover:bg-brand-600">
              <Send size={14}/>
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}