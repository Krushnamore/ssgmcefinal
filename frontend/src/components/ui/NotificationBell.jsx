import React, { useEffect, useState, useRef, useCallback } from 'react'
import { Bell, X, CheckCheck, Package, Truck, CheckCircle, XCircle, Phone, Video, ShoppingBag, Trash2, Store } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import api from '../../api'

const TYPE_CONFIG = {
  order_placed:    { icon: ShoppingBag, color: 'bg-brand-100 text-brand-600',  label: 'Order' },
  order_confirmed: { icon: CheckCircle, color: 'bg-blue-100 text-blue-600',    label: 'Order' },
  order_shipped:   { icon: Truck,       color: 'bg-orange-100 text-orange-600', label: 'Order' },
  order_delivered: { icon: Package,     color: 'bg-green-100 text-green-600',   label: 'Order' },
  order_cancelled: { icon: XCircle,     color: 'bg-red-100 text-red-600',       label: 'Order' },
  new_order:       { icon: ShoppingBag, color: 'bg-green-100 text-green-600',   label: 'New Order' },
  call_request:    { icon: Phone,       color: 'bg-blue-100 text-blue-600',     label: 'Call' },
  call_accepted:   { icon: Phone,       color: 'bg-green-100 text-green-600',   label: 'Call' },
  call_rejected:   { icon: Phone,       color: 'bg-red-100 text-red-600',       label: 'Call' },
  live_started:    { icon: Video,       color: 'bg-red-100 text-red-600',       label: 'Live' },
  seller_pending:  { icon: Store,       color: 'bg-yellow-100 text-yellow-600', label: 'Approval' },
  seller_approved: { icon: CheckCircle, color: 'bg-green-100 text-green-600',   label: 'Approved' },
  seller_rejected: { icon: XCircle,     color: 'bg-red-100 text-red-600',       label: 'Rejected' },
}

const NAV_MAP = {
  order_placed:    (d, role) => `/${role}/orders`,
  order_confirmed: (d, role) => `/${role}/orders`,
  order_shipped:   (d, role) => `/${role}/orders`,
  order_delivered: (d, role) => `/${role}/orders`,
  order_cancelled: (d, role) => `/${role}/orders`,
  new_order:       ()        => '/seller/orders',
  call_request:    ()        => '/seller/calls',
  seller_pending:  ()        => '/admin/sellers',
  call_accepted:   ()        => '/buyer/products',
  live_started:    ()        => '/buyer/live',
}

export default function NotificationBell({ userRole }) {
  const [notifs, setNotifs]   = useState([])
  const [unread, setUnread]   = useState(0)
  const [open, setOpen]       = useState(false)
  const [loading, setLoading] = useState(false)
  const panelRef = useRef(null)
  const navigate = useNavigate()

  const fetchNotifs = useCallback(async () => {
    try {
      const { data } = await api.get('/notifications')
      if (data.success) {
        setNotifs(data.notifications || [])
        setUnread(data.unread || 0)
      }
    } catch {}
  }, [])

  useEffect(() => {
    fetchNotifs()
    const t = setInterval(fetchNotifs, 15000) // poll every 15s
    return () => clearInterval(t)
  }, [fetchNotifs])

  // Close on outside click
  useEffect(() => {
    const handler = e => { if (panelRef.current && !panelRef.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const markAllRead = async () => {
    await api.put('/notifications/read-all').catch(()=>{})
    setNotifs(prev => prev.map(n => ({ ...n, is_read: 1 })))
    setUnread(0)
  }

  const clearRead = async () => {
    await api.delete('/notifications/clear').catch(()=>{})
    setNotifs(prev => prev.filter(n => !n.is_read))
  }

  const handleClick = async (notif) => {
    // Mark as read
    if (!notif.is_read) {
      await api.put(`/notifications/${notif.id}/read`).catch(()=>{})
      setNotifs(prev => prev.map(n => n.id === notif.id ? {...n, is_read: 1} : n))
      setUnread(prev => Math.max(0, prev - 1))
    }
    // Navigate
    const navFn = NAV_MAP[notif.type]
    if (navFn) navigate(navFn(notif.data, userRole))
    setOpen(false)
  }

  const safeData = n => { try { return typeof n.data === 'string' ? JSON.parse(n.data) : (n.data || {}) } catch { return {} } }

  return (
    <div className="relative" ref={panelRef}>
      <button
        onClick={() => setOpen(v => !v)}
        className="relative p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-xl transition-all"
      >
        <Bell size={18}/>
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 w-5 h-5 bg-red-500 text-white text-xs font-bold rounded-full flex items-center justify-center">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-80 bg-white rounded-2xl shadow-2xl border border-gray-100 z-50 overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 bg-gray-50">
            <div className="flex items-center gap-2">
              <p className="font-semibold text-gray-800 text-sm">Notifications</p>
              {unread > 0 && (
                <span className="bg-red-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">{unread}</span>
              )}
            </div>
            <div className="flex gap-2">
              {unread > 0 && (
                <button onClick={markAllRead} className="text-xs text-brand-600 hover:underline font-semibold flex items-center gap-1">
                  <CheckCheck size={12}/> All read
                </button>
              )}
              <button onClick={clearRead} className="text-xs text-gray-400 hover:text-red-500 flex items-center gap-1">
                <Trash2 size={12}/>
              </button>
              <button onClick={() => setOpen(false)} className="text-gray-400 hover:text-gray-600">
                <X size={16}/>
              </button>
            </div>
          </div>

          {/* List */}
          <div className="max-h-96 overflow-y-auto">
            {notifs.length === 0 ? (
              <div className="text-center py-10">
                <Bell size={28} className="mx-auto text-gray-300 mb-2"/>
                <p className="text-sm text-gray-400">No notifications yet</p>
              </div>
            ) : (
              notifs.map(notif => {
                const cfg = TYPE_CONFIG[notif.type] || TYPE_CONFIG.order_placed
                const Icon = cfg.icon
                const data = safeData(notif)
                return (
                  <div
                    key={notif.id}
                    onClick={() => handleClick(notif)}
                    className={`flex items-start gap-3 px-4 py-3 cursor-pointer hover:bg-gray-50 transition-colors border-b border-gray-50 last:border-0 ${!notif.is_read ? 'bg-blue-50/40' : ''}`}
                  >
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${cfg.color}`}>
                      <Icon size={16}/>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <p className={`text-sm font-semibold text-gray-800 leading-tight ${!notif.is_read ? 'text-gray-900' : ''}`}>
                          {notif.title}
                        </p>
                        {!notif.is_read && <span className="w-2 h-2 bg-blue-500 rounded-full flex-shrink-0 mt-1"/>}
                      </div>
                      <p className="text-xs text-gray-500 mt-0.5 leading-relaxed line-clamp-2">{notif.message}</p>
                      <p className="text-xs text-gray-400 mt-1">
                        {new Date(notif.created_at).toLocaleString('en-IN', {day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'})}
                      </p>
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </div>
      )}
    </div>
  )
}