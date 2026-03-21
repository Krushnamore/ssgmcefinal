import React, { createContext, useContext, useState } from 'react'
import api from '../api'

const AuthContext = createContext(null)

// Restore user from localStorage immediately - no async check
const getStoredUser = () => {
  try {
    const token = localStorage.getItem('vivmart_token')
    const u     = localStorage.getItem('vivmart_user')
    if (token && u) return JSON.parse(u)
  } catch {}
  return null
}

export function AuthProvider({ children }) {
  const [user,    setUser]    = useState(getStoredUser)  // restore immediately
  const [loading, setLoading] = useState(false)

  const saveUser = (u, token) => {
    localStorage.setItem('vivmart_token', token)
    localStorage.setItem('vivmart_user', JSON.stringify(u))
    setUser(u)
  }

  const clearAll = () => {
    localStorage.removeItem('vivmart_token')
    localStorage.removeItem('vivmart_user')
    setUser(null)
  }

  const login = async (email, password) => {
    setLoading(true)
    try {
      const { data } = await api.post('/auth/login', { email, password })
      if (data.success) {
        saveUser(data.user, data.token)
        return data.user
      }
      throw new Error(data.message || 'Login failed')
    } finally {
      setLoading(false)
    }
  }

  const register = async (name, email, password, role = 'buyer') => {
    setLoading(true)
    try {
      const { data } = await api.post('/auth/register', { name, email, password, role })
      if (data.pending) return { pending: true }
      if (data.success) {
        saveUser(data.user, data.token)
        return data.user
      }
      throw new Error(data.message || 'Registration failed')
    } finally {
      setLoading(false)
    }
  }

  const logout = () => clearAll()

  return (
    <AuthContext.Provider value={{
      user, loading, login, register, logout,
      isAuthenticated: !!user,
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}