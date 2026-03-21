import React, { useEffect, useState, useRef } from 'react'
import { Plus, Pencil, Trash2, X, Package, Search, Upload, Link as LinkIcon, ImageOff } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import api from '../../api'

const CATEGORIES = ['clothing','jewelry','glasses','hats','shoes','furniture','electronics','home-decor']
const AR_MODES   = ['body','face','room','3d','shoes']
const EMPTY_FORM = { name:'', category:'clothing', ar_mode:'3d', price:'', original_price:'', description:'', image_url:'', badge:'' }

export default function SellerProducts() {
  const { user } = useAuth()
  const [products, setProducts]     = useState([])
  const [loading, setLoading]       = useState(true)
  const [showModal, setShowModal]   = useState(false)
  const [editProduct, setEditProduct] = useState(null)
  const [form, setForm]             = useState(EMPTY_FORM)
  const [saving, setSaving]         = useState(false)
  const [error, setError]           = useState('')
  const [search, setSearch]         = useState('')
  const [imageMode, setImageMode]   = useState('upload')  // 'upload' | 'url'
  const [imagePreview, setImagePreview] = useState('')
  const fileInputRef = useRef(null)

  const fetchProducts = () => {
    api.get(`/products?sellerId=${user?.id}&limit=100`)
      .then(r => setProducts(r.data.products || []))
      .finally(() => setLoading(false))
  }
  useEffect(fetchProducts, [user?.id])

  const openNew = () => {
    setEditProduct(null); setForm(EMPTY_FORM)
    setImagePreview(''); setImageMode('upload')
    setError(''); setShowModal(true)
  }

  const openEdit = p => {
    setEditProduct(p)
    setForm({
      name: p.name, category: p.category,
      ar_mode: p.ar_mode || '3d', price: p.price,
      original_price: p.original_price || '',
      description: p.description || '',
      image_url: p.image_url || '', badge: p.badge || '',
    })
    setImagePreview(p.image_url || '')
    setImageMode(p.image_url?.startsWith('data:') ? 'upload' : 'url')
    setError(''); setShowModal(true)
  }

  // Convert selected file to base64
  const handleFileChange = e => {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 5 * 1024 * 1024) { setError('Image must be under 5MB'); return }
    const reader = new FileReader()
    reader.onload = ev => {
      const b64 = ev.target.result
      setImagePreview(b64)
      setForm(f => ({ ...f, image_url: b64 }))
      setError('')
    }
    reader.readAsDataURL(file)
  }

  const handleSave = async e => {
    e.preventDefault()
    setSaving(true); setError('')
    try {
      const payload = {
        ...form,
        price: parseFloat(form.price),
        original_price: form.original_price ? parseFloat(form.original_price) : undefined,
      }
      if (editProduct) {
        await api.put(`/products/${editProduct.id}`, { ...payload, featured: editProduct.featured, active: editProduct.active !== false })
      } else {
        await api.post('/products', payload)
      }
      setShowModal(false); fetchProducts()
    } catch (err) {
      setError(err?.response?.data?.message || 'Failed to save product')
    } finally { setSaving(false) }
  }

  const handleDelete = async id => {
    if (!confirm('Delete this product permanently?')) return
    try {
      await api.delete(`/products/${id}`)
      fetchProducts()
    } catch (err) {
      alert(err?.response?.data?.message || 'Failed to delete product')
    }
  }

  const filtered = products.filter(p => !search || p.name?.toLowerCase().includes(search.toLowerCase()))

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-title">My Products</h1>
          <p className="text-sm text-gray-500 mt-0.5">{products.length} products listed</p>
        </div>
        <button onClick={openNew} className="btn-primary"><Plus size={16}/> Add Product</button>
      </div>

      <div className="relative">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"/>
        <input className="input pl-9" placeholder="Search your products..." value={search} onChange={e => setSearch(e.target.value)}/>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(3)].map((_,i) => <div key={i} className="card h-56 animate-pulse"/>)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20">
          <Package size={40} className="mx-auto text-gray-300 mb-3"/>
          <p className="font-semibold text-gray-600">{search ? 'No products match' : 'No products yet'}</p>
          {!search && <button onClick={openNew} className="btn-primary mt-4">Add Your First Product</button>}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(p => (
            <div key={p.id} className="card overflow-hidden">
              <div className="aspect-video bg-gray-100 overflow-hidden relative">
                {p.image_url ? (
                  <img src={p.image_url} alt={p.name} className="w-full h-full object-cover"
                    onError={e => { e.target.style.display='none' }}/>
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <ImageOff size={28} className="text-gray-300"/>
                  </div>
                )}
                <div className="absolute top-2 left-2 flex gap-1">
                  {p.badge && <span className="badge-orange text-xs">{p.badge}</span>}
                  <span className="badge-blue text-xs">{p.ar_mode}</span>
                </div>
                <span className={`absolute top-2 right-2 badge text-xs ${p.active ? 'badge-green' : 'badge-gray'}`}>
                  {p.active ? 'Active' : 'Hidden'}
                </span>
              </div>
              <div className="p-4">
                <p className="font-semibold text-gray-800 truncate">{p.name}</p>
                <p className="text-xs text-gray-400 capitalize mt-0.5">{p.category}</p>
                <div className="flex items-center justify-between mt-3">
                  <div>
                    <p className="font-bold text-gray-900">₹{parseFloat(p.price).toLocaleString('en-IN')}</p>
                    {p.original_price && <p className="text-xs text-gray-400 line-through">₹{parseFloat(p.original_price).toLocaleString('en-IN')}</p>}
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => openEdit(p)} className="p-2 rounded-lg hover:bg-blue-50 text-blue-500 transition-colors"><Pencil size={14}/></button>
                    <button onClick={() => handleDelete(p.id)} className="p-2 rounded-lg hover:bg-red-50 text-red-500 transition-colors"><Trash2 size={14}/></button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Add / Edit Modal ── */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl w-full max-w-lg max-h-[92vh] overflow-y-auto shadow-2xl">
            <div className="sticky top-0 bg-white px-6 py-4 border-b border-gray-100 flex items-center justify-between z-10">
              <h2 className="font-display text-lg font-bold">{editProduct ? 'Edit Product' : 'Add New Product'}</h2>
              <button onClick={() => setShowModal(false)} className="p-2 hover:bg-gray-100 rounded-xl"><X size={16}/></button>
            </div>

            <form onSubmit={handleSave} className="p-6 space-y-4">
              {error && <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">{error}</div>}

              <div>
                <label className="label">Product Name *</label>
                <input className="input" value={form.name} onChange={e => setForm(f=>({...f,name:e.target.value}))} required/>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Category *</label>
                  <select className="input" value={form.category} onChange={e => setForm(f=>({...f,category:e.target.value}))}>
                    {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label">AR Mode</label>
                  <select className="input" value={form.ar_mode} onChange={e => setForm(f=>({...f,ar_mode:e.target.value}))}>
                    {AR_MODES.map(m => <option key={m} value={m}>{m}</option>)}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Price (₹) *</label>
                  <input className="input" type="number" min="0" step="0.01" value={form.price} onChange={e => setForm(f=>({...f,price:e.target.value}))} required/>
                </div>
                <div>
                  <label className="label">Original Price (₹)</label>
                  <input className="input" type="number" min="0" step="0.01" value={form.original_price} onChange={e => setForm(f=>({...f,original_price:e.target.value}))}/>
                </div>
              </div>

              {/* ── Image section ── */}
              <div>
                <label className="label">Product Image</label>

                {/* Toggle: Upload vs URL */}
                <div className="flex gap-2 mb-3 p-1 bg-gray-100 rounded-xl w-fit">
                  <button type="button" onClick={() => { setImageMode('upload'); setImagePreview(''); setForm(f=>({...f,image_url:''})) }}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${imageMode==='upload' ? 'bg-white text-brand-600 shadow-sm' : 'text-gray-500'}`}>
                    <Upload size={12}/> Upload File
                  </button>
                  <button type="button" onClick={() => { setImageMode('url'); setImagePreview(''); setForm(f=>({...f,image_url:''})) }}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${imageMode==='url' ? 'bg-white text-brand-600 shadow-sm' : 'text-gray-500'}`}>
                    <LinkIcon size={12}/> Image URL
                  </button>
                </div>

                {imageMode === 'upload' ? (
                  <div>
                    <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange}/>
                    <button type="button" onClick={() => fileInputRef.current?.click()}
                      className="w-full border-2 border-dashed border-gray-300 rounded-xl p-4 text-center hover:border-brand-400 hover:bg-brand-50 transition-all">
                      {imagePreview ? (
                        <img src={imagePreview} alt="preview" className="w-full max-h-40 object-contain rounded-lg"/>
                      ) : (
                        <div className="text-gray-400">
                          <Upload size={24} className="mx-auto mb-2"/>
                          <p className="text-sm font-semibold">Click to upload image</p>
                          <p className="text-xs mt-0.5">JPG, PNG, WebP — max 5MB</p>
                        </div>
                      )}
                    </button>
                    {imagePreview && (
                      <button type="button" onClick={() => { setImagePreview(''); setForm(f=>({...f,image_url:''})); if(fileInputRef.current) fileInputRef.current.value='' }}
                        className="text-xs text-red-500 mt-1 hover:underline">
                        Remove image
                      </button>
                    )}
                  </div>
                ) : (
                  <div>
                    <input className="input" placeholder="https://example.com/image.jpg"
                      value={form.image_url.startsWith('data:') ? '' : form.image_url}
                      onChange={e => { setForm(f=>({...f,image_url:e.target.value})); setImagePreview(e.target.value) }}/>
                    {imagePreview && !imagePreview.startsWith('data:') && (
                      <div className="mt-2 rounded-xl overflow-hidden border border-gray-100 bg-gray-50 h-32">
                        <img src={imagePreview} alt="preview" className="w-full h-full object-contain"
                          onError={() => setImagePreview('')}/>
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div>
                <label className="label">Badge (optional)</label>
                <input className="input" value={form.badge} onChange={e => setForm(f=>({...f,badge:e.target.value}))} placeholder="e.g. Best Seller, New, Hot"/>
              </div>

              <div>
                <label className="label">Description</label>
                <textarea className="input resize-none" rows={3} value={form.description} onChange={e => setForm(f=>({...f,description:e.target.value}))}/>
              </div>

              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowModal(false)} className="btn-secondary flex-1 justify-center">Cancel</button>
                <button type="submit" disabled={saving} className="btn-primary flex-1 justify-center">
                  {saving ? <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"/> : editProduct ? 'Save Changes' : 'Add Product'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}