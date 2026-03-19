import React, { useEffect, useRef, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Mic, MicOff, Camera, CameraOff, Users, Send, Sparkles, Radio, StopCircle, Package } from 'lucide-react'
import AgoraRTC from 'agora-rtc-sdk-ng'
import { io } from 'socket.io-client'
import { useAuth } from '../../context/AuthContext'
import api from '../../api'

AgoraRTC.setLogLevel(4) // suppress verbose logs

const SOCKET_URL   = import.meta.env.VITE_SOCKET_URL   || 'http://localhost:5000'
const AGORA_APP_ID = import.meta.env.VITE_AGORA_APP_ID || ''

export default function SellerLive() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [products, setProducts]   = useState([])
  const [title, setTitle]         = useState('')
  const [sessionId, setSessionId] = useState(null)
  const [channel, setChannel]     = useState(null)
  const [isLive, setIsLive]       = useState(false)
  const [starting, setStarting]   = useState(false)
  const [messages, setMessages]   = useState([])
  const [msgInput, setMsgInput]   = useState('')
  const [viewers, setViewers]     = useState(0)
  const [audioMuted, setAudioMuted] = useState(false)
  const [videoMuted, setVideoMuted] = useState(false)
  const [camReady, setCamReady]   = useState(false)
  const [selectedProducts, setSelectedProducts] = useState([])

  const socketRef  = useRef(null)
  const clientRef  = useRef(null)
  const audioRef   = useRef(null)
  const videoRef   = useRef(null)
  const vidElRef   = useRef(null)
  const chatEndRef = useRef(null)

  useEffect(() => {
    api.get(`/products?sellerId=${user?.id}&limit=50`)
      .then(r => setProducts(r.data.products || []))
  }, [user?.id])

  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior:'smooth' }) }, [messages])

  const startLive = async () => {
    if (!title.trim()) { alert('Enter a session title'); return }
    if (!AGORA_APP_ID) { alert('Add VITE_AGORA_APP_ID to frontend/.env'); return }
    setStarting(true)
    try {
      // 1. Create session in DB
      const { data } = await api.post('/live/start', { title: title.trim(), productIds: selectedProducts })
      if (!data.success) throw new Error(data.message)

      setSessionId(data.sessionId)
      setChannel(data.channel)
      setIsLive(true)

      // 2. Socket.io
      const socket = io(SOCKET_URL, { transports:['websocket','polling'] })
      socketRef.current = socket
      socket.emit('join_session', { sessionId: String(data.sessionId), userId: user?.id, userName: user?.name, role:'seller' })
      socket.emit('notify_live_started', { sellerId: user?.id, sellerName: user?.name, title: title.trim(), sessionId: String(data.sessionId) })
      socket.on('new_message', msg => setMessages(prev => [...prev, msg]))
      socket.on('viewer_count', n  => setViewers(n))

      // 3. Agora host
      const client = AgoraRTC.createClient({ mode:'live', codec:'vp8' })
      clientRef.current = client
      await client.setClientRole('host')
      await client.join(AGORA_APP_ID, data.channel, null, user?.id)

      const [aTrack, vTrack] = await AgoraRTC.createMicrophoneAndCameraTracks(
        { encoderConfig:'music_standard' },
        { encoderConfig:'720p_2' }
      )
      audioRef.current = aTrack
      videoRef.current = vTrack

      // Play local preview
      vTrack.play(vidElRef.current)
      // Publish to channel
      await client.publish([aTrack, vTrack])
      setCamReady(true)

    } catch (err) {
      console.error('Start live error:', err)
      alert(err?.response?.data?.message || err.message || 'Failed to start')
      setIsLive(false); setSessionId(null); setChannel(null)
    } finally { setStarting(false) }
  }

  const endLive = async () => {
    if (!confirm('End live session? All viewers will be disconnected.')) return
    if (sessionId) await api.post(`/live/end/${sessionId}`).catch(()=>{})
    socketRef.current?.emit('seller_ended_live', { sessionId: String(sessionId) })
    socketRef.current?.emit('leave_session', { sessionId: String(sessionId), userName: user?.name })
    socketRef.current?.disconnect()
    audioRef.current?.close()
    videoRef.current?.close()
    try { await clientRef.current?.leave() } catch {}
    setIsLive(false); setSessionId(null); setChannel(null)
    setMessages([]); setViewers(0); setCamReady(false)
  }

  const toggleAudio = async () => {
    if (!audioRef.current) return
    const next = !audioMuted
    await audioRef.current.setEnabled(!next)
    setAudioMuted(next)
  }

  const toggleVideo = async () => {
    if (!videoRef.current) return
    const next = !videoMuted
    await videoRef.current.setEnabled(!next)
    setVideoMuted(next)
  }

  const sendMsg = () => {
    if (!msgInput.trim() || !sessionId) return
    socketRef.current?.emit('send_message', {
      sessionId: String(sessionId), userId: user?.id,
      userName: user?.name, role:'seller', text: msgInput.trim(),
    })
    setMsgInput('')
  }

  const showcaseProduct = p => {
    socketRef.current?.emit('showcase_product', { sessionId: String(sessionId), product: p })
    setMessages(prev => [...prev, { id:Date.now(), system:true, text:`📦 Featured: ${p.name}` }])
  }

  // ── Pre-live setup ──────────────────────────────────────
  if (!isLive) return (
    <div className="max-w-xl mx-auto space-y-6 py-4">
      <div>
        <h1 className="page-title">Go Live</h1>
        <p className="text-sm text-gray-500 mt-0.5">Start a live shopping session for your buyers</p>
      </div>

      {!AGORA_APP_ID && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
          ⚠️ <strong>VITE_AGORA_APP_ID</strong> is missing in <code>frontend/.env</code> — live video won't work.
        </div>
      )}

      <div className="card p-6 space-y-4">
        <div>
          <label className="label">Session Title *</label>
          <input className="input" placeholder="e.g. New Arrivals — Summer Collection"
            value={title} onChange={e => setTitle(e.target.value)}/>
        </div>
        <div>
          <label className="label">Products to showcase</label>
          <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto">
            {products.map(p => (
              <label key={p.id} className={`flex items-center gap-2 p-2 rounded-xl border cursor-pointer transition-all ${selectedProducts.includes(p.id)?'border-brand-400 bg-brand-50':'border-gray-200'}`}>
                <input type="checkbox" checked={selectedProducts.includes(p.id)}
                  onChange={e => setSelectedProducts(prev => e.target.checked ? [...prev,p.id] : prev.filter(x=>x!==p.id))}
                  className="accent-brand-500"/>
                <span className="text-xs font-medium text-gray-700 truncate">{p.name}</span>
              </label>
            ))}
          </div>
        </div>
        <button onClick={startLive} disabled={starting || !title.trim()}
          className="btn-primary w-full justify-center py-3 text-base gap-3">
          {starting
            ? <><span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"/> Starting...</>
            : <><Radio size={18}/> Go Live Now</>
          }
        </button>
      </div>
    </div>
  )

  // ── Live broadcast UI ───────────────────────────────────
  return (
    <div className="grid lg:grid-cols-3 gap-4 h-full">
      {/* Video + controls */}
      <div className="lg:col-span-2 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1.5 bg-red-500 text-white text-xs font-bold px-3 py-1.5 rounded-full">
              <span className="w-2 h-2 rounded-full bg-white animate-pulse"/> LIVE
            </span>
            <p className="font-semibold text-gray-800">{title}</p>
            <span className="flex items-center gap-1 text-sm text-gray-500"><Users size={14}/> {viewers}</span>
          </div>
          <button onClick={endLive} className="flex items-center gap-2 px-4 py-2 bg-red-500 hover:bg-red-600 text-white font-semibold rounded-xl text-sm">
            <StopCircle size={16}/> End Live
          </button>
        </div>

        {/* Camera preview */}
        <div className="relative rounded-2xl overflow-hidden bg-gray-900 aspect-video">
          <div ref={vidElRef} className="w-full h-full"/>
          {!camReady && (
            <div className="absolute inset-0 flex items-center justify-center bg-gray-900">
              <div className="text-center text-white">
                <div className="w-12 h-12 border-3 border-white border-t-transparent rounded-full animate-spin mx-auto mb-3"/>
                <p className="text-sm">Starting camera...</p>
              </div>
            </div>
          )}
          <div className="absolute bottom-3 right-3 flex gap-2">
            <button onClick={toggleAudio} className={`w-9 h-9 rounded-full flex items-center justify-center ${audioMuted?'bg-red-500':'bg-black/50'} text-white`}>
              {audioMuted ? <MicOff size={15}/> : <Mic size={15}/>}
            </button>
            <button onClick={toggleVideo} className={`w-9 h-9 rounded-full flex items-center justify-center ${videoMuted?'bg-red-500':'bg-black/50'} text-white`}>
              {videoMuted ? <CameraOff size={15}/> : <Camera size={15}/>}
            </button>
          </div>
        </div>

        {/* Showcase products */}
        <div>
          <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2 flex items-center gap-1"><Package size={12}/> Showcase to Viewers</p>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {products.filter(p => selectedProducts.includes(p.id) || selectedProducts.length === 0).slice(0,8).map(p => (
              <button key={p.id} onClick={() => showcaseProduct(p)}
                className="flex-shrink-0 flex flex-col items-center gap-1 p-2 rounded-xl border border-gray-200 hover:border-brand-400 hover:bg-brand-50 transition-all w-20">
                <div className="w-12 h-12 rounded-lg overflow-hidden bg-gray-100">
                  {p.image_url ? <img src={p.image_url} alt={p.name} className="w-full h-full object-cover"/> : <div className="w-full h-full flex items-center justify-center text-lg">📦</div>}
                </div>
                <p className="text-xs text-gray-600 truncate w-full text-center">{p.name}</p>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Live chat */}
      <div className="card flex flex-col h-96 lg:h-auto">
        <div className="p-3 border-b border-gray-100">
          <p className="font-semibold text-gray-800 text-sm flex items-center gap-2"><Users size={14}/> Live Chat</p>
        </div>
        <div className="flex-1 overflow-y-auto p-3 space-y-2 min-h-0">
          {messages.map((msg, i) => (
            <div key={msg.id || i}>
              {msg.system ? (
                <p className="text-xs text-gray-400 text-center">{msg.text}</p>
              ) : (
                <div className={`flex flex-col ${msg.userId === user?.id ? 'items-end' : 'items-start'}`}>
                  <p className="text-xs text-gray-400 mb-0.5">{msg.userName}</p>
                  <div className={`px-3 py-1.5 rounded-2xl text-sm max-w-[85%] ${msg.userId===user?.id?'bg-brand-500 text-white':'bg-gray-100 text-gray-800'}`}>
                    {msg.text}
                  </div>
                </div>
              )}
            </div>
          ))}
          <div ref={chatEndRef}/>
        </div>
        <div className="p-2 border-t border-gray-100 flex gap-2">
          <input className="input flex-1 text-sm" placeholder="Say something..." value={msgInput}
            onChange={e => setMsgInput(e.target.value)} onKeyDown={e => e.key==='Enter' && sendMsg()}/>
          <button onClick={sendMsg} className="p-2 bg-brand-500 text-white rounded-xl hover:bg-brand-600">
            <Send size={14}/>
          </button>
        </div>
      </div>
    </div>
  )
}