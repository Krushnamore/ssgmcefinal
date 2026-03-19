import React, { useEffect, useState, useCallback } from 'react'
import { Search, ChevronDown, ChevronUp, Package, Truck, CheckCircle, XCircle, Clock, MapPin, RefreshCw } from 'lucide-react'
import api from '../../api'

const STATUS_FLOW = [
  { key:'pending',   label:'Pending',    icon:Clock,       bg:'bg-gray-100',   text:'text-gray-600',   badge:'badge-gray'   },
  { key:'confirmed', label:'Confirmed',  icon:CheckCircle, bg:'bg-blue-100',   text:'text-blue-600',   badge:'badge-blue'   },
  { key:'shipped',   label:'Shipped',    icon:Truck,       bg:'bg-orange-100', text:'text-orange-600', badge:'badge-orange' },
  { key:'delivered', label:'Delivered',  icon:Package,     bg:'bg-green-100',  text:'text-green-600',  badge:'badge-green'  },
  { key:'cancelled', label:'Cancelled',  icon:XCircle,     bg:'bg-red-100',    text:'text-red-600',    badge:'badge-red'    },
]

const NEXT = { pending:'confirmed', confirmed:'shipped', shipped:'delivered' }

const parseItems   = i => { try { return typeof i==='string'?JSON.parse(i):(i||[]) } catch { return [] } }
const parseAddress = a => { try { return typeof a==='string'?JSON.parse(a):(a||{}) } catch { return {} } }

/* ── Status progress bar ── */
function StatusBar({ status }) {
  const steps = STATUS_FLOW.filter(s => s.key !== 'cancelled')
  const idx   = steps.findIndex(s => s.key === status)
  if (status === 'cancelled') return (
    <div className="flex items-center gap-2 p-2.5 bg-red-50 rounded-xl text-sm text-red-600 font-semibold">
      <XCircle size={14}/> Order was cancelled
    </div>
  )
  return (
    <div className="flex items-center">
      {steps.map((step, i) => {
        const done    = i <= idx
        const current = i === idx
        const Icon    = step.icon
        return (
          <React.Fragment key={step.key}>
            <div className="flex flex-col items-center flex-shrink-0">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center border-2 transition-all ${
                done
                  ? current ? 'bg-brand-500 border-brand-500 scale-110 shadow-sm' : 'bg-brand-500 border-brand-500'
                  : 'bg-white border-gray-200'
              }`}>
                <Icon size={13} className={done?'text-white':'text-gray-300'}/>
              </div>
              <p className={`text-xs mt-1 text-center leading-tight ${
                done ? (current?'text-brand-600 font-bold':'text-brand-500') : 'text-gray-400'
              }`} style={{maxWidth:52}}>{step.label}</p>
            </div>
            {i < steps.length-1 && (
              <div className={`flex-1 h-0.5 mx-0.5 mb-4 ${i<idx?'bg-brand-400':'bg-gray-200'}`}/>
            )}
          </React.Fragment>
        )
      })}
    </div>
  )
}

export default function SellerOrders() {
  const [orders, setOrders]           = useState([])
  const [loading, setLoading]         = useState(true)
  const [refreshing, setRefreshing]   = useState(false)
  const [search, setSearch]           = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [expanded, setExpanded]       = useState(null)
  const [updating, setUpdating]       = useState(null)

  const fetchOrders = useCallback(async (silent = false) => {
    if (!silent) setLoading(true)
    else setRefreshing(true)
    try {
      const r = await api.get('/orders')
      setOrders(r.data.orders || [])
    } catch (err) {
      console.error('Fetch orders error:', err?.response?.data?.message || err.message)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    fetchOrders()
    // Poll every 30s for new orders
    const t = setInterval(() => fetchOrders(true), 30000)
    return () => clearInterval(t)
  }, [fetchOrders])

  const updateStatus = async (orderId, status) => {
    setUpdating(orderId)
    try {
      await api.put(`/orders/${orderId}/status`, { status })
      // Optimistic update
      setOrders(prev => prev.map(o => o.id === orderId ? { ...o, status } : o))
    } catch (err) {
      alert(err?.response?.data?.message || 'Failed to update status')
      fetchOrders(true) // re-sync on error
    } finally { setUpdating(null) }
  }

  const filtered = orders.filter(o => {
    const items = parseItems(o.items)
    const ms = !search || `#${o.id}`.includes(search) ||
      (o.buyer_name||'').toLowerCase().includes(search.toLowerCase()) ||
      items.some(i => (i.name||'').toLowerCase().includes(search.toLowerCase()))
    return ms && (!filterStatus || o.status === filterStatus)
  })

  const revenue = orders.filter(o => o.status !== 'cancelled')
    .reduce((s, o) => s + parseFloat(o.total||0), 0)

  const countOf = k => orders.filter(o => o.status === k).length

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-title">Orders</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {orders.length} orders · ₹{revenue.toLocaleString('en-IN')} revenue
          </p>
        </div>
        <button onClick={() => fetchOrders(true)} disabled={refreshing}
          className="btn-secondary text-sm py-2 gap-2">
          <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''}/>
          Refresh
        </button>
      </div>

      {/* Status summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {STATUS_FLOW.filter(s => s.key !== 'cancelled').map(s => (
          <button key={s.key}
            onClick={() => setFilterStatus(filterStatus === s.key ? '' : s.key)}
            className={`card p-4 text-left hover:shadow-md transition-all ${filterStatus===s.key?'ring-2 ring-brand-400':''}`}>
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center mb-2 ${s.bg}`}>
              <s.icon size={18} className={s.text}/>
            </div>
            <p className="font-display text-2xl font-bold text-gray-900">{countOf(s.key)}</p>
            <p className="text-xs text-gray-500">{s.label}</p>
          </button>
        ))}
      </div>

      {/* Search + filter */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-48">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"/>
          <input className="input pl-8 text-sm" placeholder="Search order, buyer, product..."
            value={search} onChange={e => setSearch(e.target.value)}/>
        </div>
        <select className="input w-auto text-sm" value={filterStatus}
          onChange={e => setFilterStatus(e.target.value)}>
          <option value="">All Status</option>
          {STATUS_FLOW.map(s => (
            <option key={s.key} value={s.key}>{s.label} ({countOf(s.key)})</option>
          ))}
        </select>
      </div>

      {/* Orders */}
      {loading ? (
        <div className="space-y-3">
          {[...Array(3)].map((_,i) => <div key={i} className="card h-20 animate-pulse"/>)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20">
          <Package size={40} className="mx-auto text-gray-300 mb-3"/>
          <p className="font-semibold text-gray-600">
            {orders.length === 0 ? 'No orders yet' : 'No orders match your filter'}
          </p>
          {orders.length === 0 && (
            <p className="text-sm text-gray-400 mt-1">Orders will appear here when buyers purchase your products</p>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(order => {
            const items   = parseItems(order.items)
            const address = parseAddress(order.address)
            const isOpen  = expanded === order.id
            const cfg     = STATUS_FLOW.find(s => s.key === order.status) || STATUS_FLOW[0]
            const nextSt  = NEXT[order.status]

            return (
              <div key={order.id} className="card overflow-hidden">
                {/* Clickable header row */}
                <div className="p-4 flex items-center gap-3 cursor-pointer hover:bg-gray-50/60"
                  onClick={() => setExpanded(isOpen ? null : order.id)}>
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${cfg.bg}`}>
                    <cfg.icon size={18} className={cfg.text}/>
                  </div>
                  <div className="flex-1 grid grid-cols-3 gap-2 items-center min-w-0">
                    <div>
                      <p className="font-semibold text-gray-800">#{order.id}</p>
                      <p className="text-xs text-gray-400">
                        {new Date(order.created_at).toLocaleDateString('en-IN',{day:'numeric',month:'short',year:'numeric'})}
                      </p>
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-700 truncate">
                        {order.buyer_name || `Buyer #${order.buyer_id}`}
                      </p>
                      <p className="text-xs text-gray-400">
                        {items.length} item{items.length!==1?'s':''} · {order.payment_method?.toUpperCase()}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-gray-900">₹{parseFloat(order.total||0).toLocaleString('en-IN')}</p>
                      <span className={`badge text-xs ${cfg.badge}`}>{cfg.label}</span>
                    </div>
                  </div>
                  {isOpen
                    ? <ChevronUp size={16} className="text-gray-400 flex-shrink-0"/>
                    : <ChevronDown size={16} className="text-gray-400 flex-shrink-0"/>}
                </div>

                {/* Expanded */}
                {isOpen && (
                  <div className="border-t border-gray-100 p-4 space-y-4 bg-gray-50/30">

                    {/* Progress bar */}
                    <div>
                      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Order Progress</p>
                      <StatusBar status={order.status}/>
                    </div>

                    {/* Items */}
                    <div>
                      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Items</p>
                      <div className="space-y-2">
                        {items.map((item, i) => (
                          <div key={i} className="flex items-center gap-3 bg-white rounded-xl p-2.5 border border-gray-100">
                            <div className="w-10 h-10 bg-gray-100 rounded-lg overflow-hidden flex-shrink-0">
                              {item.image
                                ? <img src={item.image} alt={item.name} className="w-full h-full object-cover"/>
                                : <div className="w-full h-full flex items-center justify-center text-lg">📦</div>
                              }
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-semibold text-gray-800 truncate">{item.name}</p>
                              <p className="text-xs text-gray-400">
                                Qty: {item.qty}
                                {item.size  && ` · ${item.size}`}
                                {item.color && ` · ${item.color}`}
                              </p>
                            </div>
                            <p className="text-sm font-bold flex-shrink-0">
                              ₹{(Number(item.price)*Number(item.qty)).toLocaleString('en-IN')}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Address */}
                    <div className="bg-white rounded-xl p-3 border border-gray-100">
                      <p className="text-xs font-semibold text-gray-500 uppercase mb-1.5 flex items-center gap-1">
                        <MapPin size={11}/> Ship To
                      </p>
                      <p className="text-sm font-semibold text-gray-800">{address.name} · {address.phone}</p>
                      <p className="text-sm text-gray-600">{address.street}</p>
                      <p className="text-sm text-gray-600">{address.city}, {address.state} — {address.pincode}</p>
                    </div>

                    {/* Price summary */}
                    <div className="bg-white rounded-xl p-3 border border-gray-100 text-sm space-y-1">
                      <div className="flex justify-between text-gray-500"><span>Subtotal</span><span>₹{parseFloat(order.subtotal||0).toLocaleString('en-IN')}</span></div>
                      <div className="flex justify-between text-gray-500"><span>Shipping</span><span>{parseFloat(order.shipping||0)===0?'FREE':`₹${parseFloat(order.shipping).toLocaleString('en-IN')}`}</span></div>
                      <div className="flex justify-between text-gray-500"><span>GST</span><span>₹{parseFloat(order.tax||0).toLocaleString('en-IN')}</span></div>
                      <div className="flex justify-between font-bold text-gray-900 text-base border-t border-gray-100 pt-1.5">
                        <span>Total</span><span>₹{parseFloat(order.total||0).toLocaleString('en-IN')}</span>
                      </div>
                    </div>

                    {/* Action buttons */}
                    {order.status !== 'delivered' && order.status !== 'cancelled' && (
                      <div className="flex flex-wrap gap-2 pt-1">
                        {nextSt && (
                          <button onClick={() => updateStatus(order.id, nextSt)}
                            disabled={updating === order.id}
                            className="btn-primary text-sm py-2.5 gap-2">
                            {updating === order.id
                              ? <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"/>
                              : (() => {
                                  const n = STATUS_FLOW.find(s => s.key === nextSt)
                                  return <><n.icon size={14}/> Mark as {n.label}</>
                                })()
                            }
                          </button>
                        )}
                        <button
                          onClick={() => { if(confirm('Cancel this order?')) updateStatus(order.id,'cancelled') }}
                          disabled={updating === order.id}
                          className="btn-secondary text-sm py-2.5 text-red-500 hover:text-red-600 hover:border-red-300">
                          <XCircle size={14}/> Cancel
                        </button>
                      </div>
                    )}
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