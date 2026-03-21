import React, { useEffect, useState, useRef } from 'react'
import { useParams, Link } from 'react-router-dom'
import { ShoppingCart, Sparkles, Star, ArrowLeft, Package, Truck, Shield, Heart, Video, X, Phone } from 'lucide-react'
import { createPortal } from 'react-dom'
import { useCart } from '../../context/CartContext'
import { useAuth } from '../../context/AuthContext'
import { io } from 'socket.io-client'
import api from '../../api'
import VideoCallModal from '../../components/videocall/VideoCallModal'
import { BodyTryOn, FaceTryOn, RoomPlacement, ProductViewer3D } from '../../components/ar/ARComponents'

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:5000'

const AR_LABEL = {
  body:  'Body Try-On',
  face:  'Face Try-On',
  room:  'Room Placement',
  '3d':  '3D View',
  shoes: 'Shoe Try-On',
}

/* ── AR Fullscreen Modal ─────────────────────────── */
function ARModal({ product, onClose }) {
  const mode = product?.ar_mode
  const props = { product, onClose }

  const content = (
    <div style={{ position:'fixed', inset:0, zIndex:9998, background:'#000', display:'flex', flexDirection:'column' }}>
      {/* Close button */}
      <div style={{ position:'absolute', top:16, right:16, zIndex:10 }}>
        <button onClick={onClose}
          style={{ width:40, height:40, borderRadius:'50%', background:'rgba(0,0,0,0.6)', border:'none', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center' }}>
          <X size={20} color="#fff"/>
        </button>
      </div>
      {/* AR label */}
      <div style={{ position:'absolute', top:16, left:16, zIndex:10 }}>
        <span style={{ background:'rgba(0,0,0,0.6)', color:'#fff', fontSize:13, fontWeight:600, padding:'6px 14px', borderRadius:20 }}>
          ✨ {AR_LABEL[mode] || '3D View'} — {product.name}
        </span>
      </div>
      {/* AR Component */}
      <div style={{ flex:1 }}>
        {(mode === 'body' || mode === 'shoes') && <BodyTryOn {...props}/>}
        {mode === 'face' && <FaceTryOn {...props}/>}
        {mode === 'room' && <RoomPlacement {...props}/>}
        {(mode === '3d' || !mode) && <ProductViewer3D {...props}/>}
      </div>
    </div>
  )

  return createPortal(content, document.body)
}

export default function BuyerProductDetail() {
  const { id } = useParams()
  const { addItem } = useCart()
  const { user } = useAuth()

  const [product, setProduct]       = useState(null)
  const [loading, setLoading]       = useState(true)
  const [selectedColor, setSelectedColor] = useState(null)
  const [selectedSize,  setSelectedSize]  = useState(null)
  const [qty,     setQty]     = useState(1)
  const [added,   setAdded]   = useState(false)
  const [wished,  setWished]  = useState(false)
  const [related, setRelated] = useState([])

  // AR state
  const [showAR, setShowAR] = useState(false)

  // Video call states
  const [callStatus,    setCallStatus]    = useState(null)
  const [callRequestId, setCallRequestId] = useState(null)
  const [activeRoomId,  setActiveRoomId]  = useState(null)
  const [callMessage,   setCallMessage]   = useState('')
  const [showCallModal, setShowCallModal] = useState(false)
  const socketRef = useRef(null)
  const pollRef   = useRef(null)

  useEffect(() => {
    setLoading(true)
    api.get(`/products/${id}`)
      .then(r => {
        const p = r.data.product
        setProduct(p)
        setSelectedColor(p.colors?.[0] || null)
        setSelectedSize(p.sizes?.[0]   || null)
        return api.get(`/products?category=${p.category}&limit=4`)
      })
      .then(r => setRelated((r.data.products || []).filter(p => p.id !== parseInt(id))))
      .catch(() => setProduct(null))
      .finally(() => setLoading(false))
  }, [id])

  // Socket for video call
  useEffect(() => {
    if (!user) return
    const socket = io(SOCKET_URL, { transports:['websocket','polling'] })
    socketRef.current = socket
    socket.emit('join_buyer_room', { buyerId: user.id })

    socket.on('call_accepted', ({ roomId }) => {
      setCallStatus('active')
      setActiveRoomId(roomId)
      setShowCallModal(true)
      socket.emit('join_call_room', { roomId })
      clearInterval(pollRef.current)
    })
    socket.on('call_rejected', () => {
      setCallStatus('rejected')
      clearInterval(pollRef.current)
      setTimeout(() => setCallStatus(null), 3000)
    })
    socket.on('call_ended', () => {
      setShowCallModal(false)
      setCallStatus(null)
      setActiveRoomId(null)
    })
    return () => { socket.disconnect(); clearInterval(pollRef.current) }
  }, [user])

  const requestCall = async () => {
    if (!product?.seller_id) return
    setCallStatus('requesting')
    try {
      const { data } = await api.post('/videocalls/request', {
        sellerId: product.seller_id,
        productId: product.id,
        productName: product.name,
        message: callMessage || `I want to ask about ${product.name}`,
      })
      if (data.success) {
        setCallRequestId(data.requestId)
        setCallStatus('waiting')
        socketRef.current?.emit('call_request', {
          sellerId:    product.seller_id,
          requestId:   data.requestId,
          buyerName:   user?.name,
          productName: product.name,
        })
        pollRef.current = setInterval(async () => {
          try {
            const r = await api.get(`/videocalls/status/${data.requestId}`)
            if (r.data.request.status === 'accepted') {
              setCallStatus('active')
              setActiveRoomId(r.data.request.room_id)
              setShowCallModal(true)
              clearInterval(pollRef.current)
            } else if (r.data.request.status === 'rejected') {
              setCallStatus('rejected')
              clearInterval(pollRef.current)
              setTimeout(() => setCallStatus(null), 3000)
            }
          } catch {}
        }, 3000)
      }
    } catch (err) {
      setCallStatus(null)
      alert(err?.response?.data?.message || 'Failed to send request')
    }
  }

  const endCall = async () => {
    if (callRequestId) await api.put(`/videocalls/${callRequestId}/end`).catch(()=>{})
    socketRef.current?.emit('end_call', {
      roomId:   activeRoomId,
      buyerId:  user?.id,
      sellerId: product?.seller_id,
    })
    setShowCallModal(false)
    setCallStatus(null)
    setActiveRoomId(null)
  }

  const cancelRequest = () => {
    clearInterval(pollRef.current)
    setCallStatus(null)
    setCallRequestId(null)
  }

  const discount = product?.original_price
    ? Math.round((1 - product.price / product.original_price) * 100) : null

  if (loading) return (
    <div className="space-y-6 animate-pulse">
      <div className="h-6 bg-gray-200 rounded w-32"/>
      <div className="grid md:grid-cols-2 gap-8">
        <div className="aspect-square bg-gray-200 rounded-2xl"/>
        <div className="space-y-4"><div className="h-8 bg-gray-200 rounded w-3/4"/></div>
      </div>
    </div>
  )

  if (!product) return (
    <div className="text-center py-20">
      <p className="text-4xl mb-3">😕</p>
      <p className="font-semibold text-gray-700">Product not found</p>
      <Link to="/buyer/products" className="btn-primary mt-4 text-sm inline-flex">Back to Products</Link>
    </div>
  )

  return (
    <>
      {/* AR Modal — fullscreen overlay on same page */}
      {showAR && <ARModal product={product} onClose={() => setShowAR(false)}/>}

      {/* Video Call Modal */}
      {showCallModal && activeRoomId && (
        <VideoCallModal
          roomId={activeRoomId}
          localUser={user}
          remoteUserName={product.seller_name}
          onEnd={endCall}
          socketRef={socketRef}
        />
      )}

      <div className="space-y-8">
        <Link to="/buyer/products" className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-brand-600">
          <ArrowLeft size={16}/> Back to Products
        </Link>

        <div className="grid md:grid-cols-2 gap-8">
          {/* Image */}
          <div className="space-y-3">
            <div className="relative rounded-2xl overflow-hidden aspect-square bg-gray-100">
              {product.image_url
                ? <img src={product.image_url} alt={product.name} className="w-full h-full object-cover"/>
                : <div className="w-full h-full flex items-center justify-center text-6xl">🛍️</div>
              }
              <div className="absolute top-3 left-3 flex flex-col gap-2">
                {discount > 0 && <span className="badge bg-brand-500 text-white">-{discount}%</span>}
                {product.badge && <span className="badge-orange">{product.badge}</span>}
              </div>
              <button onClick={() => setWished(v=>!v)}
                className="absolute top-3 right-3 w-9 h-9 rounded-full bg-white shadow-md flex items-center justify-center">
                <Heart size={16} className={wished ? 'fill-red-500 text-red-500' : 'text-gray-400'}/>
              </button>
            </div>

            {/* AR Try-On button — opens on THIS page as overlay */}
            <button
              onClick={() => setShowAR(true)}
              className="w-full flex items-center justify-center gap-2 py-3 bg-gradient-to-r from-brand-500 to-purple-500 hover:from-brand-600 hover:to-purple-600 text-white font-bold rounded-2xl text-base transition-all shadow-md"
            >
              <Sparkles size={18}/> Try AR — {AR_LABEL[product.ar_mode] || '3D View'}
            </button>
          </div>

          {/* Details */}
          <div className="space-y-5">
            <div>
              <p className="text-sm text-gray-400 capitalize mb-1">{product.category} · by {product.seller_name}</p>
              <h1 className="font-display text-2xl font-bold text-gray-900 mb-2">{product.name}</h1>
              <div className="flex items-center gap-2">
                {[...Array(5)].map((_,i) => (
                  <Star key={i} size={14} className={i < Math.floor(product.rating||0) ? 'fill-amber-400 text-amber-400' : 'text-gray-300'}/>
                ))}
                <span className="text-sm font-semibold text-gray-700">{product.rating||0}</span>
                <span className="text-sm text-gray-400">({product.review_count||0} reviews)</span>
              </div>
            </div>

            <div className="flex items-baseline gap-3">
              <span className="font-display text-3xl font-bold text-gray-900">
                ₹{Number(product.price).toLocaleString('en-IN')}
              </span>
              {product.original_price && (
                <span className="text-lg text-gray-400 line-through">
                  ₹{Number(product.original_price).toLocaleString('en-IN')}
                </span>
              )}
              {discount > 0 && <span className="badge bg-green-100 text-green-700">{discount}% OFF</span>}
            </div>

            {product.colors?.length > 0 && (
              <div>
                <p className="label">Color</p>
                <div className="flex gap-2 flex-wrap">
                  {product.colors.map(c => (
                    <button key={c} onClick={() => setSelectedColor(c)}
                      style={{backgroundColor:c}}
                      className={`w-8 h-8 rounded-full border-2 transition-all ${selectedColor===c?'border-brand-500 scale-110 shadow-md':'border-gray-200'}`}/>
                  ))}
                </div>
              </div>
            )}

            {product.sizes?.length > 0 && (
              <div>
                <p className="label">Size</p>
                <div className="flex gap-2 flex-wrap">
                  {product.sizes.map(s => (
                    <button key={s} onClick={() => setSelectedSize(s)}
                      className={`px-3 py-1.5 rounded-xl text-sm font-semibold border transition-all ${selectedSize===s?'border-brand-500 bg-brand-50 text-brand-700':'border-gray-200 text-gray-600'}`}>
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="flex items-center gap-3">
              <div className="flex items-center border border-gray-200 rounded-xl overflow-hidden">
                <button onClick={() => setQty(q=>Math.max(1,q-1))} className="px-3 py-2.5 hover:bg-gray-50 font-bold">−</button>
                <span className="px-4 py-2.5 text-sm font-semibold">{qty}</span>
                <button onClick={() => setQty(q=>q+1)} className="px-3 py-2.5 hover:bg-gray-50 font-bold">+</button>
              </div>
              <button
                onClick={() => { addItem(product, qty, {color:selectedColor, size:selectedSize}); setAdded(true); setTimeout(()=>setAdded(false),2000) }}
                className={`flex-1 btn-primary justify-center py-3 text-base transition-all ${added?'bg-green-500 hover:bg-green-500':''}`}>
                <ShoppingCart size={18}/> {added ? '✓ Added!' : 'Add to Cart'}
              </button>
            </div>

            {/* Video Call Request */}
            <div className="border border-gray-200 rounded-2xl p-4 space-y-3">
              <div className="flex items-center gap-2">
                <Video size={16} className="text-brand-500"/>
                <p className="font-semibold text-gray-800 text-sm">Ask the Seller via Video Call</p>
              </div>
              <p className="text-xs text-gray-500">Request a live 1-to-1 video call with the seller.</p>

              {callStatus === null && (
                <>
                  <input className="input text-sm" placeholder="Optional: what do you want to ask?"
                    value={callMessage} onChange={e => setCallMessage(e.target.value)}/>
                  <button onClick={requestCall}
                    className="w-full flex items-center justify-center gap-2 py-2.5 bg-blue-500 hover:bg-blue-600 text-white font-semibold rounded-xl text-sm">
                    <Phone size={14}/> Request Video Call
                  </button>
                </>
              )}
              {callStatus === 'requesting' && (
                <div className="flex items-center gap-2 text-sm text-gray-500">
                  <span className="w-4 h-4 border-2 border-brand-500 border-t-transparent rounded-full animate-spin"/>
                  Sending request...
                </div>
              )}
              {callStatus === 'waiting' && (
                <div className="flex items-center justify-between p-3 bg-yellow-50 rounded-xl border border-yellow-200">
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full bg-yellow-400 animate-pulse"/>
                    <span className="text-sm font-semibold text-yellow-700">Waiting for seller...</span>
                  </div>
                  <button onClick={cancelRequest} className="text-xs text-red-500 hover:underline flex items-center gap-1">
                    <X size={12}/> Cancel
                  </button>
                </div>
              )}
              {callStatus === 'rejected' && (
                <div className="p-3 bg-red-50 rounded-xl border border-red-200 text-sm text-red-600 font-semibold text-center">
                  ✗ Seller declined the call
                </div>
              )}
              {callStatus === 'active' && (
                <div className="p-3 bg-green-50 rounded-xl border border-green-200 text-sm text-green-700 font-semibold text-center">
                  ✓ Call in progress
                </div>
              )}
            </div>

            {product.description && (
              <p className="text-sm text-gray-600 leading-relaxed border-t border-gray-100 pt-4">{product.description}</p>
            )}

            <div className="grid grid-cols-3 gap-3 pt-2">
              {[
                { icon:Package, label:'Free Delivery', sub:'Over ₹999' },
                { icon:Truck,   label:'Fast Shipping', sub:'2-3 days' },
                { icon:Shield,  label:'Secure Payment', sub:'Protected' },
              ].map(b => (
                <div key={b.label} className="text-center p-3 bg-gray-50 rounded-xl">
                  <b.icon size={16} className="mx-auto mb-1 text-brand-500"/>
                  <p className="text-xs font-semibold text-gray-700">{b.label}</p>
                  <p className="text-xs text-gray-400">{b.sub}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Related products */}
        {related.length > 0 && (
          <div>
            <h2 className="font-display text-lg font-bold text-gray-900 mb-4">Related Products</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {related.slice(0,4).map(p => (
                <Link key={p.id} to={`/buyer/products/${p.id}`} className="card-hover overflow-hidden">
                  <div className="aspect-square bg-gray-100 overflow-hidden rounded-t-2xl">
                    {p.image_url
                      ? <img src={p.image_url} alt={p.name} className="w-full h-full object-cover hover:scale-105 transition-transform duration-500"/>
                      : <div className="w-full h-full flex items-center justify-center text-4xl">🛍️</div>
                    }
                  </div>
                  <div className="p-3">
                    <p className="text-sm font-semibold text-gray-800 truncate">{p.name}</p>
                    <p className="text-sm font-bold text-brand-600">₹{Number(p.price).toLocaleString('en-IN')}</p>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>
    </>
  )
}