import React, { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { PhoneOff, Mic, MicOff, Video, VideoOff, MessageSquare, Send } from 'lucide-react'

function CallUI({ roomId, localUser, remoteUserName, onEnd, socketRef }) {
  const localVideoRef  = useRef(null)
  const remoteVideoRef = useRef(null)
  const pcRef          = useRef(null)   // RTCPeerConnection
  const localStream    = useRef(null)
  const chatEndRef     = useRef(null)

  const [audioMuted,   setAudioMuted]   = useState(false)
  const [videoMuted,   setVideoMuted]   = useState(false)
  const [remoteJoined, setRemoteJoined] = useState(false)
  const [messages,     setMessages]     = useState([])
  const [msgInput,     setMsgInput]     = useState('')
  const [showChat,     setShowChat]     = useState(true)
  const [duration,     setDuration]     = useState(0)
  const [camError,     setCamError]     = useState('')

  const fmt = s => `${String(Math.floor(s/60)).padStart(2,'0')}:${String(s%60).padStart(2,'0')}`

  // Timer
  useEffect(() => {
    const t = setInterval(() => setDuration(d => d + 1), 1000)
    return () => clearInterval(t)
  }, [])

  // WebRTC setup
  useEffect(() => {
    if (!roomId || !socketRef?.current) return
    const sock = socketRef.current

    // STUN servers for NAT traversal
    const config = {
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
      ]
    }

    const createPC = () => {
      const pc = new RTCPeerConnection(config)
      pcRef.current = pc

      // Send ICE candidates to remote peer
      pc.onicecandidate = ({ candidate }) => {
        if (candidate) {
          sock.emit('webrtc_ice', { roomId, candidate })
        }
      }

      // When remote stream arrives
      pc.ontrack = (event) => {
        if (remoteVideoRef.current && event.streams[0]) {
          remoteVideoRef.current.srcObject = event.streams[0]
          setRemoteJoined(true)
        }
      }

      pc.onconnectionstatechange = () => {
        if (pc.connectionState === 'connected') setRemoteJoined(true)
        if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed') setRemoteJoined(false)
      }

      return pc
    }

    const start = async () => {
      try {
        // Get camera + mic
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true })
        localStream.current = stream
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream
        }

        const pc = createPC()

        // Add local tracks to peer connection
        stream.getTracks().forEach(track => pc.addTrack(track, stream))

        // Join the call room
        sock.emit('join_call_room', { roomId, userId: localUser?.id })

      } catch (err) {
        console.error('Camera error:', err)
        setCamError(err.name === 'NotAllowedError'
          ? 'Camera/microphone permission denied. Please allow access in browser settings.'
          : 'Could not access camera: ' + err.message)
      }
    }

    // ── Socket signaling handlers ──────────────────────────────────

    // When another user joins → initiator creates offer
    sock.on('webrtc_user_joined', async ({ userId }) => {
      if (userId === localUser?.id) return
      try {
        const pc = pcRef.current
        if (!pc) return
        const offer = await pc.createOffer()
        await pc.setLocalDescription(offer)
        sock.emit('webrtc_offer', { roomId, offer })
      } catch(e) { console.warn('Offer error:', e) }
    })

    // Receive offer → answer it
    sock.on('webrtc_offer', async ({ offer }) => {
      try {
        let pc = pcRef.current
        if (!pc) {
          pc = createPC()
          // Add local stream if available
          localStream.current?.getTracks().forEach(t => pc.addTrack(t, localStream.current))
        }
        await pc.setRemoteDescription(new RTCSessionDescription(offer))
        const answer = await pc.createAnswer()
        await pc.setLocalDescription(answer)
        sock.emit('webrtc_answer', { roomId, answer })
      } catch(e) { console.warn('Answer error:', e) }
    })

    // Receive answer
    sock.on('webrtc_answer', async ({ answer }) => {
      try {
        const pc = pcRef.current
        if (pc && pc.signalingState !== 'stable') {
          await pc.setRemoteDescription(new RTCSessionDescription(answer))
        }
      } catch(e) { console.warn('Answer set error:', e) }
    })

    // Receive ICE candidate
    sock.on('webrtc_ice', async ({ candidate }) => {
      try {
        const pc = pcRef.current
        if (pc && candidate) {
          await pc.addIceCandidate(new RTCIceCandidate(candidate))
        }
      } catch(e) { console.warn('ICE error:', e) }
    })

    // Remote ended call
    sock.on('webrtc_user_left', () => {
      setRemoteJoined(false)
      if (remoteVideoRef.current) remoteVideoRef.current.srcObject = null
    })

    // Chat
    sock.on('call_chat_message', msg => {
      setMessages(prev => [...prev, msg])
    })

    start()

    return () => {
      // Cleanup
      sock.off('webrtc_user_joined')
      sock.off('webrtc_offer')
      sock.off('webrtc_answer')
      sock.off('webrtc_ice')
      sock.off('webrtc_user_left')
      sock.off('call_chat_message')

      localStream.current?.getTracks().forEach(t => t.stop())
      pcRef.current?.close()

      sock.emit('leave_call_room', { roomId })
    }
  }, [roomId])

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const toggleAudio = () => {
    const stream = localStream.current
    if (!stream) return
    stream.getAudioTracks().forEach(t => { t.enabled = audioMuted })
    setAudioMuted(v => !v)
  }

  const toggleVideo = () => {
    const stream = localStream.current
    if (!stream) return
    stream.getVideoTracks().forEach(t => { t.enabled = videoMuted })
    setVideoMuted(v => !v)
  }

  const sendMsg = () => {
    if (!msgInput.trim() || !socketRef?.current) return
    const msg = { id: Date.now(), sender: localUser?.name || 'You', text: msgInput.trim() }
    socketRef.current.emit('call_chat_send', { roomId, msg })
    setMessages(prev => [...prev, msg])
    setMsgInput('')
  }

  return (
    <div style={{ position:'fixed', inset:0, zIndex:9999, display:'flex', flexDirection:'column', background:'#0f172a' }}>
      {/* Top bar */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'10px 16px', background:'#1e293b', borderBottom:'1px solid #334155' }}>
        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
          <div style={{ width:10, height:10, borderRadius:'50%', background: remoteJoined ? '#22c55e' : '#eab308', flexShrink:0 }}/>
          <span style={{ color:'#f1f5f9', fontWeight:600, fontSize:15 }}>{remoteUserName}</span>
          <span style={{ color:'#94a3b8', fontSize:13 }}>
            {remoteJoined ? `Connected · ${fmt(duration)}` : 'Waiting to connect...'}
          </span>
        </div>
        <button onClick={() => setShowChat(v=>!v)}
          style={{ padding:'6px 14px', background: showChat ? '#f97316':'#334155', color:'#fff', border:'none', borderRadius:8, cursor:'pointer', display:'flex', alignItems:'center', gap:6, fontSize:13, fontWeight:600 }}>
          <MessageSquare size={14}/> Chat
        </button>
      </div>

      {/* Body */}
      <div style={{ flex:1, display:'flex', minHeight:0 }}>

        {/* Video */}
        <div style={{ flex:1, position:'relative', background:'#0f172a' }}>

          {/* Remote video */}
          <video ref={remoteVideoRef} autoPlay playsInline
            style={{ width:'100%', height:'100%', objectFit:'cover', position:'absolute', inset:0, display: remoteJoined ? 'block' : 'none' }}/>

          {/* Waiting / error overlay */}
          {!remoteJoined && (
            <div style={{ position:'absolute', inset:0, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center' }}>
              {camError ? (
                <div style={{ textAlign:'center', maxWidth:360, padding:24 }}>
                  <div style={{ fontSize:48, marginBottom:12 }}>🚫</div>
                  <p style={{ color:'#f87171', fontWeight:600, fontSize:16, marginBottom:8 }}>Camera Access Required</p>
                  <p style={{ color:'#94a3b8', fontSize:14, lineHeight:1.6 }}>{camError}</p>
                  <button onClick={onEnd} style={{ marginTop:20, padding:'10px 24px', background:'#ef4444', color:'#fff', border:'none', borderRadius:10, cursor:'pointer', fontWeight:600 }}>
                    End Call
                  </button>
                </div>
              ) : (
                <div style={{ textAlign:'center' }}>
                  <div style={{ width:90, height:90, borderRadius:'50%', background:'#1e293b', display:'flex', alignItems:'center', justifyContent:'center', fontSize:36, fontWeight:700, color:'#f1f5f9', margin:'0 auto 16px' }}>
                    {remoteUserName?.charAt(0)?.toUpperCase()}
                  </div>
                  <p style={{ color:'#f1f5f9', fontWeight:600, fontSize:20 }}>{remoteUserName}</p>
                  <p style={{ color:'#64748b', fontSize:14, marginTop:8 }}>Waiting for them to join...</p>
                  <div style={{ display:'flex', gap:8, justifyContent:'center', marginTop:16 }}>
                    {[0,1,2].map(i => (
                      <div key={i} style={{ width:8, height:8, borderRadius:'50%', background:'#f97316', opacity: 0.3 + i*0.35, animation:`pulse ${1+i*0.3}s ease-in-out infinite` }}/>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Local video PiP */}
          <div style={{ position:'absolute', bottom:16, right:16, width:160, height:120, borderRadius:14, overflow:'hidden', border:'2px solid #334155', background:'#1e293b', zIndex:10 }}>
            <video ref={localVideoRef} autoPlay playsInline muted
              style={{ width:'100%', height:'100%', objectFit:'cover', display: videoMuted ? 'none' : 'block' }}/>
            {videoMuted && (
              <div style={{ width:'100%', height:'100%', display:'flex', alignItems:'center', justifyContent:'center', background:'#1e293b' }}>
                <VideoOff size={24} color="#475569"/>
              </div>
            )}
            <div style={{ position:'absolute', bottom:6, left:8, fontSize:11, color:'#cbd5e1', background:'rgba(0,0,0,0.5)', padding:'2px 8px', borderRadius:6, fontWeight:600 }}>You</div>
          </div>

          {/* Duration */}
          {remoteJoined && (
            <div style={{ position:'absolute', top:12, left:12, background:'rgba(0,0,0,0.6)', color:'#fff', fontSize:14, padding:'4px 12px', borderRadius:20, fontWeight:700 }}>
              {fmt(duration)}
            </div>
          )}
        </div>

        {/* Chat */}
        {showChat && (
          <div style={{ width:300, background:'#1e293b', display:'flex', flexDirection:'column', borderLeft:'1px solid #334155' }}>
            <div style={{ padding:'14px 16px', borderBottom:'1px solid #334155' }}>
              <p style={{ color:'#f1f5f9', fontWeight:600, fontSize:14, margin:0 }}>💬 Chat</p>
              <p style={{ color:'#64748b', fontSize:12, margin:'4px 0 0' }}>Private — only you two</p>
            </div>
            <div style={{ flex:1, overflowY:'auto', padding:12, display:'flex', flexDirection:'column', gap:10 }}>
              {messages.length === 0 && (
                <p style={{ color:'#475569', fontSize:13, textAlign:'center', marginTop:24 }}>No messages yet. Say hi! 👋</p>
              )}
              {messages.map(msg => {
                const isMe = msg.sender === localUser?.name
                return (
                  <div key={msg.id} style={{ display:'flex', flexDirection:'column', alignItems: isMe ? 'flex-end' : 'flex-start' }}>
                    <p style={{ fontSize:11, color:'#64748b', marginBottom:3 }}>{msg.sender}</p>
                    <div style={{
                      padding:'9px 14px',
                      borderRadius: isMe ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
                      background: isMe ? '#f97316' : '#334155',
                      color:'#fff', fontSize:14, maxWidth:'85%', wordBreak:'break-word', lineHeight:1.5
                    }}>
                      {msg.text}
                    </div>
                  </div>
                )
              })}
              <div ref={chatEndRef}/>
            </div>
            <div style={{ padding:10, borderTop:'1px solid #334155', display:'flex', gap:8 }}>
              <input
                style={{ flex:1, background:'#0f172a', color:'#f1f5f9', border:'1px solid #334155', borderRadius:10, padding:'10px 14px', fontSize:14, outline:'none', fontFamily:'inherit' }}
                placeholder="Type a message..."
                value={msgInput}
                onChange={e => setMsgInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && sendMsg()}
              />
              <button onClick={sendMsg} disabled={!msgInput.trim()}
                style={{ padding:'10px 14px', background: msgInput.trim() ? '#f97316' : '#334155', color:'#fff', border:'none', borderRadius:10, cursor: msgInput.trim() ? 'pointer' : 'default', transition:'background 0.2s' }}>
                <Send size={15}/>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Controls */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:16, padding:'16px 0 20px', background:'#1e293b', borderTop:'1px solid #334155' }}>
        <button onClick={toggleAudio} title={audioMuted ? 'Unmute mic' : 'Mute mic'}
          style={{ width:50, height:50, borderRadius:'50%', border:'none', cursor:'pointer', background: audioMuted ? '#ef4444' : '#334155', color:'#fff', display:'flex', alignItems:'center', justifyContent:'center', transition:'background 0.2s' }}>
          {audioMuted ? <MicOff size={20}/> : <Mic size={20}/>}
        </button>
        <button onClick={toggleVideo} title={videoMuted ? 'Show camera' : 'Hide camera'}
          style={{ width:50, height:50, borderRadius:'50%', border:'none', cursor:'pointer', background: videoMuted ? '#ef4444' : '#334155', color:'#fff', display:'flex', alignItems:'center', justifyContent:'center', transition:'background 0.2s' }}>
          {videoMuted ? <VideoOff size={20}/> : <Video size={20}/>}
        </button>
        <button onClick={onEnd} title="End call"
          style={{ width:60, height:60, borderRadius:'50%', border:'none', cursor:'pointer', background:'#ef4444', color:'#fff', display:'flex', alignItems:'center', justifyContent:'center', boxShadow:'0 4px 20px rgba(239,68,68,0.5)', transform:'scale(1.05)' }}>
          <PhoneOff size={26}/>
        </button>
        <button onClick={() => setShowChat(v=>!v)} title="Toggle chat"
          style={{ width:50, height:50, borderRadius:'50%', border:'none', cursor:'pointer', background: showChat ? '#f97316' : '#334155', color:'#fff', display:'flex', alignItems:'center', justifyContent:'center', transition:'background 0.2s' }}>
          <MessageSquare size={20}/>
        </button>
      </div>
    </div>
  )
}

export default function VideoCallModal(props) {
  return createPortal(<CallUI {...props}/>, document.body)
}