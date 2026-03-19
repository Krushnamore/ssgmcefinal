import React, { useState } from 'react'
import { useNavigate, useLocation, Link } from 'react-router-dom'
import { CreditCard, MapPin, ArrowLeft, CheckCircle, Package } from 'lucide-react'
import { useCart } from '../../context/CartContext'
import { useAuth } from '../../context/AuthContext'
import api from '../../api'

const PAYMENT_METHODS = [
  { id:'upi',        label:'UPI',              icon:'📱', desc:'Pay via UPI apps' },
  { id:'card',       label:'Debit/Credit',     icon:'💳', desc:'Visa, Mastercard, Rupay' },
  { id:'cod',        label:'Cash on Delivery', icon:'💵', desc:'Pay when delivered' },
  { id:'netbanking', label:'Net Banking',      icon:'🏦', desc:'All major banks' },
]

export default function BuyerCheckout() {
  const { items, clearCart } = useCart()
  const { user } = useAuth()
  const location = useLocation()
  const { subtotal = 0, shipping = 0, tax = 0, total = 0 } = location.state || {}

  const [address, setAddress] = useState({
    name: user?.name || '', phone: '', street: '', city: '', state: '', pincode: ''
  })
  const [paymentMethod, setPaymentMethod] = useState('upi')
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState('')
  const [success, setSuccess] = useState(null)

  const handleSubmit = async e => {
    e.preventDefault()
    if (!address.phone || !address.street || !address.city || !address.pincode) {
      setError('Please fill all address fields'); return
    }
    setError(''); setLoading(true)
    try {
      // Build clean order items — no base64, sellerId always set
      const orderItems = items.map(i => ({
        id:       i.id,
        name:     i.name,
        price:    Number(i.price),
        qty:      Number(i.qty) || 1,
        sellerId: i.seller_id || i.sellerId || null,   // ← critical for seller visibility
        category: i.category || '',
        color:    i.variant?.color || '',
        size:     i.variant?.size  || '',
        // Only store URL images, never base64
        image: (i.image_url || i.image || '').startsWith('data:')
          ? '' : (i.image_url || i.image || ''),
      }))

      const { data } = await api.post('/orders', {
        items: orderItems, address, paymentMethod,
        subtotal, shipping, tax, total,
      })

      if (data.success) { clearCart(); setSuccess(data.orderId) }
    } catch (err) {
      setError(err?.response?.data?.message || 'Failed to place order. Please try again.')
    } finally { setLoading(false) }
  }

  if (success) return (
    <div className="flex flex-col items-center justify-center py-20 text-center max-w-md mx-auto">
      <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mb-5">
        <CheckCircle size={40} className="text-green-500"/>
      </div>
      <h2 className="font-display text-2xl font-bold text-gray-900 mb-2">Order Placed! 🎉</h2>
      <p className="text-gray-500 mb-1">Order <span className="font-bold text-gray-800">#{success}</span></p>
      <p className="text-sm text-gray-400 mb-6">The seller will confirm your order shortly.</p>
      <div className="flex gap-3">
        <Link to="/buyer/orders" className="btn-primary"><Package size={16}/> Track Order</Link>
        <Link to="/buyer/products" className="btn-secondary">Continue Shopping</Link>
      </div>
    </div>
  )

  if (items.length === 0) return (
    <div className="text-center py-20">
      <p className="text-gray-500 mb-4">Your cart is empty</p>
      <Link to="/buyer/products" className="btn-primary">Browse Products</Link>
    </div>
  )

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <Link to="/buyer/cart" className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-brand-600">
        <ArrowLeft size={16}/> Back to Cart
      </Link>
      <h1 className="page-title">Checkout</h1>

      {error && <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">{error}</div>}

      <form onSubmit={handleSubmit}>
        <div className="grid lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">

            {/* Delivery Address */}
            <div className="card p-5 space-y-4">
              <div className="flex items-center gap-2 mb-1">
                <MapPin size={18} className="text-brand-500"/>
                <h2 className="font-semibold text-gray-800">Delivery Address</h2>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <label className="label">Full Name</label>
                  <input className="input" value={address.name}
                    onChange={e=>setAddress(a=>({...a,name:e.target.value}))} required/>
                </div>
                <div>
                  <label className="label">Phone</label>
                  <input className="input" placeholder="+91" value={address.phone}
                    onChange={e=>setAddress(a=>({...a,phone:e.target.value}))} required/>
                </div>
                <div>
                  <label className="label">Pincode</label>
                  <input className="input" value={address.pincode}
                    onChange={e=>setAddress(a=>({...a,pincode:e.target.value}))} required/>
                </div>
                <div className="col-span-2">
                  <label className="label">Street Address</label>
                  <input className="input" value={address.street}
                    onChange={e=>setAddress(a=>({...a,street:e.target.value}))} required/>
                </div>
                <div>
                  <label className="label">City</label>
                  <input className="input" value={address.city}
                    onChange={e=>setAddress(a=>({...a,city:e.target.value}))} required/>
                </div>
                <div>
                  <label className="label">State</label>
                  <input className="input" value={address.state}
                    onChange={e=>setAddress(a=>({...a,state:e.target.value}))} required/>
                </div>
              </div>
            </div>

            {/* Payment Method */}
            <div className="card p-5 space-y-3">
              <div className="flex items-center gap-2 mb-1">
                <CreditCard size={18} className="text-brand-500"/>
                <h2 className="font-semibold text-gray-800">Payment Method</h2>
              </div>
              <div className="grid grid-cols-2 gap-3">
                {PAYMENT_METHODS.map(pm => (
                  <label key={pm.id}
                    className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all ${paymentMethod===pm.id ? 'border-brand-500 bg-brand-50' : 'border-gray-200 hover:border-gray-300'}`}>
                    <input type="radio" name="payment" value={pm.id}
                      checked={paymentMethod===pm.id}
                      onChange={()=>setPaymentMethod(pm.id)}
                      className="accent-brand-500"/>
                    <div>
                      <p className="text-sm font-semibold text-gray-800">{pm.icon} {pm.label}</p>
                      <p className="text-xs text-gray-400">{pm.desc}</p>
                    </div>
                  </label>
                ))}
              </div>
            </div>
          </div>

          {/* Order Summary */}
          <div className="space-y-4">
            <div className="card p-5 space-y-3">
              <h2 className="font-semibold text-gray-800">Order Items ({items.length})</h2>
              <div className="space-y-2 max-h-52 overflow-y-auto">
                {items.map(item => {
                  const img = item.image_url || item.image || ''
                  const thumb = img.startsWith('data:') ? img : img
                  return (
                    <div key={item._key || item.id} className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-gray-100 rounded-lg overflow-hidden flex-shrink-0">
                        {thumb && <img src={thumb} alt={item.name} className="w-full h-full object-cover"/>}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-gray-700 truncate">{item.name}</p>
                        <p className="text-xs text-gray-400">x{item.qty}</p>
                      </div>
                      <p className="text-xs font-bold text-gray-800">
                        ₹{(Number(item.price)*Number(item.qty)).toLocaleString('en-IN')}
                      </p>
                    </div>
                  )
                })}
              </div>
              <div className="border-t border-gray-100 pt-3 space-y-1.5 text-sm">
                <div className="flex justify-between text-gray-500">
                  <span>Subtotal</span><span>₹{Number(subtotal).toLocaleString('en-IN')}</span>
                </div>
                <div className="flex justify-between text-gray-500">
                  <span>Shipping</span>
                  <span>{Number(shipping)===0
                    ? <span className="text-green-600 font-semibold">FREE</span>
                    : `₹${Number(shipping).toLocaleString('en-IN')}`}
                  </span>
                </div>
                <div className="flex justify-between text-gray-500">
                  <span>GST (18%)</span><span>₹{Number(tax).toLocaleString('en-IN')}</span>
                </div>
                <div className="flex justify-between font-bold text-gray-900 text-base pt-1">
                  <span>Total</span><span>₹{Number(total).toLocaleString('en-IN')}</span>
                </div>
              </div>
            </div>

            <button type="submit" disabled={loading} className="btn-primary w-full justify-center py-3 text-base">
              {loading
                ? <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"/>
                : `Place Order · ₹${Number(total).toLocaleString('en-IN')}`}
            </button>
          </div>
        </div>
      </form>
    </div>
  )
}