import React, { useEffect, useState } from 'react'
import { CheckCircle, XCircle, Clock, Store, RefreshCw, User, Mail } from 'lucide-react'
import api from '../../api'

export default function AdminSellers() {
  const [pending,  setPending]  = useState([])
  const [all,      setAll]      = useState([])
  const [loading,  setLoading]  = useState(true)
  const [updating, setUpdating] = useState(null)
  const [tab,      setTab]      = useState('pending')

  const fetchData = async () => {
    setLoading(true)
    try {
      const [p, a] = await Promise.all([
        api.get('/users/pending-sellers'),
        api.get('/users?role=seller'),
      ])
      setPending(p.data.sellers || [])
      setAll(a.data.users || [])
    } catch {}
    finally { setLoading(false) }
  }

  useEffect(() => { fetchData() }, [])

  const approve = async (id, name) => {
    setUpdating(id)
    try {
      await api.put(`/users/${id}/approve-seller`)
      fetchData()
    } catch (err) { alert(err?.response?.data?.message || 'Failed') }
    finally { setUpdating(null) }
  }

  const reject = async (id) => {
    const reason = prompt('Reason for rejection (optional):') ?? ''
    setUpdating(id)
    try {
      await api.put(`/users/${id}/reject-seller`, { reason })
      fetchData()
    } catch (err) { alert(err?.response?.data?.message || 'Failed') }
    finally { setUpdating(null) }
  }

  const STATUS_BADGE = {
    active:   'bg-green-100 text-green-700',
    pending:  'bg-yellow-100 text-yellow-700',
    rejected: 'bg-red-100 text-red-700',
    suspended:'bg-gray-100 text-gray-600',
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-title">Seller Management</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {pending.length > 0 && <span className="text-yellow-600 font-semibold">{pending.length} pending approval · </span>}
            {all.length} total sellers
          </p>
        </div>
        <button onClick={fetchData} className="btn-secondary text-sm py-2 gap-2">
          <RefreshCw size={14}/> Refresh
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-2">
        <button onClick={() => setTab('pending')}
          className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all flex items-center gap-2 ${tab==='pending' ? 'bg-yellow-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
          <Clock size={14}/> Pending {pending.length > 0 && <span className="bg-white text-yellow-600 text-xs font-bold px-1.5 py-0.5 rounded-full">{pending.length}</span>}
        </button>
        <button onClick={() => setTab('all')}
          className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all flex items-center gap-2 ${tab==='all' ? 'bg-brand-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
          <Store size={14}/> All Sellers
        </button>
      </div>

      {loading ? (
        <div className="space-y-3">{[...Array(3)].map((_,i) => <div key={i} className="card h-20 animate-pulse"/>)}</div>
      ) : tab === 'pending' ? (
        pending.length === 0 ? (
          <div className="text-center py-20">
            <CheckCircle size={40} className="mx-auto text-green-400 mb-3"/>
            <p className="font-semibold text-gray-600">No pending approvals</p>
            <p className="text-sm text-gray-400 mt-1">All seller registrations are reviewed</p>
          </div>
        ) : (
          <div className="space-y-3">
            {pending.map(seller => (
              <div key={seller.id} className="card p-5 border-l-4 border-yellow-400">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-yellow-100 flex items-center justify-center text-yellow-700 font-bold text-lg flex-shrink-0">
                    {seller.name?.charAt(0)?.toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-gray-800">{seller.name}</p>
                      <span className="badge bg-yellow-100 text-yellow-700 text-xs">Pending</span>
                    </div>
                    <p className="text-sm text-gray-500 flex items-center gap-1 mt-0.5">
                      <Mail size={12}/> {seller.email}
                    </p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      Registered {new Date(seller.created_at).toLocaleDateString('en-IN', {day:'numeric',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'})}
                    </p>
                  </div>
                  <div className="flex gap-2 flex-shrink-0">
                    <button
                      onClick={() => approve(seller.id, seller.name)}
                      disabled={updating === seller.id}
                      className="flex items-center gap-2 px-4 py-2.5 bg-green-500 hover:bg-green-600 text-white font-semibold rounded-xl text-sm transition-all">
                      {updating === seller.id
                        ? <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"/>
                        : <CheckCircle size={15}/>
                      }
                      Approve
                    </button>
                    <button
                      onClick={() => reject(seller.id)}
                      disabled={updating === seller.id}
                      className="flex items-center gap-2 px-4 py-2.5 bg-red-50 hover:bg-red-100 text-red-600 font-semibold rounded-xl text-sm transition-all border border-red-200">
                      <XCircle size={15}/> Reject
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )
      ) : (
        <div className="space-y-3">
          {all.length === 0 ? (
            <div className="text-center py-20 text-gray-400">No sellers registered yet</div>
          ) : (
            all.map(seller => (
              <div key={seller.id} className="card p-4 flex items-center gap-4">
                <div className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center font-bold text-gray-600 flex-shrink-0">
                  {seller.name?.charAt(0)?.toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-gray-800 truncate">{seller.name}</p>
                  <p className="text-sm text-gray-500 truncate">{seller.email}</p>
                </div>
                <span className={`badge text-xs font-semibold px-2.5 py-1 rounded-full ${STATUS_BADGE[seller.status] || 'bg-gray-100 text-gray-600'}`}>
                  {seller.status}
                </span>
                {seller.status === 'pending' && (
                  <button onClick={() => approve(seller.id, seller.name)} disabled={updating === seller.id}
                    className="text-xs bg-green-500 text-white px-3 py-1.5 rounded-lg hover:bg-green-600 font-semibold">
                    Approve
                  </button>
                )}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  )
}