import React, { useState } from 'react'
import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { ShoppingBag, Home, Grid, Video, ShoppingCart, ClipboardList, LogOut, Menu, X, User } from 'lucide-react'
import NotificationBell from '../ui/NotificationBell'
import { useAuth } from '../../context/AuthContext'
import { useCart } from '../../context/CartContext'

const navItems = [
  { to:'/buyer',           icon:Home,          label:'Home',       end:true },
  { to:'/buyer/products',  icon:Grid,          label:'Products' },
  { to:'/buyer/live',      icon:Video,         label:'Live Sessions' },
  { to:'/buyer/cart',      icon:ShoppingCart,  label:'My Cart' },
  { to:'/buyer/orders',    icon:ClipboardList, label:'My Orders' },
]

export default function BuyerLayout() {
  const { user, logout } = useAuth()
  const { count } = useCart()
  const navigate = useNavigate()
  const [mobileOpen, setMobileOpen] = useState(false)

  const handleLogout = () => { logout(); navigate('/') }

  const Sidebar = () => (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className="px-4 py-5 border-b border-gray-100">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-brand-500 rounded-lg flex items-center justify-center">
            <ShoppingBag size={15} className="text-white"/>
          </div>
          <span className="font-display text-lg font-bold text-gray-900">VivMart</span>
        </div>
      </div>

      {/* User */}
      <div className="px-4 py-4 border-b border-gray-100">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-brand-100 flex items-center justify-center text-brand-700 font-bold text-sm flex-shrink-0">
            {user?.name?.charAt(0)?.toUpperCase()}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-gray-800 truncate">{user?.name}</p>
            <p className="text-xs text-gray-500 capitalize">{user?.role}</p>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        {navItems.map(item => (
          <NavLink key={item.to} to={item.to} end={item.end}
            className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
            onClick={() => setMobileOpen(false)}
          >
            <item.icon size={18}/>
            <span>{item.label}</span>
            {item.to === '/buyer/cart' && count > 0 && (
              <span className="ml-auto bg-brand-500 text-white text-xs font-bold w-5 h-5 rounded-full flex items-center justify-center">{count > 9 ? '9+' : count}</span>
            )}
          </NavLink>
        ))}
      </nav>

      {/* Logout */}
      <div className="px-3 py-4 border-t border-gray-100">
        <button onClick={handleLogout} className="nav-item w-full text-red-500 hover:bg-red-50 hover:text-red-600">
          <LogOut size={18}/> <span>Sign Out</span>
        </button>
      </div>
    </div>
  )

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex flex-col w-60 bg-white border-r border-gray-100 flex-shrink-0">
        <Sidebar/>
      </aside>

      {/* Mobile sidebar */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={() => setMobileOpen(false)}/>
          <aside className="absolute left-0 top-0 bottom-0 w-64 bg-white shadow-xl">
            <Sidebar/>
          </aside>
        </div>
      )}

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top bar */}
        <header className="h-14 bg-white border-b border-gray-100 flex items-center justify-between px-4 flex-shrink-0">
          <button onClick={() => setMobileOpen(true)} className="lg:hidden p-2 -ml-2 text-gray-500 hover:text-gray-700">
            <Menu size={20}/>
          </button>
          <div className="flex items-center gap-2 ml-auto">
            <NotificationBell/>
            <NavLink to="/buyer/cart" className="relative p-2 text-gray-500 hover:text-brand-600 hover:bg-brand-50 rounded-xl">
              <ShoppingCart size={18}/>
              {count > 0 && <span className="absolute top-1 right-1 w-4 h-4 bg-brand-500 text-white text-xs rounded-full flex items-center justify-center font-bold">{count > 9 ? '9+' : count}</span>}
            </NavLink>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto">
          <div className="p-6 page-enter">
            <Outlet/>
          </div>
        </main>
      </div>
    </div>
  )
}