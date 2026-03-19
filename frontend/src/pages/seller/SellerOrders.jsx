import React, { useEffect, useState, useCallback } from 'react'
import { Search, Package, Truck, CheckCircle, XCircle, Clock, MapPin, RefreshCw, ChevronDown, ChevronUp } from 'lucide-react'
import api from '../../api'

const STATUS_FLOW = [
  { key:'pending',   label:'Pending',   icon:Clock,        bg:'bg-gray-100',   text:'text-gray-600',   badge:'badge-gray',   btnColor:'btn-primary' },
  { key:'confirmed', label:'Confirmed', icon:CheckCircle,  bg:'bg-blue-100',   text:'text-blue-600',   badge:'badge-blue',   btnColor:'btn-primary' },
  { key:'shipped',   label:'Shipped',   icon:Truck,        bg:'bg-orange-100', text:'text-orange-600', badge:'badge-orange', btnColor:'btn-primary' },
  { key:'delivered', label:'Delivered', icon:Package,      bg:'bg-green-100',  text:'text-green-600',  badge:'badge-green',  btnColor:'' },
  { key:'cancelled', label:'Cancelled', icon:XCircle,      bg:'bg-red-100',    text:'text-red-600',    badge:'badge-red',    btnColor:'' },
]

// Pending → Confirmed → Shipped → Delivered
const NEXT_STATUS = { pending:'confirmed', confirmed:'shipped', shipped:'delivered' }
const NEXT_LABEL  = { pending:'Confirm Order', confirmed:'Mark Shipped', shipped:'Mark Delivered' }

const safeArr = v => { try { return Array.isArray(v)?v:(typeof v==='string'?JSON.parse(v):[]) } catch { return [] } }
const safeObj = v => { try { return (v&&typeof v==='object'&&!Array.isArray(v))?v:(typeof v==='string'?JSON.parse(v):{}) } catch { return {} } }

/* ── Status progress bar ───────────────────────────── */
function StatusBar({ status }) {
  const mainSteps = STATUS_FLOW.filter(s => s.key !== 'cancelled')
  const currentIdx = mainSteps.findIndex(s => s.key === status)
  if (status === 'cancelled') return (
    <div className="flex items-center gap-2 p-3 bg-red-50 rounded-xl border border-red-100">
      <XCircle size={16} className="text-red-500"/>
      <span className="text-sm font-semibold text-red-600">This order was cancelled</span>
    </div>
  )
  return (
    <div className="flex items-center w-full">
      {mainSteps.map((step, i) => {
        const done    = i <= currentIdx
        const current = i === currentIdx
        const Icon    = step.icon
        return (
          <React.Fragment key={step.key}>
            <div className="flex flex-col items-center flex-shrink-0">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center border-2 transition-all duration-300 ${
                done
                  ? current ? 'bg-brand-500 border-brand-500 shadow-lg shadow-brand-100 scale-110'
                            : 'bg-brand-500 border-brand-500'
                  : 'bg-white border-gray-200'
              }`}>
                <Icon size={16} className={done ? 'text-white' : 'text-gray-300'}/>
              </div>
              <p className={`text-xs mt-1.5 font-semibold text-center leading-tight ${
                current ? 'text-brand-600' : done ? 'text-brand-400' : 'text-gray-400'
              }`} style={{maxWidth:64}}>
                {step.label}
              </p>
            </div>
            {i < mainSteps.length - 1 && (
              <div className={`flex-1 h-1 rounded-full mx-1 mb-5 transition-all duration-300 ${
                i < currentIdx ? 'bg-brand-400' : 'bg-gray-200'
              }`}/>
            )}
          </React.Fragment>
        )
      })}
    </div>
  )
}

/* ── Main component ───────────────────────────────── */
export default function SellerOrders() {
  const [orders, setOrders]             = useState([])
  const [loading, setLoading]           = useState(true)
  const [refreshing, setRefreshing]     = useState(false)
  const [search, setSearch]             = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [expanded, setExpanded]         = useState(null)
  const [updating, setUpdating]         = useState(null)
  const [error, setError]               = useState('')

  const fetchOrders = useCallback(async (silent = false) => {
    silent ? setRefreshing(true) : setLoading(true)
    setError('')
    try {
      const { data } = await api.get('/orders')
      setOrders(data.orders || [])
    } catch (err) {
      setError(err?.response?.data?.message || 'Failed to load orders')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    fetchOrders()
    const t = setInterval(() => fetchOrders(true), 30000)
    return () => clearInterval(t)
  }, [fetchOrders])

  const updateStatus = async (orderId, newStatus) => {
    setUpdating(orderId)
    try {
      await api.put(`/orders/${orderId}/status`, { status: newStatus })
      // Optimistic UI update
      setOrders(prev => prev.map(o => o.id === orderId ? { ...o, status: newStatus } : o))
    } catch (err) {
      alert(err?.response?.data?.message || 'Failed to update')
      fetchOrders(true)
    } finally { setUpdating(null) }
  }

  const filtered = orders.filter(o => {
    const items = safeArr(o.items)
    const matchSearch = !search ||
      `#${o.id}`.includes(search) ||
      (o.buyer_name||'').toLowerCase().includes(search.toLowerCase()) ||
      items.some(i => (i.name||'').toLowerCase().includes(search.toLowerCase()))
    return matchSearch && (!filterStatus || o.status === filterStatus)
  })

  const countOf  = k  => orders.filter(o => o.status === k).length
  const revenue  = orders.filter(o => o.status !== 'cancelled').reduce((s,o) => s + parseFloat(o.total||0), 0)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="page-title">Orders</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {orders.length} orders · ₹{revenue.toLocaleString('en-IN')} revenue
          </p>
        </div>
        <button onClick={() => fetchOrders(true)} disabled={refreshing}
          className="btn-secondary text-sm py-2 gap-2">
          <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''}/>
          {refreshing ? 'Refreshing...' : 'Refresh'}
        </button>
      </div>

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">{error}</div>
      )}

      {/* Status summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {STATUS_FLOW.filter(s => s.key !== 'cancelled').map(s => (
          <button key={s.key}
            onClick={() => setFilterStatus(filterStatus === s.key ? '' : s.key)}
            className={`card p-4 text-left hover:shadow-md transition-all ${filterStatus===s.key ? 'ring-2 ring-brand-400 shadow-md' : ''}`}>
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-2 ${s.bg}`}>
              <s.icon size={20} className={s.text}/>
            </div>
            <p className="font-display text-2xl font-bold text-gray-900">{countOf(s.key)}</p>
            <p className="text-xs text-gray-500 font-medium">{s.label}</p>
          </button>
        ))}
      </div>

      {/* Search + filter */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-48">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"/>
          <input className="input pl-8 text-sm" placeholder="Search by order #, buyer name, product..."
            value={search} onChange={e => setSearch(e.target.value)}/>
        </div>
        <select className="input w-auto text-sm" value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
          <option value="">All Status</option>
          {STATUS_FLOW.map(s => <option key={s.key} value={s.key}>{s.label} ({countOf(s.key)})</option>)}
        </select>
      </div>

      {/* Order list */}
      {loading ? (
        <div className="space-y-3">
          {[...Array(3)].map((_,i) => <div key={i} className="card h-20 animate-pulse"/>)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20">
          <Package size={40} className="mx-auto text-gray-300 mb-3"/>
          <p className="font-semibold text-gray-600 text-lg">
            {orders.length === 0 ? 'No orders yet' : 'No orders match'}
          </p>
          {orders.length === 0 && (
            <p className="text-sm text-gray-400 mt-1">Orders will appear here when buyers purchase your products</p>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(order => {
            const items     = safeArr(order.items)
            const address   = safeObj(order.address)
            const isOpen    = expanded === order.id
            const cfg       = STATUS_FLOW.find(s => s.key === order.status) || STATUS_FLOW[0]
            const nextSt    = NEXT_STATUS[order.status]
            const nextLabel = NEXT_LABEL[order.status]
            const StatusIcon = cfg.icon

            return (
              <div key={order.id} className={`card overflow-hidden transition-all ${isOpen ? 'shadow-md' : ''}`}>

                {/* ── Collapsed row (always visible) ── */}
                <div
                  className="p-4 flex items-center gap-3 cursor-pointer hover:bg-gray-50/50"
                  onClick={() => setExpanded(isOpen ? null : order.id)}
                >
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${cfg.bg}`}>
                    <StatusIcon size={18} className={cfg.text}/>
                  </div>

                  <div className="flex-1 grid grid-cols-3 gap-3 items-center min-w-0">
                    <div>
                      <p className="font-bold text-gray-800">Order #{order.id}</p>
                      <p className="text-xs text-gray-400">
                        {new Date(order.created_at).toLocaleDateString('en-IN',{day:'numeric',month:'short',year:'numeric'})}
                      </p>
                    </div>
                    <div className="min-w-0 text-center">
                      <p className="text-sm font-semibold text-gray-700 truncate">
                        {order.buyer_name || `Buyer #${order.buyer_id}`}
                      </p>
                      <p className="text-xs text-gray-400">
                        {items.length} item{items.length!==1?'s':''} · {(order.payment_method||'').toUpperCase()}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-gray-900">₹{parseFloat(order.total||0).toLocaleString('en-IN')}</p>
                      <span className={`badge text-xs ${cfg.badge}`}>{cfg.label}</span>
                    </div>
                  </div>

                  {isOpen
                    ? <ChevronUp   size={18} className="text-gray-400 flex-shrink-0"/>
                    : <ChevronDown size={18} className="text-gray-400 flex-shrink-0"/>}
                </div>

                {/* ── Quick action button (outside expanded, always visible) ── */}
                {!isOpen && nextSt && order.status !== 'cancelled' && (
                  <div className="px-4 pb-3 flex gap-2">
                    <button
                      onClick={e => { e.stopPropagation(); updateStatus(order.id, nextSt) }}
                      disabled={updating === order.id}
                      className="btn-primary text-sm py-2 gap-2 flex-1 justify-center"
                    >
                      {updating === order.id
                        ? <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"/>
                        : <>{(() => { const n=STATUS_FLOW.find(s=>s.key===nextSt); return <n.icon size={14}/> })()} {nextLabel}</>
                      }
                    </button>
                    <button
                      onClick={e => { e.stopPropagation(); if(confirm('Cancel this order?')) updateStatus(order.id,'cancelled') }}
                      disabled={updating === order.id}
                      className="btn-secondary text-sm py-2 px-3 text-red-500 hover:border-red-300 hover:bg-red-50"
                      title="Cancel order"
                    >
                      <XCircle size={16}/>
                    </button>
                  </div>
                )}

                {/* ── Expanded detail ── */}
                {isOpen && (
                  <div className="border-t border-gray-100 bg-gray-50/30">
                    <div className="p-5 space-y-5">

                      {/* Status progress bar */}
                      <div>
                        <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4">Order Progress</p>
                        <StatusBar status={order.status}/>
                      </div>

                      {/* ── Primary action button — big and obvious ── */}
                      {order.status !== 'delivered' && order.status !== 'cancelled' && (
                        <div className="flex gap-3">
                          {nextSt && (
                            <button
                              onClick={() => updateStatus(order.id, nextSt)}
                              disabled={updating === order.id}
                              className="btn-primary flex-1 justify-center py-3 text-base gap-2"
                            >
                              {updating === order.id ? (
                                <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"/>
                              ) : (
                                <>
                                  {(() => { const n=STATUS_FLOW.find(s=>s.key===nextSt); return <n.icon size={18}/> })()}
                                  {nextLabel}
                                </>
                              )}
                            </button>
                          )}
                          <button
                            onClick={() => { if(confirm('Cancel this order?')) updateStatus(order.id,'cancelled') }}
                            disabled={updating === order.id}
                            className="btn-secondary py-3 px-5 text-red-500 hover:border-red-300 hover:bg-red-50 gap-2"
                          >
                            <XCircle size={16}/> Cancel
                          </button>
                        </div>
                      )}
                      {order.status === 'delivered' && (
                        <div className="flex items-center gap-2 p-3 bg-green-50 rounded-xl border border-green-100">
                          <CheckCircle size={18} className="text-green-500"/>
                          <span className="text-sm font-semibold text-green-700">Order delivered successfully!</span>
                        </div>
                      )}

                      {/* Items */}
                      <div>
                        <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Items Ordered</p>
                        <div className="space-y-2">
                          {items.map((item, i) => (
                            <div key={i} className="flex items-center gap-3 bg-white rounded-xl p-3 border border-gray-100 shadow-sm">
                              <div className="w-12 h-12 bg-gray-100 rounded-xl overflow-hidden flex-shrink-0">
                                {item.image
                                  ? <img src={item.image} alt={item.name} className="w-full h-full object-cover"/>
                                  : <div className="w-full h-full flex items-center justify-center text-2xl">📦</div>
                                }
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="font-semibold text-gray-800 truncate">{item.name}</p>
                                <p className="text-xs text-gray-400 mt-0.5">
                                  Qty: {item.qty}
                                  {item.size  && ` · Size: ${item.size}`}
                                  {item.color && ` · ${item.color}`}
                                </p>
                              </div>
                              <p className="font-bold text-gray-900 flex-shrink-0">
                                ₹{(Number(item.price)*Number(item.qty)).toLocaleString('en-IN')}
                              </p>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Delivery address */}
                      <div className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm">
                        <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2 flex items-center gap-1">
                          <MapPin size={11}/> Delivery Address
                        </p>
                        <p className="font-semibold text-gray-800">{address.name} <span className="font-normal text-gray-500">· {address.phone}</span></p>
                        <p className="text-sm text-gray-600 mt-0.5">{address.street}</p>
                        <p className="text-sm text-gray-600">{address.city}, {address.state} — {address.pincode}</p>
                      </div>

                      {/* Price breakdown */}
                      <div className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm space-y-2 text-sm">
                        <div className="flex justify-between text-gray-500"><span>Subtotal</span><span>₹{parseFloat(order.subtotal||0).toLocaleString('en-IN')}</span></div>
                        <div className="flex justify-between text-gray-500"><span>Shipping</span><span>{parseFloat(order.shipping||0)===0?<span className="text-green-600 font-semibold">FREE</span>:`₹${parseFloat(order.shipping).toLocaleString('en-IN')}`}</span></div>
                        <div className="flex justify-between text-gray-500"><span>Tax (GST)</span><span>₹{parseFloat(order.tax||0).toLocaleString('en-IN')}</span></div>
                        <div className="flex justify-between font-bold text-gray-900 text-base border-t border-gray-100 pt-2">
                          <span>Total</span><span>₹{parseFloat(order.total||0).toLocaleString('en-IN')}</span>
                        </div>
                        <p className="text-xs text-gray-400">Payment: {order.payment_method?.toUpperCase()}</p>
                      </div>

                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}