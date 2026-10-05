import React, { useEffect, useMemo, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { createClient } from '@supabase/supabase-js'
import { Heart, Plus, Sparkles, Sun, CloudRain, Wind, Search, SlidersHorizontal, Shirt, CalendarDays, UserRound, LayoutGrid, X, ChevronDown, RefreshCw, Check, ArrowUpRight, CloudSun, Upload, Trash2, Menu } from 'lucide-react'
import './styles.css'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY
const supabase = supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null

const starterItems = [
  { id: 1, name: 'Blazer oversize', category: 'Prendas', color: 'Arena', brand: 'Massimo Dutti', image: 'photo-1591369822096-ffd140ec948f', type: 'blazer', tags: ['arreglado', 'capas'] },
  { id: 2, name: 'Top de punto', category: 'Prendas', color: 'Marfil', brand: 'COS', image: 'photo-1618354691373-d851c5c3a990', type: 'top', tags: ['básico', 'comodidad'] },
  { id: 3, name: 'Vaquero recto', category: 'Prendas', color: 'Azul claro', brand: 'Levi’s', image: 'photo-1541099649105-f69ad21f3246', type: 'jeans', tags: ['casual'] },
  { id: 4, name: 'Falda satinada', category: 'Prendas', color: 'Champán', brand: 'Sézane', image: 'photo-1583496661160-fb5886a0aaaa', type: 'skirt', tags: ['arreglado', 'cita'] },
  { id: 5, name: 'Bolso de hombro', category: 'Bolsos', color: 'Marrón', brand: 'Polène', image: 'photo-1584917865442-de89df76afd3', type: 'bag', tags: ['arreglado'] },
  { id: 6, name: 'Bailarinas', category: 'Zapatos', color: 'Granate', brand: 'Jonak', image: 'photo-1535043934128-cf0b28d52f95', type: 'shoes', tags: ['comodidad', 'arreglado'] },
  { id: 7, name: 'Gabardina ligera', category: 'Prendas', color: 'Beige', brand: 'Mango', image: 'photo-1548126032-079a0fb0099d', type: 'coat', tags: ['capas', 'lluvia'] },
  { id: 8, name: 'Collar dorado', category: 'Accesorios', color: 'Dorado', brand: 'PDPAOLA', image: 'photo-1611652022419-a9419f74343d', type: 'accessory', tags: ['arreglado'] },
]

const imageUrl = (id, w = 500) => `https://images.unsplash.com/${id}?auto=format&fit=crop&w=${w}&q=85`
const photoSrc = image => image?.startsWith('blob:') || image?.startsWith('http') || image?.startsWith('data:') ? image : imageUrl(image)
const occasions = ['Universidad', 'Cena', 'Brunch', 'Cita', 'Fiesta', 'Boda', 'Viaje']
const categories = ['Todo', 'Prendas', 'Zapatos', 'Bolsos', 'Accesorios']

function App() {
  const [items, setItems] = useState(starterItems)
  const [category, setCategory] = useState('Todo')
  const [activeNav, setActiveNav] = useState('Mi armario')
  const [occasion, setOccasion] = useState('Brunch')
  const [vibe, setVibe] = useState('Arreglada, pero sin esfuerzo')
  const [outfitIndex, setOutfitIndex] = useState(0)
  const [liked, setLiked] = useState(false)
  const [query, setQuery] = useState('')
  const [showAdd, setShowAdd] = useState(false)
  const [showAll, setShowAll] = useState(false)
  const [mobileMenu, setMobileMenu] = useState(false)
  const [notice, setNotice] = useState('')
  const [session, setSession] = useState(null)
  const [showLogin, setShowLogin] = useState(false)
  const [loginEmail, setLoginEmail] = useState('')
  const [cloudMode, setCloudMode] = useState(false)
  const filtered = useMemo(() => items.filter(x => (category === 'Todo' || x.category === category) && `${x.name} ${x.color} ${x.brand}`.toLowerCase().includes(query.toLowerCase())), [items, category, query])
  const outfitSets = [
    [1, 2, 3, 5], [4, 2, 6, 8], [1, 2, 6, 5],
  ]
  const currentOutfit = (outfitSets[outfitIndex % outfitSets.length]).map(id => items.find(x => x.id === id)).filter(Boolean)
  const visibleItems = showAll ? filtered : filtered.slice(0, 4)

  useEffect(() => {
    if (!supabase) {
      try { const saved = localStorage.getItem('outfit-check-wardrobe'); if (saved) setItems(JSON.parse(saved)) } catch {}
      return
    }
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data: listener } = supabase.auth.onAuthStateChange((_event, current) => setSession(current))
    return () => listener.subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (!supabase) { try { localStorage.setItem('outfit-check-wardrobe', JSON.stringify(items)) } catch {} }
  }, [items])

  useEffect(() => {
    if (!session?.user) { setCloudMode(false); return }
    let cancelled = false
    supabase.from('wardrobe_items').select('*').eq('user_id', session.user.id).order('created_at', { ascending: false }).then(({ data, error }) => {
      if (cancelled) return
      if (error) { setNotice('Revisa la configuración de la tabla en Supabase'); setTimeout(() => setNotice(''), 3500); return }
      setItems((data || []).map(row => ({ id: row.id, name: row.name, category: row.category, color: row.color || '—', brand: row.brand || '—', image: row.image_url || 'photo-1591369822096-ffd140ec948f', type: 'cloud', tags: row.tags || [] })))
      setCloudMode(true)
    })
    return () => { cancelled = true }
  }, [session])

  const saveToSupabase = async (item, file) => {
    if (!supabase || !session?.user) return
    let photoUrl = item.image?.startsWith('http') ? item.image : imageUrl(item.image)
    if (file?.size) {
      const path = `${session.user.id}/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, '-')}`
      const { error: uploadError } = await supabase.storage.from('wardrobe-photos').upload(path, file, { upsert: false })
      if (!uploadError) photoUrl = supabase.storage.from('wardrobe-photos').getPublicUrl(path).data.publicUrl
    }
    const { data, error } = await supabase.from('wardrobe_items').insert({ user_id: session.user.id, name: item.name, category: item.category, color: item.color, brand: item.brand, image_url: photoUrl, tags: item.tags ?? [] }).select().single()
    if (error) { setNotice('No se pudo guardar en Supabase; revisa la configuración'); setTimeout(() => setNotice(''), 3500); return }
    if (data) setItems(prev => prev.map(existing => existing.id === item.id ? { ...existing, id: data.id, image: data.image_url || existing.image } : existing))
  }

  const addItem = async (event) => {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const file = form.get('photo')
    let image = 'photo-1591369822096-ffd140ec948f'
    if (file?.size) image = await new Promise(resolve => { const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.readAsDataURL(file) })
    const item = { id: Date.now(), name: form.get('name'), category: form.get('category'), color: form.get('color') || 'Sin especificar', brand: form.get('brand') || '—', image, type: 'custom', tags: [] }
    setItems(prev => [item, ...prev]); setShowAdd(false); setNotice('Prenda añadida a tu armario ✨'); setTimeout(() => setNotice(''), 2800)
    await saveToSupabase(item, file?.size ? file : null)
  }

  const sendMagicLink = async (event) => {
    event.preventDefault()
    const { error } = await supabase.auth.signInWithOtp({ email: loginEmail, options: { emailRedirectTo: window.location.origin } })
    if (error) setNotice('No se pudo enviar el enlace. Comprueba la configuración de Supabase.')
    else setNotice('Te hemos enviado un enlace de acceso por email ✨')
    setShowLogin(false); setTimeout(() => setNotice(''), 4000)
  }

  const deleteItem = async (id) => {
    setItems(prev => prev.filter(x => x.id !== id))
    if (supabase && session?.user && typeof id === 'string') await supabase.from('wardrobe_items').delete().eq('id', id).eq('user_id', session.user.id)
  }

  const makeLook = () => { setOutfitIndex(i => i + 1); setLiked(false) }

  const nav = <>
    <div className="brand"><div className="brand-mark">oc</div><span>outfit check</span></div>
    <div className="nav-label">TU ESPACIO</div>
    <button className={`nav-item ${activeNav === 'Mi armario' ? 'active' : ''}`} onClick={() => {setActiveNav('Mi armario');setMobileMenu(false)}}><LayoutGrid size={18}/> Mi armario <span className="nav-count">{items.length}</span></button>
    <button className={`nav-item ${activeNav === 'Mis looks' ? 'active' : ''}`} onClick={() => {setActiveNav('Mis looks');setMobileMenu(false)}}><Heart size={18}/> Mis looks</button>
    <button className={`nav-item ${activeNav === 'Mi perfil' ? 'active' : ''}`} onClick={() => {setActiveNav('Mi perfil');setMobileMenu(false)}}><UserRound size={18}/> Mi perfil</button>
    <div className="side-note"><div className="side-note-icon"><Sparkles size={17}/></div><p>Tu armario, tus planes, <b>el look perfecto.</b></p><button onClick={() => document.getElementById('stylist')?.scrollIntoView({behavior:'smooth'})}>Descubrir mi estilo <ArrowUpRight size={14}/></button></div>
    <button className="profile-mini profile-button" onClick={()=>session ? supabase?.auth.signOut() : setShowLogin(true)}><div className="avatar">M</div><div><b>{session?.user?.email || 'María García'}</b><small>{session ? 'Sesión conectada' : (supabase ? 'Conectar mi cuenta' : 'Modo de prueba')}</small></div>{session?<ChevronDown size={16}/>:<ArrowUpRight size={15}/>}</button>
  </>

  return <div className="app-shell">
    <aside className={`sidebar ${mobileMenu ? 'mobile-open' : ''}`}>{nav}</aside>
    {mobileMenu && <button className="mobile-overlay" aria-label="Cerrar menú" onClick={()=>setMobileMenu(false)} />}
    <main className="main-area">
      <header className="topbar"><button className="mobile-menu-btn" onClick={()=>setMobileMenu(true)} aria-label="Abrir menú"><Menu size={20}/></button><div className="crumb">Mi espacio <span>/</span> <b>{activeNav}</b></div><div className="top-right"><div className="weather"><Sun size={17}/><b>22°</b><span>Madrid</span></div><div className="top-avatar">M</div></div></header>
      <div className="page-content">
        <section className="welcome-row"><div><div className="eyebrow">LUNES, 5 DE OCTUBRE <span>·</span> MADRID</div><h1>Hola, María <span className="wave">✳</span></h1><p>Hoy tienes plan. Del look nos encargamos nosotras.</p></div><button className="primary-button" onClick={()=>{document.getElementById('stylist')?.scrollIntoView({behavior:'smooth'})}}><Sparkles size={17}/> Crear un look</button></section>
        <section className="hero" id="stylist"><div className="hero-photo"/><div className="hero-wash"/><div className="hero-content"><div className="hero-kicker"><Sparkles size={14}/> TU ESTILISTA PERSONAL</div><h2>¿Qué me pongo<br/>hoy?</h2><p>Tu armario tiene la respuesta.<br/>Nosotras te ayudamos a encontrarla.</p><div className="hero-bottom"><button className="hero-cta" onClick={()=>document.getElementById('look-builder')?.scrollIntoView({behavior:'smooth'})}>Encuentra tu look <ArrowUpRight size={16}/></button><div className="hero-rating"><div className="rating-dots"><i/><i/><i/></div><span>Looks que sí son tú</span></div></div></div><div className="hero-sticker"><Sparkles size={14}/><span>hecho para ti</span></div></section>
        <section className="look-section" id="look-builder"><div className="section-heading"><div><div className="eyebrow blush">A TU MANERA</div><h2>Un look para tu plan</h2><p>Cuéntanos qué tienes y cómo te quieres sentir.</p></div><span className="step-count">01 <i>/ 03</i></span></div>
          <div className="builder-card"><div className="builder-controls"><label className="field-label">¿A dónde vas?</label><div className="occasion-chips">{occasions.map(o=><button key={o} className={`occasion-chip ${occasion===o?'selected':''}`} onClick={()=>setOccasion(o)}>{o}</button>)}</div><div className="builder-divider"/><label className="field-label">¿Cómo quieres ir?</label><div className="vibe-field"><Sparkles size={17}/><input value={vibe} onChange={e=>setVibe(e.target.value)} aria-label="Describe tu estilo"/><button title="Sugerencia aleatoria" onClick={()=>setVibe(['Arreglada, pero sin esfuerzo','Cómoda y con un toque especial','Elegante sin parecer demasiado arreglada'][Math.floor(Math.random()*3)])}><RefreshCw size={16}/></button></div><div className="weather-line"><CloudSun size={18}/><span>Hoy en Madrid: <b>22° y soleado</b></span><span className="weather-sep">·</span><span>ideal para capas ligeras</span><button title="El tiempo"><ChevronDown size={15}/></button></div><button className="generate-button" onClick={makeLook}><Sparkles size={17}/> Crear mi look <ArrowUpRight size={16}/></button></div>
            <div className="look-result"><div className="result-top"><span className="result-label"><span className="live-dot"/> TU LOOK DE HOY</span><button className={`heart-btn ${liked?'liked':''}`} onClick={()=>setLiked(!liked)} aria-label="Guardar look"><Heart size={19} fill={liked?'currentColor':'none'}/></button></div><div className="outfit-images">{currentOutfit.slice(0,3).map((item,i)=><div className={`outfit-image outfit-image-${i}`} key={item.id}><img src={photoSrc(item.image)} alt={item.name}/><span>{item.name}</span></div>)}</div><div className="outfit-copy"><div><h3>Un brunch con encanto</h3><p>{occasion} · {vibe || 'A tu estilo'}</p></div><button className="text-action" onClick={makeLook}>Otro look <RefreshCw size={15}/></button></div><div className="look-tip"><Sparkles size={14}/><span>El blazer arena le da ese punto especial al vaquero. Las bailarinas te llevan a cualquier parte.</span></div></div>
          </div>
        </section>
        <section className="wardrobe-section"><div className="wardrobe-heading"><div><div className="eyebrow blush">TUS FAVORITOS, JUNTITOS</div><h2>Mi armario <span className="item-total">{items.length}</span></h2></div><button className="outline-button" onClick={()=>setShowAdd(true)}><Plus size={17}/> Añadir prenda</button></div><div className="wardrobe-toolbar"><div className="category-tabs">{categories.map(c=><button key={c} className={category===c?'current':''} onClick={()=>{setCategory(c);setShowAll(false)}}>{c}</button>)}</div><div className="toolbar-actions"><label className="search-box"><Search size={16}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Buscar en mi armario"/></label><button className="filter-btn"><SlidersHorizontal size={16}/><span>Filtrar</span></button></div></div><div className="item-grid">{visibleItems.map(item=><article className="wardrobe-item" key={item.id}><div className="item-photo"><img src={photoSrc(item.image)} alt={item.name}/><button className="item-heart" title="Guardar"><Heart size={15}/></button><span className="item-category">{item.category}</span></div><div className="item-info"><div><h3>{item.name}</h3><p>{item.brand} <span>·</span> {item.color}</p></div><button className="item-menu" aria-label="Eliminar prenda" onClick={()=>deleteItem(item.id)}><Trash2 size={15}/></button></div></article>)}</div>{filtered.length===0&&<div className="empty-state">No hay prendas en esta categoría todavía.</div>}{filtered.length>4&&<button className="see-all" onClick={()=>setShowAll(!showAll)}>{showAll?'Ver menos':'Ver las '+filtered.length+' prendas'} <ArrowUpRight size={15}/></button>}</section>
        <footer><span>outfit check <span className="footer-heart">♥</span> hecho con estilo</span><span>Tu armario. Tus reglas.</span></footer>
      </div>
    </main>
    {notice&&<div className="toast"><Check size={17}/>{notice}</div>}
    {showAdd&&<div className="modal-backdrop" onClick={()=>setShowAdd(false)}><form className="add-modal" onSubmit={addItem} onClick={e=>e.stopPropagation()}><button type="button" className="modal-close" onClick={()=>setShowAdd(false)}><X size={19}/></button><div className="eyebrow blush">UNA NUEVA FAVORITA</div><h2>Añade una prenda</h2><p className="modal-sub">Vamos haciendo sitio a todo lo que te gusta.</p><label className="upload-zone"><Upload size={22}/><span>Sube una foto</span><small>JPG, PNG · máximo 10 MB</small><input type="file" name="photo" accept="image/*"/></label><label className="modal-label">¿Cómo se llama?<input name="name" placeholder="Ej. Camisa de lino" required/></label><div className="form-row"><label className="modal-label">Categoría<select name="category"><option>Prendas</option><option>Zapatos</option><option>Bolsos</option><option>Accesorios</option></select></label><label className="modal-label">Color<input name="color" placeholder="Ej. Azul cielo"/></label></div><label className="modal-label">Marca <span className="optional">(opcional)</span><input name="brand" placeholder="Ej. COS"/></label><button className="generate-button modal-submit"><Plus size={17}/> Añadir a mi armario</button></form></div>}
    {showLogin&&<div className="modal-backdrop" onClick={()=>setShowLogin(false)}><form className="add-modal login-modal" onSubmit={sendMagicLink} onClick={e=>e.stopPropagation()}><button type="button" className="modal-close" onClick={()=>setShowLogin(false)}><X size={19}/></button><div className="eyebrow blush">TU ARMARIO, CONTIGO</div><h2>Guarda tus prendas</h2><p className="modal-sub">Entra con tu email y tendrás tu armario en todos tus dispositivos.</p>{supabase?<><label className="modal-label">Tu email<input type="email" value={loginEmail} onChange={e=>setLoginEmail(e.target.value)} placeholder="tu@email.com" required/></label><button className="generate-button modal-submit"><ArrowUpRight size={17}/> Enviarme un enlace de acceso</button></>:<><p className="login-setup">Para activar tu cuenta, añade la URL y la clave pública de Supabase en el archivo <code>.env</code>, ejecuta el esquema incluido y vuelve a abrir la app.</p><button type="button" className="generate-button modal-submit" onClick={()=>setShowLogin(false)}>Entendido</button></>}</form></div>}
  </div>
}

createRoot(document.getElementById('root')).render(<App />)
