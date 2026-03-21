import React, { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { ShoppingBag, User, Mail, Lock, Eye, EyeOff, ShoppingCart, Store } from 'lucide-react'
import { useAuth } from '../context/AuthContext'

export default function RegisterPage() {
  const { register } = useAuth()
  const navigate = useNavigate()
  const [params] = useSearchParams()

  const [activeRole, setActiveRole] = useState(params.get('role') || 'buyer')
  const [form, setForm]             = useState({ name:'', email:'', password:'', confirmPassword:'' })
  const [showPw, setShowPw]         = useState(false)
  const [loading, setLoading]       = useState(false)
  const [error, setError]           = useState('')
  const [pending, setPending]       = useState(false)

  const handle = async e => {
    e.preventDefault()
    if (!form.name.trim())  { setError('Please enter your full name'); return }
    if (!form.email)        { setError('Please enter your email'); return }
    if (form.password.length < 6) { setError('Password must be at least 6 characters'); return }
    if (form.password !== form.confirmPassword) { setError('Passwords do not match'); return }
    setError(''); setLoading(true)
    try {
      const result = await register(form.name.trim(), form.email, form.password, activeRole)
      if (result?.pending) { setPending(true); return }
      navigate(`/${result.role}`, { replace: true })
    } catch (err) {
      setError(err?.response?.data?.message || err.message || 'Registration failed')
    } finally { setLoading(false) }
  }

  if (pending) return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 via-white to-amber-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md text-center">
        <div className="card p-10 shadow-xl">
          <div className="w-20 h-20 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-5">
            <span className="text-4xl">⏳</span>
          </div>
          <h2 className="font-display text-2xl font-bold text-gray-900 mb-3">Registration Submitted!</h2>
          <p className="text-gray-600 mb-2">Your seller account is <span className="font-bold text-yellow-600">pending admin approval</span>.</p>
          <p className="text-sm text-gray-500 mb-6">You will be notified once your account is approved.</p>
          <Link to="/login" className="btn-primary w-full justify-center py-3">Back to Login</Link>
        </div>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 via-white to-amber-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Link to="/" className="inline-flex items-center gap-2 mb-4">
            <div className="w-12 h-12 bg-brand-500 rounded-2xl flex items-center justify-center shadow-lg">
              <ShoppingBag size={22} className="text-white"/>
            </div>
            <span className="font-display text-2xl font-bold text-gray-900">VivMart</span>
          </Link>
          <p className="text-gray-500 text-sm">Create your account and start today</p>
        </div>

        <div className="card p-8 shadow-xl">
          <h1 className="font-display text-2xl font-bold text-gray-900 text-center mb-6">Create Account</h1>

          {/* Role selector */}
          <div className="flex gap-3 mb-6">
            <button type="button" onClick={() => { setActiveRole('buyer'); setError('') }}
              className={`flex-1 flex flex-col items-center gap-2 p-4 rounded-2xl border-2 transition-all ${activeRole==='buyer' ? 'border-brand-500 bg-brand-50' : 'border-gray-200 hover:border-gray-300'}`}>
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${activeRole==='buyer' ? 'bg-brand-500' : 'bg-gray-100'}`}>
                <ShoppingCart size={18} className={activeRole==='buyer' ? 'text-white' : 'text-gray-500'}/>
              </div>
              <span className={`text-sm font-bold ${activeRole==='buyer' ? 'text-brand-600' : 'text-gray-500'}`}>Buyer</span>
              <span className="text-xs text-gray-400">Shop & buy</span>
            </button>
            <button type="button" onClick={() => { setActiveRole('seller'); setError('') }}
              className={`flex-1 flex flex-col items-center gap-2 p-4 rounded-2xl border-2 transition-all ${activeRole==='seller' ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-gray-300'}`}>
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${activeRole==='seller' ? 'bg-blue-500' : 'bg-gray-100'}`}>
                <Store size={18} className={activeRole==='seller' ? 'text-white' : 'text-gray-500'}/>
              </div>
              <span className={`text-sm font-bold ${activeRole==='seller' ? 'text-blue-600' : 'text-gray-500'}`}>Seller</span>
              <span className="text-xs text-gray-400">Sell products</span>
            </button>
          </div>

          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">⚠ {error}</div>
          )}

          <form onSubmit={handle} className="space-y-4">
            <div>
              <label className="label">Full Name *</label>
              <div className="relative">
                <User size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"/>
                <input className="input pl-9" placeholder="Your full name"
                  value={form.name} onChange={e => setForm(f=>({...f,name:e.target.value}))} required/>
              </div>
            </div>
            <div>
              <label className="label">Email Address *</label>
              <div className="relative">
                <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"/>
                <input className="input pl-9" type="email" placeholder="you@example.com"
                  value={form.email} onChange={e => setForm(f=>({...f,email:e.target.value}))} required/>
              </div>
            </div>
            <div>
              <label className="label">Password * <span className="text-gray-400 font-normal">(min 6 characters)</span></label>
              <div className="relative">
                <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"/>
                <input className="input pl-9 pr-10" type={showPw ? 'text' : 'password'} placeholder="Create a password"
                  value={form.password} onChange={e => setForm(f=>({...f,password:e.target.value}))} required minLength={6}/>
                <button type="button" onClick={() => setShowPw(v=>!v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                  {showPw ? <EyeOff size={16}/> : <Eye size={16}/>}
                </button>
              </div>
            </div>
            <div>
              <label className="label">Confirm Password *</label>
              <div className="relative">
                <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"/>
                <input className="input pl-9" type="password" placeholder="Re-enter password"
                  value={form.confirmPassword} onChange={e => setForm(f=>({...f,confirmPassword:e.target.value}))} required/>
              </div>
            </div>
            {form.confirmPassword && (
              <p className={`text-xs ${form.password===form.confirmPassword ? 'text-green-600' : 'text-red-500'}`}>
                {form.password===form.confirmPassword ? '✓ Passwords match' : '✗ Passwords do not match'}
              </p>
            )}
            <button type="submit"
              disabled={loading || (form.confirmPassword && form.password !== form.confirmPassword)}
              className={`w-full justify-center py-3 text-base font-bold rounded-xl text-white transition-all flex items-center gap-2 ${activeRole==='buyer' ? 'bg-brand-500 hover:bg-brand-600' : 'bg-blue-500 hover:bg-blue-600'} disabled:opacity-60`}>
              {loading
                ? <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"/>
                : `Create ${activeRole.charAt(0).toUpperCase()+activeRole.slice(1)} Account`}
            </button>
          </form>

          <p className="text-center text-sm text-gray-500 mt-6">
            Already have an account?{' '}
            <Link to="/login" className="font-bold text-brand-600 hover:underline">Sign In</Link>
          </p>
        </div>
      </div>
    </div>
  )
}