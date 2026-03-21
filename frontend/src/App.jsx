import React from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import { CartProvider } from './context/CartContext'

// Public pages
import LandingPage   from './pages/LandingPage'
import LoginPage     from './pages/LoginPage'
import RegisterPage  from './pages/RegisterPage'

// Buyer pages
import BuyerLayout      from './components/layout/BuyerLayout'
import BuyerHome        from './pages/buyer/BuyerHome'
import BuyerProducts    from './pages/buyer/BuyerProducts'
import BuyerProductDetail from './pages/buyer/BuyerProductDetail'
import BuyerLiveSession from './pages/buyer/BuyerLiveSession'
import BuyerCart        from './pages/buyer/BuyerCart'
import BuyerCheckout    from './pages/buyer/BuyerCheckout'
import BuyerOrders      from './pages/buyer/BuyerOrders'

// Seller pages
import SellerLayout     from './components/layout/SellerLayout'
import SellerDashboard  from './pages/seller/SellerDashboard'
import SellerProducts   from './pages/seller/SellerProducts'
import SellerLive       from './pages/seller/SellerLive'
import SellerOrders     from './pages/seller/SellerOrders'
import SellerCallRequests from './pages/seller/SellerCallRequests'

// Admin pages
import AdminLayout      from './components/layout/AdminLayout'
import AdminDashboard   from './pages/admin/AdminDashboard'
import AdminProducts    from './pages/admin/AdminProducts'
import AdminUsers       from './pages/admin/AdminUsers'
import AdminOrders      from './pages/admin/AdminOrders'
import AdminSellers     from './pages/admin/AdminSellers'

// Loader
const Loader = () => (
  <div className="min-h-screen flex items-center justify-center bg-gray-50">
    <div className="w-8 h-8 border-3 border-brand-500 border-t-transparent rounded-full animate-spin"/>
  </div>
)

// Route guards
const RequireAuth = ({ children, allowedRoles }) => {
  const { isAuthenticated, user, loading } = useAuth()
  if (loading) return <Loader/>
  if (!isAuthenticated) return <Navigate to="/login" replace/>
  if (allowedRoles && !allowedRoles.includes(user?.role)) {
    const redirects = { buyer: '/buyer', seller: '/seller', admin: '/admin' }
    return <Navigate to={redirects[user?.role] || '/'} replace/>
  }
  return children
}

const AppRoutes = () => {
  const { user, isAuthenticated, loading } = useAuth()

  return (
    <Routes>
      {/* Public */}
      <Route path="/"         element={<LandingPage/>}/>
      <Route path="/login"    element={isAuthenticated
        ? <Navigate to={`/${user?.role}`} replace/> : <LoginPage/>}/>
      <Route path="/register" element={isAuthenticated
        ? <Navigate to={`/${user?.role}`} replace/> : <RegisterPage/>}/>

      {/* Buyer */}
      <Route path="/buyer" element={<RequireAuth allowedRoles={['buyer']}><BuyerLayout/></RequireAuth>}>
        <Route index                  element={<BuyerHome/>}/>
        <Route path="products"        element={<BuyerProducts/>}/>
        <Route path="products/:id"    element={<BuyerProductDetail/>}/>
        <Route path="live"            element={<BuyerLiveSession/>}/>
        <Route path="cart"            element={<BuyerCart/>}/>
        <Route path="checkout"        element={<BuyerCheckout/>}/>
        <Route path="orders"          element={<BuyerOrders/>}/>
      </Route>

      {/* Seller */}
      <Route path="/seller" element={<RequireAuth allowedRoles={['seller']}><SellerLayout/></RequireAuth>}>
        <Route index             element={<SellerDashboard/>}/>
        <Route path="products"   element={<SellerProducts/>}/>
        <Route path="live"       element={<SellerLive/>}/>
        <Route path="orders"     element={<SellerOrders/>}/>
        <Route path="calls"      element={<SellerCallRequests/>}/>
      </Route>

      {/* Admin */}
      <Route path="/admin" element={<RequireAuth allowedRoles={['admin']}><AdminLayout/></RequireAuth>}>
        <Route index             element={<AdminDashboard/>}/>
        <Route path="products"   element={<AdminProducts/>}/>
        <Route path="users"      element={<AdminUsers/>}/>
        <Route path="orders"     element={<AdminOrders/>}/>
        <Route path="sellers"    element={<AdminSellers/>}/>
      </Route>

      <Route path="*" element={<Navigate to="/" replace/>}/>
    </Routes>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <CartProvider>
          <AppRoutes/>
        </CartProvider>
      </AuthProvider>
    </BrowserRouter>
  )
}