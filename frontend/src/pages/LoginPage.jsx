import React, { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ShoppingBag, Mail, Lock, Eye, EyeOff, ShoppingCart, Store, Shield } from 'lucide-react'
import { useAuth } from '../context/AuthContext'

export default function LoginPage() {
  const { login } = useAuth()
  const navigate  = useNavigate()

  // 3 tabs: buyer, seller, admin
  const [activeRole, setActiveRole] = useState('buyer')
  const [form, setForm]   = useState({ email: '', password: '' })
  const [showPw, setShowPw] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError]   = useState('')

  const ROLES = [
    {
      id: 'buyer',
      label: 'Buyer',
      sub: 'Shop & buy products',
      icon: ShoppingCart,
      active: 'border-brand-500 bg-brand-50',
      iconBg: 'bg-brand-500',
      iconColor: 'text-gray-400',
      textColor: 'text-brand-600',
      btnColor: 'bg-brand-500 hover:bg-brand-600',
    },
    {
      id: 'seller',
      label: 'Seller',
      sub: 'Sell your products',
      icon: Store,
      active: 'border-blue-500 bg-blue-50',
      iconBg: 'bg-blue-500',
      iconColor: 'text-gray-400',
      textColor: 'text-blue-600',
      btnColor: 'bg-blue-500 hover:bg-blue-600',
    },
    {
      id: 'admin',
      label: 'Admin',
      sub: 'Manage the platform',
      icon: Shield,
      active: 'border-purple-500 bg-purple-50',
      iconBg: 'bg-purple-600',
      iconColor: 'text-gray-400',
      textColor: 'text-purple-700',
      btnColor: 'bg-purple-600 hover:bg-purple-700',
    },
  ]

  const current = ROLES.find(r => r.id === activeRole)

  const handle = async e => {
    e.preventDefault()
    if (!form.email || !form.password) { setError('Please fill all fields'); return }
    setError(''); setLoading(true)
    try {
      const user = await login(form.email, form.password)
      // Admin always goes to /admin
      if (user.role === 'admin') { navigate('/admin', { replace: true }); return }
      // Buyer/seller must match selected tab
      if (user.role !== activeRole) {
        setError(`This is a ${user.role} account. Please select the ${user.role.charAt(0).toUpperCase()+user.role.slice(1)} tab.`)
        return
      }
      navigate(`/${user.role}`, { replace: true })
    } catch (err) {
      const isPending = err?.response?.data?.pending
      setError(isPending
        ? '⏳ Your seller account is pending admin approval.'
        : err?.response?.data?.message || err.message || 'Invalid email or password'
      )
    } finally { setLoading(false) }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 via-white to-purple-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">

        {/* Logo */}
        <div className="text-center mb-8">
          <Link to="/" className="inline-flex items-center gap-2.5 mb-3">
            <div className="w-12 h-12 bg-brand-500 rounded-2xl flex items-center justify-center shadow-lg">
              <ShoppingBag size={22} className="text-white"/>
            </div>
            <span className="font-display text-2xl font-bold text-gray-900">VivMart</span>
          </Link>
          <p className="text-gray-500 text-sm">India's live virtual shopping platform</p>
        </div>

        <div className="card p-8 shadow-xl">
          <h1 className="font-display text-2xl font-bold text-gray-900 text-center mb-6">Sign In</h1>

          {/* 3-tab role selector */}
          <div className="grid grid-cols-3 gap-2 mb-6">
            {ROLES.map(role => {
              const Icon = role.icon
              const isActive = activeRole === role.id
              return (
                <button
                  key={role.id}
                  type="button"
                  onClick={() => { setActiveRole(role.id); setError('') }}
                  className={`flex flex-col items-center gap-1.5 p-3 rounded-2xl border-2 transition-all ${
                    isActive ? role.active + ' shadow-sm' : 'border-gray-200 hover:border-gray-300 bg-white'
                  }`}
                >
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${isActive ? role.iconBg : 'bg-gray-100'}`}>
                    <Icon size={17} className={isActive ? 'text-white' : 'text-gray-500'}/>
                  </div>
                  <span className={`text-xs font-bold ${isActive ? role.textColor : 'text-gray-500'}`}>{role.label}</span>
                  <span className="text-xs text-gray-400 leading-tight text-center">{role.sub}</span>
                </button>
              )
            })}
          </div>

          {/* Admin info banner */}
          {activeRole === 'admin' && (
            <div className="mb-4 p-3 bg-purple-50 border border-purple-200 rounded-xl flex items-center gap-2">
              <Shield size={14} className="text-purple-600 flex-shrink-0"/>
              <p className="text-xs text-purple-700 font-medium">Admin panel — full platform access</p>
            </div>
          )}

          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm flex items-center gap-2">
              <span>⚠</span> {error}
            </div>
          )}

          <form onSubmit={handle} className="space-y-4">
            <div>
              <label className="label">Email Address</label>
              <div className="relative">
                <Mail size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"/>
                <input className="input pl-9" type="email"
                  placeholder={activeRole === 'admin' ? 'admin@vivmart.com' : activeRole === 'buyer' ? 'your@email.com' : 'seller@email.com'}
                  value={form.email}
                  onChange={e => setForm(f => ({...f, email: e.target.value}))}
                  required autoComplete="email"/>
              </div>
            </div>
            <div>
              <label className="label">Password</label>
              <div className="relative">
                <Lock size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"/>
                <input className="input pl-9 pr-10"
                  type={showPw ? 'text' : 'password'}
                  placeholder="Enter your password"
                  value={form.password}
                  onChange={e => setForm(f => ({...f, password: e.target.value}))}
                  required autoComplete="current-password"/>
                <button type="button" onClick={() => setShowPw(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                  {showPw ? <EyeOff size={15}/> : <Eye size={15}/>}
                </button>
              </div>
            </div>

            <button type="submit" disabled={loading}
              className={`w-full flex items-center justify-center gap-2 py-3 text-base font-bold rounded-xl text-white transition-all disabled:opacity-60 ${current.btnColor}`}>
              {loading
                ? <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"/>
                : `Sign In as ${current.label}`
              }
            </button>
          </form>

          {activeRole !== 'admin' && (
            <p className="text-center text-sm text-gray-500 mt-5">
              Don't have an account?{' '}
              <Link to={`/register?role=${activeRole}`} className="font-bold text-brand-600 hover:underline">
                Register as {current.label}
              </Link>
            </p>
          )}
        </div>
      </div>
    </div>
  )
}