import React, { useEffect, useMemo, useRef, useState } from 'react'
import { createRoot } from 'react-dom/client'
import {
  ArrowDownUp, ArrowRight, Check, Cloud, CloudSun, Compass, Download, Heart, LayoutGrid, LoaderCircle, LogIn,
  MapPin, LogOut, Menu, Plus, Search, Shirt, Sparkles, Thermometer, Trash2, Upload, UserRound, X,
} from 'lucide-react'
import './styles.css'
import InspirationPhotoCarousel from './components/InspirationPhotoCarousel.jsx'
import InspirationRating from './components/InspirationRating.jsx'
import { categories, itemTypes, singleWearAccessories, defaultSubcategory, occasions, subtypeStyleProfiles, styleDimensions } from './data/catalog.js'
import { inspirationMoments } from './data/inspiration.js'
import { seasonForLatitude, weatherDescription, cityFromCoordinates } from './lib/weather.js'
import { localItemsKey, localLooksKey, feedbackStorageKey, readFeedback, readLocal, readLocalItems } from './lib/storage.js'
import { hasAuthCallback } from './lib/auth.js'
import { supabase } from './lib/supabase.js'
import { imageStoragePath, mapWardrobeRow } from './lib/wardrobe.js'
import { callAiEndpoint } from './lib/ai.js'
import { MAX_PHOTO_SIZE, toOptimizedPhoto, toDataUrl } from './lib/photos.js'
import { shuffle, normalizeMatchText, getStyleContext, colorFamiliesFor, colorToneFor, colorPairKey, buildRatedColorPreferences, paletteHarmonyScore, shortlistAiCandidates, compactAiItem } from './lib/outfitScoring.js'

function App() {
  const [page, setPage] = useState('generate')
  const [items, setItems] = useState([])
  const [looks, setLooks] = useState([])
  const [feedback, setFeedback] = useState(() => readFeedback())
  const [feedCards, setFeedCards] = useState([])
  const [feedLoading, setFeedLoading] = useState(false)
  const [savingFeedCardId, setSavingFeedCardId] = useState(null)
  const feedContainerRef = useRef(null)
  const previousPageRef = useRef(page)
  const previousFeedLengthRef = useRef(0)
  const [session, setSession] = useState(null)
  const [authReady, setAuthReady] = useState(!supabase)
  const [dataReady, setDataReady] = useState(false)
  const [cloudMode, setCloudMode] = useState(false)
  const [busy, setBusy] = useState(false)
  const [generateCooldown, setGenerateCooldown] = useState(0)
  const generationLockRef = useRef(false)
  const [notice, setNotice] = useState('')
  const [mobileMenu, setMobileMenu] = useState(false)
  const [showEditor, setShowEditor] = useState(false)
  const [editingItem, setEditingItem] = useState(null)
  const [editorCategory, setEditorCategory] = useState('Parte de arriba')
  const [editorSubcategory, setEditorSubcategory] = useState(defaultSubcategory('Parte de arriba'))
  const [photoPreview, setPhotoPreview] = useState('')
  const [photoName, setPhotoName] = useState('')
  const [showLogin, setShowLogin] = useState(false)
  const [loginLinkSent, setLoginLinkSent] = useState(false)
  const [loginBusy, setLoginBusy] = useState(false)
  const [authMode, setAuthMode] = useState('login')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [installPrompt, setInstallPrompt] = useState(null)
  const [showAuthCallback, setShowAuthCallback] = useState(hasAuthCallback)
  const [authCallbackStatus, setAuthCallbackStatus] = useState('processing')
  const [authCallbackError, setAuthCallbackError] = useState('')
  const [email, setEmail] = useState('')
  const [category, setCategory] = useState('Todas')
  const [search, setSearch] = useState('')
  const [sort, setSort] = useState('newest')
  const [occasion, setOccasion] = useState('Diario')
  const [mood, setMood] = useState('Cómoda')
  const [currentLook, setCurrentLook] = useState([])
  const [currentWeather, setCurrentWeather] = useState(null)
  const [weatherLoading, setWeatherLoading] = useState(false)

  const flash = message => { setNotice(message); window.setTimeout(() => setNotice(''), 3200) }

  const enableLocalWeather = () => {
    if (!navigator.geolocation) { flash('Este navegador no permite obtener la ubicación.'); return }
    setWeatherLoading(true)
    navigator.geolocation.getCurrentPosition(async ({ coords }) => {
      try {
        const params = new URLSearchParams({ latitude: String(coords.latitude), longitude: String(coords.longitude), current: 'temperature_2m,apparent_temperature,weather_code', timezone: 'auto' })
        const [response, location] = await Promise.all([
          fetch(`https://api.open-meteo.com/v1/forecast?${params}`),
          cityFromCoordinates(coords),
        ])
        if (!response.ok) throw new Error('No se pudo consultar el tiempo local.')
        const result = await response.json()
        const timezone = result.timezone || ''
        const city = location || 'Ubicación actual'
        setCurrentWeather({
          temperatureC: Math.round(result.current.temperature_2m),
          apparentTemperatureC: Math.round(result.current.apparent_temperature),
          weatherCode: result.current.weather_code,
          description: weatherDescription(result.current.weather_code),
          timezone,
          location: city,
          season: seasonForLatitude(coords.latitude, result.current.time),
        })
        flash(`Tiempo actualizado para ${city}.`)
      } catch (error) { flash(error.message || 'No se pudo consultar el tiempo local.') }
      finally { setWeatherLoading(false) }
    }, error => {
      setWeatherLoading(false)
      flash(error.code === 1 ? 'Permite la ubicación en Safari para adaptar tus outfits al tiempo local.' : 'No se pudo obtener la ubicación. Inténtalo de nuevo.')
    }, { enableHighAccuracy: true, timeout: 30000, maximumAge: 0 })
  }

  const outfitSituation = (context = {}) => ({
    occasion: context.occasion ?? occasion,
    mood: context.mood ?? mood,
    temperatureC: context.temperatureC ?? currentWeather?.temperatureC ?? null,
    apparentTemperatureC: context.apparentTemperatureC ?? currentWeather?.apparentTemperatureC ?? null,
    season: context.season ?? currentWeather?.season ?? seasonForLatitude(null),
    weather: context.weather ?? currentWeather?.description ?? '',
    location: context.location ?? currentWeather?.location ?? '',
    timezone: context.timezone ?? currentWeather?.timezone ?? '',
  })

  useEffect(() => () => { if (photoPreview) URL.revokeObjectURL(photoPreview) }, [photoPreview])

  useEffect(() => {
    if (generateCooldown <= 0) return undefined
    const timer = window.setTimeout(() => setGenerateCooldown(seconds => Math.max(0, seconds - 1)), 1000)
    return () => window.clearTimeout(timer)
  }, [generateCooldown])

  useEffect(() => {
    if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(() => {})
    const captureInstall = event => { event.preventDefault(); setInstallPrompt(event) }
    const installed = () => setInstallPrompt(null)
    window.addEventListener('beforeinstallprompt', captureInstall)
    window.addEventListener('appinstalled', installed)
    return () => {
      window.removeEventListener('beforeinstallprompt', captureInstall)
      window.removeEventListener('appinstalled', installed)
    }
  }, [])

  useEffect(() => {
    if (!supabase) {
      setItems(readLocalItems())
      setLooks(readLocal(localLooksKey))
      setFeedback(readFeedback())
      setDataReady(true)
      if (hasAuthCallback()) {
        setAuthCallbackError('Falta conectar Supabase para validar el enlace de acceso.')
        setAuthCallbackStatus('error')
      }
      return
    }
    let alive = true
    const { data: listener } = supabase.auth.onAuthStateChange((event, nextSession) => {
      setSession(nextSession)
      setAuthReady(true)
      if (event === 'PASSWORD_RECOVERY') {
        setAuthMode('update-password')
        setPassword('')
        setConfirmPassword('')
        setShowLogin(true)
        setShowAuthCallback(false)
      }
    })
    const finishAuthCallback = async () => {
      const url = new URL(window.location.href)
      const params = url.searchParams
      const hash = new URLSearchParams(url.hash.slice(1))
      const callbackPresent = hasAuthCallback()
      const errorMessage = params.get('error_description') || hash.get('error_description')
        || params.get('error') || hash.get('error') || params.get('error_code') || hash.get('error_code')
      if (errorMessage) {
        if (alive) {
          setAuthCallbackError(errorMessage)
          setAuthCallbackStatus('error')
          setAuthReady(true)
        }
        window.history.replaceState({}, document.title, url.pathname)
        return
      }

      const tokenHash = params.get('token_hash')
      if (tokenHash) {
        const linkType = params.get('type')
        const allowedTypes = ['email', 'magiclink', 'signup', 'invite', 'recovery', 'email_change']
        if (!linkType || !allowedTypes.includes(linkType)) {
          if (alive) { setAuthCallbackError('El enlace de acceso no tiene un tipo válido.'); setAuthCallbackStatus('error'); setAuthReady(true) }
          window.history.replaceState({}, document.title, url.pathname)
          return
        }
        const { data, error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type: linkType })
        if (!alive) return
        if (error || !data?.session) {
          setAuthCallbackError(error?.message || 'No se pudo confirmar el enlace. Pide uno nuevo e inténtalo otra vez.')
          setAuthCallbackStatus('error')
        } else {
          setSession(data.session)
          setAuthCallbackStatus('success')
        }
        setAuthReady(true)
        window.history.replaceState({}, document.title, url.pathname)
        return
      }

      const { data, error } = await supabase.auth.getSession()
      if (!alive) return
      setSession(data?.session || null)
      if (callbackPresent) {
        if (error || !data?.session) {
          setAuthCallbackError(error?.message || 'No se encontró una sesión activa. El enlace puede haber caducado; solicita uno nuevo.')
          setAuthCallbackStatus('error')
        } else setAuthCallbackStatus('success')
        window.history.replaceState({}, document.title, url.pathname)
      }
      setAuthReady(true)
    }
    finishAuthCallback().catch(error => {
      if (!alive) return
      setAuthCallbackError(error?.message || 'No se pudo completar el inicio de sesión.')
      setAuthCallbackStatus('error')
      setAuthReady(true)
      if (hasAuthCallback()) window.history.replaceState({}, document.title, window.location.pathname)
    })
    return () => { alive = false; listener.subscription.unsubscribe() }
  }, [])

  useEffect(() => {
    if (!authReady) return
    let alive = true
    if (!supabase || !session?.user || session.user.id === '__local_test__') {
      setCloudMode(false)
      setBusy(false)
      setItems(readLocalItems())
      setLooks(readLocal(localLooksKey))
      setFeedback(readFeedback(session?.user?.id))
      setDataReady(true)
      return () => { alive = false }
    }
    setDataReady(false)
    setBusy(true)
    Promise.all([
      supabase.from('wardrobe_items').select('*').order('created_at', { ascending: false }),
      supabase.from('saved_outfits').select('*').order('created_at', { ascending: false }),
      supabase.from('outfit_feedback').select('*').order('created_at', { ascending: false }),
    ]).then(async ([wardrobeResult, looksResult, feedbackResult]) => {
      if (!alive) return
      if (wardrobeResult.error) throw wardrobeResult.error
      if (looksResult.error) throw looksResult.error
      const cloudItems = await Promise.all((wardrobeResult.data || []).map(mapWardrobeRow))
      const itemsById = new Map(cloudItems.map(item => [String(item.id), item]))
      setItems(cloudItems)
      setLooks((looksResult.data || []).map(row => ({
        id: row.id, name: row.name, occasion: row.occasion || '', mood: row.mood || '',
        createdAt: row.created_at, items: (row.item_ids || []).map(id => itemsById.get(String(id))).filter(Boolean),
      })))
      setFeedback(feedbackResult.error ? readFeedback(session.user.id) : (feedbackResult.data || []))
      setCloudMode(true)
      setDataReady(true)
    }).catch(error => {
      if (alive) {
        setCloudMode(false)
        setItems(readLocalItems())
        setLooks(readLocal(localLooksKey))
        setDataReady(true)
        flash(`No se pudieron cargar tus datos de Supabase. Se abre el armario local: ${error.message || 'revisa la configuración'}`)
      }
    }).finally(() => { if (alive) setBusy(false) })
    return () => { alive = false }
  }, [authReady, session?.user?.id])

  useEffect(() => {
    if (!dataReady || cloudMode) return
    try {
      localStorage.setItem(localItemsKey, JSON.stringify(items))
      localStorage.setItem(localLooksKey, JSON.stringify(looks))
    } catch { flash('No hay espacio local suficiente. Elimina alguna foto o conecta Supabase para sincronizar.') }
  }, [items, looks, dataReady, cloudMode])

  useEffect(() => {
    try { localStorage.setItem(feedbackStorageKey(session?.user?.id), JSON.stringify(feedback)) } catch {}
  }, [feedback, session?.user?.id])

  useEffect(() => {
    const feed = feedContainerRef.current
    if (previousPageRef.current !== page) {
      window.scrollTo(0, 0)
      document.scrollingElement?.scrollTo(0, 0)
      feed?.scrollTo(0, 0)
    } else if (page === 'inspiration' && window.matchMedia('(min-width: 561px)').matches
      && feed && feedCards.length > previousFeedLengthRef.current) {
      feed.scrollTo({ top: feed.scrollHeight, behavior: 'smooth' })
    }
    previousPageRef.current = page
    previousFeedLengthRef.current = feedCards.length
  }, [feedCards.length, page])

  useEffect(() => {
    if (page !== 'inspiration' || feedCards.length !== 1 || feedLoading || !window.matchMedia('(max-width: 560px)').matches) return undefined
    const timer = window.setTimeout(() => loadInspirationCard(), 350)
    return () => window.clearTimeout(timer)
  }, [page, feedCards.length, feedLoading, items.length])

  const filteredItems = useMemo(() => {
    const needle = search.trim().toLocaleLowerCase('es')
    const result = items.filter(item => (category === 'Todas' || item.category === category)
      && `${item.name} ${item.subcategory || ''} ${item.color} ${item.brand}`.toLocaleLowerCase('es').includes(needle))
    return result.sort((a, b) => sort === 'name'
      ? a.name.localeCompare(b.name, 'es')
      : sort === 'category'
        ? a.category.localeCompare(b.category, 'es') || a.name.localeCompare(b.name, 'es')
        : new Date(b.createdAt || 0) - new Date(a.createdAt || 0))
  }, [items, category, search, sort])

  const chooseRandomItems = (context = {}) => {
    const situation = outfitSituation(context)
    const styleContext = getStyleContext(situation)
    const colorPreferences = buildRatedColorPreferences(feedbackForAI(), situation)
    const selected = []
    const scoreItem = (item, withItems = selected) => {
      const attrs = item.aiAttributes || {}
      const seasons = (attrs.seasons || []).map(normalizeMatchText)
      let score = seasons.includes(normalizeMatchText(situation.season)) ? 3 : 0
      if (Number.isFinite(Number(situation.temperatureC)) && seasons.length) {
        const expected = Number(situation.temperatureC) < 10 ? 'invierno' : Number(situation.temperatureC) > 25 ? 'verano' : ''
        if (expected && seasons.includes(expected)) score += 2
      }
      const profile = subtypeStyleProfiles[item.category]?.[item.subcategory]
      if (profile) score += styleDimensions.reduce((total, dimension) => total + (styleContext[dimension] || 0) * (profile[dimension] || 0), 0) * 2
      const thermalValue = situation.apparentTemperatureC ?? situation.temperatureC
      const thermalFeel = thermalValue === null || thermalValue === undefined || thermalValue === '' ? NaN : Number(thermalValue)
      if (item.category === 'Ropa de abrigo' && Number.isFinite(thermalFeel)) {
        const subtype = item.subcategory || ''
        const heavy = ['Abrigo', 'Gabardina'].includes(subtype)
        const light = ['Blazer', 'Chaleco'].includes(subtype)
        if (thermalFeel <= 7) score += heavy ? 7 : ['Chaqueta', 'Cazadora'].includes(subtype) ? 3 : -2
        else if (thermalFeel <= 13) score += heavy ? 5 : ['Chaqueta', 'Cazadora', 'Gabardina'].includes(subtype) ? 4 : light ? 1 : 0
        else if (thermalFeel <= 18) score += ['Chaqueta', 'Cazadora', 'Gabardina', 'Blazer'].includes(subtype) ? 3 : heavy ? -1 : 1
        else if (thermalFeel <= 22) score += light ? 2 : ['Chaqueta', 'Cazadora'].includes(subtype) ? 1 : -2
        else score += -5
      }
      if ([51, 53, 55, 61, 63, 65, 80, 81, 82, 95, 96, 99].includes(currentWeather?.weatherCode)) {
        if (['Botas', 'Botines'].includes(item.subcategory)) score += 1.5
        if (['Sandalias', 'Chanclas'].includes(item.subcategory)) score -= 2
        if (item.category === 'Ropa de abrigo') score += ['Gabardina', 'Abrigo', 'Chaqueta'].includes(item.subcategory) ? 2 : 0.5
      }
      const families = colorFamiliesFor(item)
      score += families.reduce((total, family) => total + (colorPreferences.families.get(family) || 0) * 0.8, 0)
      const relations = withItems.flatMap(chosen => colorFamiliesFor(chosen).flatMap(chosenFamily => families.map(family => ({
        chosenFamily, family, chosenTone: colorToneFor(chosen), tone: colorToneFor(item),
      }))))
      if (relations.length) {
        score += relations.reduce((total, pair) => total + paletteHarmonyScore(pair.chosenFamily, pair.family, pair.chosenTone, pair.tone), 0) / relations.length * 2.2
        score += relations.reduce((total, pair) => total + (colorPreferences.pairs.get(colorPairKey(pair.chosenFamily, pair.family)) || 0), 0) / relations.length * 2.1
      }
      return score
    }
    const pick = (group, withItems = selected) => {
      const ranked = shuffle(items.filter(item => item.category === group).map(item => ({ item, score: scoreItem(item, withItems) })))
        .sort((a, b) => b.score - a.score).slice(0, 5)
      if (!ranked.length) return undefined
      const weights = ranked.map(entry => Math.exp((entry.score - ranked[0].score) / 3))
      let point = Math.random() * weights.reduce((sum, weight) => sum + weight, 0)
      for (let index = 0; index < ranked.length; index += 1) {
        point -= weights[index]
        if (point <= 0) return ranked[index].item
      }
      return ranked.at(-1).item
    }
    const fullBody = pick('Cuerpo completo', [])
    const hasTopAndBottom = items.some(item => item.category === 'Parte de arriba') && items.some(item => item.category === 'Parte de abajo')
    if (fullBody && (!hasTopAndBottom || Math.random() < 0.5)) selected.push(fullBody)
    else {
      const top = pick('Parte de arriba', [])
      if (!top) throw new Error('Para crear un outfit necesitas una parte de arriba y una de abajo, o una prenda de cuerpo completo.')
      const bottom = pick('Parte de abajo', [top])
      if (!bottom) throw new Error('Para crear un outfit necesitas una parte de arriba y una de abajo, o una prenda de cuerpo completo.')
      selected.push(top, bottom)
    }
    const thermalValue = situation.apparentTemperatureC ?? situation.temperatureC
    const thermalFeel = thermalValue === null || thermalValue === undefined || thermalValue === '' ? NaN : Number(thermalValue)
    const rainOrSnow = [51, 53, 55, 61, 63, 65, 71, 73, 75, 77, 80, 81, 82, 85, 86].includes(currentWeather?.weatherCode)
    const layerChance = Number.isFinite(thermalFeel)
      ? thermalFeel <= 7 ? 0.98 : thermalFeel <= 13 ? 0.9 : thermalFeel <= 18 ? 0.65 : thermalFeel <= 22 ? 0.25 : 0.03
      : 0.25
    if (items.some(item => item.category === 'Ropa de abrigo') && (Math.random() < layerChance || (rainOrSnow && (!Number.isFinite(thermalFeel) || thermalFeel <= 24)))) {
      const outerwear = pick('Ropa de abrigo', selected)
      if (outerwear) selected.push(outerwear)
    }
    const shoes = pick('Calzado', selected)
    if (!shoes) throw new Error('Añade al menos un calzado a tu armario para completar el outfit.')
    selected.push(shoes)
    const bag = pick('Bolsos', selected)
    if (bag && Math.random() < 0.55) selected.push(bag)
    const accessories = shuffle(items.filter(item => item.category === 'Accesorios')
      .map(item => ({ item, score: scoreItem(item, selected) })))
      .sort((first, second) => second.score - first.score).map(entry => entry.item)
    const accessoryCounts = new Map()
    for (const accessory of accessories) {
      if (selected.length >= 9) break
      const subtype = accessory.subcategory || 'Otros'
      const count = accessoryCounts.get(subtype) || 0
      if (singleWearAccessories.has(subtype) && count >= 1) continue
      if (Math.random() < 0.55) {
        selected.push(accessory)
        accessoryCounts.set(subtype, count + 1)
      }
    }
    return selected
  }

  const feedbackForAI = () => feedback.slice(0, 100).map(row => ({
    occasion: row.occasion || '', mood: row.mood || '', temperatureC: row.temperature_c ?? row.temperatureC ?? null,
    season: row.season || '', rating: row.rating,
    outfit: (row.outfit_snapshot || row.outfitSnapshot || []).map(item => ({
      name: item.name || '', category: item.category || '', subcategory: item.subcategory || '', color: item.color || item.attributes?.color || '',
      style: item.attributes?.style || '', pattern: item.attributes?.pattern || '', formality: item.attributes?.formality || '',
      seasons: item.attributes?.seasons || [],
    })),
  }))

  const recommendOutfitWithAI = async situation => {
    situation = outfitSituation(situation)
    const inventory = items.map(compactAiItem)
    const feedback = feedbackForAI()
    const resolveIds = data => (Array.isArray(data.itemIds) ? data.itemIds : [])
      .map(String).map(id => items.find(item => String(item.id) === id)).filter(Boolean)
    if (inventory.length <= 50) {
      const data = await callAiEndpoint('recommend-outfit', {
        stage: 'complete', inventory, selectedItems: [],
        occasion: situation.occasion, mood: situation.mood,
        temperatureC: situation.temperatureC, apparentTemperatureC: situation.apparentTemperatureC,
        season: situation.season, weather: situation.weather, location: situation.location, timezone: situation.timezone, feedback,
      })
      return { items: resolveIds(data), reason: data.reason || '' }
    }
    const selected = []
    const reasons = []
    const chooseStage = async (stage, allowedCategories, optional = false) => {
      const allCandidates = inventory.filter(item => allowedCategories.includes(item.category))
      if (!allCandidates.length && optional) return []
      if (!allCandidates.length) throw new Error('No hay prendas disponibles para completar este outfit.')
      const candidates = shortlistAiCandidates(allCandidates, stage, situation, selected, feedback)
      const data = await callAiEndpoint('recommend-outfit', {
        stage, inventory: candidates, selectedItems: selected.map(compactAiItem),
        occasion: situation.occasion, mood: situation.mood,
        temperatureC: situation.temperatureC, apparentTemperatureC: situation.apparentTemperatureC,
        season: situation.season, weather: situation.weather, location: situation.location, timezone: situation.timezone,
        feedback,
      })
      const candidateIds = new Set(candidates.map(item => item.id))
      const stageItems = [...new Set((Array.isArray(data.itemIds) ? data.itemIds : []).map(String))]
        .filter(id => candidateIds.has(id))
        .map(id => candidates.find(item => item.id === id)).filter(Boolean)
      if (!stageItems.length && !optional) throw new Error('Groq no eligió una prenda válida. Inténtalo de nuevo.')
      selected.push(...stageItems)
      if (data.reason) reasons.push(data.reason)
      return stageItems
    }

    const base = await chooseStage('base', ['Parte de arriba', 'Cuerpo completo'])
    if (base[0].category === 'Parte de arriba') await chooseStage('bottom', ['Parte de abajo'])
    await chooseStage('outerwear', ['Ropa de abrigo'], true)
    await chooseStage('footwear', ['Calzado'])
    await chooseStage('extras', ['Bolsos', 'Accesorios'], true)
    return { items: resolveIds({ itemIds: selected.map(item => item.id) }), reason: reasons.join(' ') }
  }

  const generateLook = async () => {
    if (!items.length) { flash('Añade algunas prendas para crear tu primer look.'); return }
    if (cloudMode && session?.user) {
      if (generationLockRef.current || generateCooldown > 0) return
      generationLockRef.current = true
      setBusy(true)
      try {
        const situation = outfitSituation()
        const result = await recommendOutfitWithAI(situation)
        if (!result.items.length) throw new Error('La IA no devolvió prendas válidas. Inténtalo otra vez.')
        setCurrentLook(result.items)
        return
      } catch (error) {
        flash(`No se pudo crear el outfit con IA: ${error.message || 'comprueba la configuración de Groq y Supabase.'}`)
        return
      } finally {
        setBusy(false)
        generationLockRef.current = false
        setGenerateCooldown(25)
      }
    }
    try { setCurrentLook(chooseRandomItems(outfitSituation())) }
    catch (error) { flash(error.message || 'No se pudo completar el outfit.') }
  }

  const loadInspirationCard = async () => {
    if (!items.length) { flash('Añade prendas a tu armario para descubrir outfits.'); return }
    if (feedLoading) return
    setFeedLoading(true)
    try {
      const recent = new Set(feedCards.slice(-3).map(card => `${card.occasion}|${card.season}`))
      const moments = inspirationMoments.filter(moment => !recent.has(`${moment.occasion}|${moment.season}`))
      const moment = shuffle(moments.length ? moments : inspirationMoments)[0]
      const situation = outfitSituation(moment)
      const selected = chooseRandomItems(situation)
      const reason = currentWeather ? `Combinación adaptada al tiempo actual de ${currentWeather.location}.` : 'Combinación aleatoria de tu armario para este momento.'
      if (!selected?.length) throw new Error('No se encontró un outfit con prendas válidas.')
      setFeedCards(previous => [...previous, {
        id: crypto.randomUUID(), ...moment, ...situation, items: selected, reason, rating: null, createdAt: new Date().toISOString(),
      }])
    } catch (error) {
      flash(`No se pudo crear el outfit: ${error.message || 'inténtalo de nuevo.'}`)
    } finally { setFeedLoading(false) }
  }

  const rateInspirationCard = async (card, rating) => {
    const createdAt = new Date().toISOString()
    const outfitSnapshot = card.items.map(item => ({
      id: String(item.id), name: item.name, category: item.category, subcategory: item.subcategory || '',
      color: item.color || '', description: item.description || '', attributes: item.aiAttributes || {},
    }))
    const row = {
      id: card.id, occasion: card.occasion, mood: card.mood, temperature_c: card.temperatureC,
      season: card.season, rating, outfit_snapshot: outfitSnapshot, created_at: createdAt,
    }
    if (cloudMode && session?.user) {
      const { error } = await supabase.from('outfit_feedback').upsert({ ...row, user_id: session.user.id }, { onConflict: 'id' })
      if (error) flash('Puntuación guardada en este dispositivo. Ejecuta supabase/schema.sql para sincronizarla.')
      else flash('Valoración guardada; ayudará a personalizar tus próximos outfits.')
    } else flash('Valoración guardada en este dispositivo.')
    setFeedback(previous => [row, ...previous.filter(entry => entry.id !== card.id)])
    setFeedCards(previous => previous.map(entry => entry.id === card.id ? { ...entry, rating } : entry))
  }

  const saveLookItems = async (lookItems, lookOccasion, lookMood, name = `${lookOccasion} · ${new Date().toLocaleDateString('es-ES')}`) => {
    if (!lookItems.length) return false
    const look = {
      id: crypto.randomUUID(), name, occasion: lookOccasion, mood: lookMood,
      items: lookItems, createdAt: new Date().toISOString(),
    }
    if (cloudMode && session?.user) {
      const { data, error } = await supabase.from('saved_outfits').insert({
        user_id: session.user.id, name: look.name, occasion: lookOccasion, mood: lookMood,
        item_ids: lookItems.map(item => item.id),
      }).select().single()
      if (error) { flash(`No se pudo guardar el look: ${error.message}`); return false }
      look.id = data.id
    }
    setLooks(previous => [look, ...previous])
    flash('Look guardado.')
    return true
  }

  const saveLook = () => saveLookItems(currentLook, occasion, mood)

  const saveInspirationLook = async card => {
    if (card.saved || savingFeedCardId) return
    setSavingFeedCardId(card.id)
    try {
      const name = `${card.occasion} · ${card.season} · ${card.temperatureC}°C`
      const saved = await saveLookItems(card.items, card.occasion, card.mood, name)
      if (saved) setFeedCards(previous => previous.map(entry => entry.id === card.id ? { ...entry, saved: true } : entry))
    } catch (error) { flash(`No se pudo guardar el look: ${error.message || 'inténtalo de nuevo.'}`) }
    finally { setSavingFeedCardId(null) }
  }

  const removeLook = async look => {
    if (cloudMode) {
      const { error } = await supabase.from('saved_outfits').delete().eq('id', look.id)
      if (error) { flash(`No se pudo eliminar el look: ${error.message}`); return }
    }
    setLooks(previous => previous.filter(entry => entry.id !== look.id))
    flash('Look eliminado.')
  }

  const persistItem = async (form, file) => {
    const name = String(form.get('name') || '').trim()
    const itemCategory = String(form.get('category') || '')
    const itemSubcategory = itemTypes[itemCategory] ? String(form.get('subcategory') || '') : ''
    if (!name || !categories.includes(itemCategory)) throw new Error('Completa el nombre y elige una categoría válida.')
    const availableTypes = itemTypes[itemCategory] || []
    if (availableTypes.length && !availableTypes.includes(itemSubcategory)) throw new Error('Elige un tipo válido.')
    let image = editingItem?.image || ''
    let imagePath = editingItem?.imagePath || ''
    let description = String(form.get('description') || editingItem?.description || '').trim()
    let aiAttributes = editingItem?.aiAttributes || {}
    let aiColor = ''
    if (file?.size) {
      if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) throw new Error('Usa una imagen JPG, PNG o WebP.')
      if (file.size > MAX_PHOTO_SIZE) throw new Error('La imagen no puede superar los 10 MB.')
      const optimizedPhoto = await toOptimizedPhoto(file)
      if (cloudMode && session?.user) {
        const dataUrl = await toDataUrl(optimizedPhoto)
        const imageBase64 = String(dataUrl).split(',')[1]
        const data = await callAiEndpoint('describe-garment', {
          imageBase64, mimeType: 'image/jpeg', category: itemCategory, subcategory: itemSubcategory, name,
          color: String(form.get('color') || '').trim(), brand: String(form.get('brand') || '').trim(), description,
        })
        description = data.description || description
        aiAttributes = data.attributes || aiAttributes
        aiColor = data.color || ''
      }
      if (cloudMode && session?.user) {
        const path = `${session.user.id}/${crypto.randomUUID()}.jpg`
        const { error: uploadError } = await supabase.storage.from('wardrobe-photos').upload(path, optimizedPhoto, { upsert: false, contentType: 'image/jpeg', cacheControl: '31536000' })
        if (uploadError) throw uploadError
        imagePath = path
        const { data: signedData, error: signedError } = await supabase.storage.from('wardrobe-photos').createSignedUrl(path, 60 * 60 * 24)
        if (signedError) {
          await supabase.storage.from('wardrobe-photos').remove([path])
          if (/object not found/i.test(signedError.message || '')) {
            const details = [signedError.status && `HTTP ${signedError.status}`, signedError.code, signedError.message]
              .filter(Boolean).join(' · ')
            throw new Error(`Supabase no encuentra la foto o no permite leerla. Comprueba que la app apunta al proyecto donde ejecutaste supabase/schema.sql, que existe el bucket privado “wardrobe-photos” y que la política de lectura permite la carpeta de tu usuario.${details ? ` Detalle: ${details}` : ''}`)
          }
          throw signedError
        }
        image = signedData.signedUrl
      } else image = await toDataUrl(optimizedPhoto)
    }
    const inferenceInputsChanged = editingItem && (
      itemCategory !== editingItem.category || itemSubcategory !== (editingItem.subcategory || '') ||
      name !== editingItem.name || String(form.get('color') || '').trim() !== (editingItem.color || '') ||
      String(form.get('brand') || '').trim() !== (editingItem.brand || '') || description !== (editingItem.description || '')
    )
    if (cloudMode && session?.user && !file?.size && (!editingItem || !Object.keys(editingItem.aiAttributes || {}).length || inferenceInputsChanged)) {
      const data = await callAiEndpoint('describe-garment', {
        category: itemCategory, subcategory: itemSubcategory, name,
        color: String(form.get('color') || '').trim(), brand: String(form.get('brand') || '').trim(), description,
      })
      description = data.description || description
      aiAttributes = data.attributes || aiAttributes
      aiColor = data.color || ''
    }
    const record = {
      name, category: itemCategory, subcategory: itemSubcategory, description, aiAttributes,
      color: String(form.get('color') || '').trim() || aiColor,
      brand: String(form.get('brand') || '').trim(), image,
    }
    if (cloudMode && session?.user) {
      const payload = { name: record.name, category: record.category, subcategory: record.subcategory || null, description: record.description || null, ai_attributes: record.aiAttributes || {}, color: record.color, brand: record.brand, image_url: imagePath }
      if (editingItem) {
        const { data, error } = await supabase.from('wardrobe_items').update(payload).eq('id', editingItem.id).select().single()
        if (error) throw error
        const updatedItem = await mapWardrobeRow(data)
        setItems(previous => previous.map(item => item.id === editingItem.id ? updatedItem : item))
        setLooks(previous => previous.map(look => ({ ...look, items: look.items.map(item => item.id === updatedItem.id ? updatedItem : item) })))
        setCurrentLook(previous => previous.map(item => item.id === updatedItem.id ? updatedItem : item))
        if (file?.size && editingItem.imagePath && editingItem.imagePath !== imagePath) {
          await supabase.storage.from('wardrobe-photos').remove([editingItem.imagePath])
        }
      } else {
        const { data, error } = await supabase.from('wardrobe_items').insert({ ...payload, user_id: session.user.id }).select().single()
        if (error) throw error
        const insertedItem = await mapWardrobeRow(data)
        setItems(previous => [insertedItem, ...previous])
      }
    } else if (editingItem) {
      const updated = { ...editingItem, ...record }
      setItems(previous => previous.map(item => item.id === editingItem.id ? updated : item))
      setLooks(previous => previous.map(look => ({ ...look, items: look.items.map(item => item.id === updated.id ? updated : item) })))
      setCurrentLook(previous => previous.map(item => item.id === updated.id ? updated : item))
    } else setItems(previous => [{ ...record, id: crypto.randomUUID(), createdAt: new Date().toISOString() }, ...previous])
  }

  const deleteItem = async item => {
    if (!window.confirm(`¿Eliminar “${item.name}” del armario?`)) return
    let warning = ''
    if (cloudMode) {
      const { error } = await supabase.from('wardrobe_items').delete().eq('id', item.id)
      if (error) { flash(`No se pudo eliminar: ${error.message}`); return }
      const affectedLooks = looks.filter(look => look.items.some(entry => entry.id === item.id))
      for (const look of affectedLooks) {
        const remaining = look.items.filter(entry => entry.id !== item.id)
        const query = remaining.length
          ? supabase.from('saved_outfits').update({ item_ids: remaining.map(entry => entry.id) }).eq('id', look.id)
          : supabase.from('saved_outfits').delete().eq('id', look.id)
        const { error: updateError } = await query
        if (updateError) { warning = `Prenda eliminada, pero no se actualizaron todos los looks: ${updateError.message}`; break }
      }
      const imagePath = item.imagePath || imageStoragePath(item.image)
      if (imagePath && !imagePath.startsWith('http') && !imagePath.startsWith('data:')) {
        const { error: storageError } = await supabase.storage.from('wardrobe-photos').remove([imagePath])
        if (storageError) warning = `Prenda eliminada, pero no se pudo borrar su foto: ${storageError.message}`
      }
    }
    setItems(previous => previous.filter(entry => entry.id !== item.id))
    setCurrentLook(previous => previous.filter(entry => entry.id !== item.id))
    setLooks(previous => previous.map(look => ({ ...look, items: look.items.filter(entry => entry.id !== item.id) })).filter(look => look.items.length))
    flash(warning || 'Prenda eliminada.')
  }

  const submitAuth = async event => {
    event.preventDefault()
    if (import.meta.env.DEV && authMode === 'login') {
      const testEmail = email.trim()
      if (!testEmail) return
      setSession({ user: { id: '__local_test__', email: testEmail } })
      setShowLogin(false)
      setLoginLinkSent(false)
      flash('Acceso de prueba activado. Los datos se guardan solo en este dispositivo.')
      return
    }
    if (!supabase) return
    setLoginBusy(true)
    try {
      if (authMode === 'signup' || authMode === 'update-password') {
        if (password.length < 8) { flash('La contraseña debe tener al menos 8 caracteres.'); return }
        if (password !== confirmPassword) { flash('Las contraseñas no coinciden.'); return }
      }
      if (authMode === 'signup') {
        const { data, error } = await supabase.auth.signUp({ email: email.trim(), password, options: { emailRedirectTo: window.location.origin } })
        if (error) flash(`No se pudo crear la cuenta: ${error.message}`)
        else if (data.session) { setShowLogin(false); flash('Cuenta creada. Ya has iniciado sesión.') }
        else { setLoginLinkSent(true); flash('Cuenta creada. Confirma el correo para completar el registro.') }
      } else if (authMode === 'update-password') {
        const { error } = await supabase.auth.updateUser({ password })
        if (error) flash(`No se pudo guardar la contraseña: ${error.message}`)
        else { setShowLogin(false); setAuthMode('login'); flash('Contraseña actualizada. Ya puedes iniciar sesión con ella.') }
      } else if (authMode === 'recovery') {
        const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: window.location.origin })
        if (error) flash(`No se pudo enviar la recuperación: ${error.message}`)
        else setLoginLinkSent(true)
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
        if (error) flash(`No se pudo iniciar sesión: ${error.message}`)
        else { setShowLogin(false); setPassword(''); flash('Sesión iniciada.') }
      }
    } catch (error) {
      flash(error.message || 'Comprueba tu conexión e inténtalo de nuevo.')
    } finally {
      setLoginBusy(false)
    }
  }

  const exportWardrobe = () => {
    const blob = new Blob([JSON.stringify({ exportedAt: new Date().toISOString(), items, looks }, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url; anchor.download = 'outfit-check-copia.json'; anchor.click()
    window.setTimeout(() => URL.revokeObjectURL(url), 1000)
  }

  const installApp = async () => {
    if (!installPrompt) {
      flash(/iPhone|iPad|iPod/i.test(navigator.userAgent)
        ? 'En Safari, toca Compartir y elige “Añadir a pantalla de inicio”.'
        : 'Abre el menú del navegador y elige “Instalar Outfit Check” o “Añadir a pantalla de inicio”.')
      return
    }
    installPrompt.prompt()
    await installPrompt.userChoice
    setInstallPrompt(null)
  }

  const navItems = [
    { id: 'generate', label: 'Generar outfits', icon: Sparkles },
    { id: 'wardrobe', label: 'Mi armario', icon: LayoutGrid },
    { id: 'inspiration', label: 'Inspiración', icon: Compass },
    { id: 'looks', label: 'Mis looks', icon: Heart },
    { id: 'profile', label: 'Mi perfil', icon: UserRound },
  ]
  const title = navItems.find(item => item.id === page)?.label || 'Mi armario'

  return <div className="app-shell">
    <aside className={`sidebar ${mobileMenu ? 'mobile-open' : ''}`}>
      <a className="brand" href="#armario" onClick={event => { event.preventDefault(); setPage('generate'); setMobileMenu(false) }}><span className="brand-mark"><img src="/icons/outfit-check.svg" alt=""/></span><span>outfit check</span></a>
      <div className="nav-label">TU ESPACIO</div>
      {navItems.map(({ id, label, icon: Icon }) => <button key={id} className={`nav-item ${page === id ? 'active' : ''}`} onClick={() => { setPage(id); setMobileMenu(false); if (id === 'inspiration' && !feedCards.length) loadInspirationCard() }}><Icon size={18}/>{label}{id === 'wardrobe' && <span className="nav-count">{items.length}</span>}{id === 'looks' && <span className="nav-count">{looks.length}</span>}</button>)}
      <div className="side-note"><Sparkles size={17}/><p>Tu armario, tus planes, <b>tu próximo look.</b></p><button onClick={() => { setPage('generate'); setMobileMenu(false); generateLook() }}>Crear una combinación <ArrowRight size={14}/></button></div>
      <button className="profile-mini profile-button" onClick={() => { setPage('profile'); setMobileMenu(false) }}><span className="avatar">{session?.user?.email?.[0]?.toUpperCase() || 'O'}</span><span className="profile-copy"><b>{session?.user?.email || 'Tu espacio personal'}</b><small>{cloudMode ? 'Sincronizado con Supabase' : 'Guardado en este dispositivo'}</small></span><ArrowRight size={15}/></button>
    </aside>
    {mobileMenu && <button className="mobile-overlay" aria-label="Cerrar menú" onClick={() => setMobileMenu(false)}/>}
    <main className="main-area">
      <header className="topbar"><button className="mobile-menu-btn" onClick={() => setMobileMenu(true)} aria-label="Abrir menú"><Menu size={20}/></button><a className="mobile-brand" href="#armario" onClick={event => { event.preventDefault(); setPage('generate') }}><span className="brand-mark"><img src="/icons/outfit-check.svg" alt=""/></span><span>outfit check</span></a><div className="crumb">Mi espacio <span>/</span> <b>{title}</b></div><div className="top-right"><button className={`weather-pill${currentWeather ? ' has-weather' : ''}`} onClick={enableLocalWeather} disabled={weatherLoading} aria-label="Usar ubicación y temperatura local"><CloudSun size={17}/><span>{weatherLoading ? 'Buscando…' : currentWeather ? `${currentWeather.location} · ${currentWeather.temperatureC}°` : 'Tiempo local'}</span></button><span className={`sync-status ${cloudMode ? 'is-cloud' : ''}`}><Cloud size={15}/>{cloudMode ? 'Sincronizado' : 'Solo este dispositivo'}</span>{session ? <button className="top-login" onClick={() => setPage('profile')}><UserRound size={15}/>Mi cuenta</button> : <button className="top-login" onClick={() => { setLoginLinkSent(false); setEmail(''); setShowLogin(true) }}><LogIn size={15}/> Iniciar sesión</button>}<span className="top-avatar">{session?.user?.email?.[0]?.toUpperCase() || 'O'}</span></div></header>
      <div className="page-content">
        {page === 'generate' && <div className="generator-page">
          <section className="look-section">
            <div className="section-heading"><div><div className="eyebrow blush">EL EDITORIAL DE HOY</div><h1>Generar outfits</h1><p>Elige tu plan y tu mood; combinaremos prendas de tu armario con el tiempo de hoy.</p></div></div>
            <div className="builder-card"><div className="builder-controls">
              <button className={`weather-banner${currentWeather ? ' is-ready' : ''}`} onClick={enableLocalWeather} disabled={weatherLoading}><span className="weather-icon"><MapPin size={18}/></span><span className="weather-copy"><b>{weatherLoading ? 'Buscando el tiempo local…' : currentWeather ? `${currentWeather.location} · ${currentWeather.temperatureC}°` : 'Vestirse con el tiempo de hoy'}</b><small>{currentWeather ? `${currentWeather.description} · sensación ${currentWeather.apparentTemperatureC}° · ${currentWeather.season}` : 'Activa la ubicación para adaptar el look a tu ciudad'}</small></span><ArrowRight size={16}/></button>
              <p className="weather-privacy">Al activarlo, el dispositivo intenta obtener coordenadas precisas. Open-Meteo las usa para el tiempo y BigDataCloud para identificar la ciudad. La IA solo recibe la ciudad y el tiempo, no tus coordenadas.</p>
              <label className="field-label" htmlFor="occasion">Plan</label><select id="occasion" className="builder-select" value={occasion} onChange={event => setOccasion(event.target.value)}>{occasions.map(value => <option key={value}>{value}</option>)}</select>
              <label className="field-label" htmlFor="mood">Cómo quieres sentirte</label><input id="mood" className="builder-input" value={mood} onChange={event => setMood(event.target.value)} maxLength={60} placeholder="Cómoda, elegante, informal…"/>
              <button className="generate-button" disabled={!dataReady || !items.length || busy || (cloudMode && !!session?.user && generateCooldown > 0)} onClick={generateLook}><Sparkles size={17}/>{busy ? 'Pensando el outfit…' : cloudMode && session?.user && generateCooldown > 0 ? `Disponible en ${generateCooldown}s` : currentLook.length ? 'Probar otra combinación' : cloudMode ? 'Crear outfit con IA' : 'Crear una combinación'}</button>
            </div><div className="look-result">
              {currentLook.length ? <><div className="result-top"><span className="result-label"><span className="live-dot"/> COMBINACIÓN PARA {occasion.toLocaleUpperCase('es')}</span></div><div className="outfit-images">{currentLook.map(item => <div className="outfit-image" key={item.id}>{item.image ? <img src={item.image} alt={item.name}/> : <Shirt size={32}/>}<span>{item.name}</span></div>)}</div><div className="outfit-copy"><div><h3>{occasion}</h3><p>{mood || 'A tu estilo'} · {currentLook.length} {currentLook.length === 1 ? 'prenda' : 'prendas'}</p></div><button className="text-action" onClick={saveLook}><Heart size={15}/> Guardar</button></div></> : <div className="look-empty"><Sparkles size={25}/><b>{items.length ? 'Tu siguiente combinación aparecerá aquí' : 'Tu armario está listo para empezar'}</b><span>{items.length ? 'La app combinará las prendas que has añadido.' : 'Añade algunas prendas en Mi armario para empezar a crear outfits.'}</span>{!items.length && <button className="outline-button" onClick={() => setPage('wardrobe')}><LayoutGrid size={15}/> Ir a Mi armario</button>}</div>}
            </div></div>
          </section>
        </div>}

        {page === 'wardrobe' && <>
          <section className="welcome-row"><div><div className="eyebrow">TU ESPACIO, A TU MANERA</div><h1>Mi armario</h1><p>Organiza y edita tus prendas para tenerlas listas al crear nuevos outfits.</p></div><button className="primary-button" disabled={!dataReady || busy} onClick={() => { setEditingItem(null); setEditorCategory('Parte de arriba'); setEditorSubcategory(defaultSubcategory('Parte de arriba')); setShowEditor(true) }}><Plus size={17}/> Añadir prenda</button></section>
          <section className="wardrobe-section"><div className="wardrobe-heading"><div><div className="eyebrow blush">TUS PRENDAS</div><h2>Armario <span className="item-total">{items.length}</span></h2></div></div>
            <div className="wardrobe-toolbar"><div className="category-tabs"><button className={category === 'Todas' ? 'current' : ''} onClick={() => setCategory('Todas')}>Todas</button>{categories.map(value => <button key={value} className={category === value ? 'current' : ''} onClick={() => setCategory(value)}>{value}</button>)}</div><div className="toolbar-actions"><label className="search-box"><Search size={16}/><input value={search} onChange={event => setSearch(event.target.value)} placeholder="Buscar prendas" aria-label="Buscar prendas"/></label><label className="sort-box"><ArrowDownUp size={14}/><select value={sort} onChange={event => setSort(event.target.value)} aria-label="Ordenar prendas"><option value="newest">Más recientes</option><option value="name">Nombre</option><option value="category">Categoría</option></select></label></div></div>
            {busy && !dataReady ? <div className="empty-state">Cargando tus prendas…</div> : filteredItems.length ? <div className="item-grid">{filteredItems.map(item => <article className="wardrobe-item" key={item.id}><div className="item-photo">{item.image ? <img src={item.image} alt={item.name}/> : <div className="photo-placeholder"><Shirt size={32}/></div>}<span className="item-category">{item.category}{item.subcategory ? ` · ${item.subcategory}` : ''}</span></div><div className="item-info"><button className="item-edit" onClick={() => { setEditingItem(item); setEditorCategory(item.category); setEditorSubcategory(item.subcategory || defaultSubcategory(item.category)); setShowEditor(true) }}><h3>{item.name}</h3><p>{[item.subcategory, item.brand, item.color].filter(Boolean).join(' · ') || 'Sin detalles adicionales'}</p></button><button className="item-delete" aria-label={`Eliminar ${item.name}`} onClick={() => deleteItem(item)}><Trash2 size={16}/></button></div></article>)}</div> : <div className="empty-state"><Shirt size={25}/><b>{items.length ? 'No hay prendas con esos filtros' : 'Todavía no has añadido prendas'}</b><span>{items.length ? 'Prueba otra búsqueda o categoría.' : 'Añade la primera para empezar a organizar tu armario.'}</span>{!items.length && <button className="outline-button" onClick={() => { setEditingItem(null); setEditorCategory('Parte de arriba'); setEditorSubcategory(defaultSubcategory('Parte de arriba')); setShowEditor(true) }}><Plus size={16}/> Añadir primera prenda</button>}</div>}
          </section>
        </>}

        {page === 'inspiration' && <section className="content-panel inspiration-page"><div className="inspiration-heading"><div><div className="eyebrow blush">TU PRÓXIMA IDEA</div><h1>Inspiración</h1><p>Desliza para descubrir outfits pensados para el tiempo de hoy.</p></div><div className="inspiration-heading-actions"><span>{feedback.length} valoraciones</span><button className="primary-button" onClick={loadInspirationCard} disabled={feedLoading || !items.length}><Sparkles size={16}/>{feedLoading ? 'Creando…' : 'Siguiente outfit'}</button><button className="inspiration-close" onClick={() => setPage('wardrobe')} aria-label="Volver a Mi armario"><X size={19}/></button></div></div>{!items.length ? <div className="empty-state"><Shirt size={26}/><b>Primero llena tu armario</b><span>Añade algunas prendas para descubrir combinaciones para la universidad, una cena, un viaje y más.</span><button className="outline-button" onClick={() => setPage('wardrobe')}><LayoutGrid size={16}/> Ir a mi armario</button></div> : <div className="inspiration-feed" ref={feedContainerRef} onScroll={event => { const node = event.currentTarget; if (window.matchMedia('(max-width: 560px)').matches && feedCards.length && !feedLoading && node.scrollHeight - node.scrollTop - node.clientHeight < node.clientHeight * 0.55) loadInspirationCard() }}>{feedCards.map((card, cardIndex) => <article className="inspiration-card" key={card.id}><div className="inspiration-card-media"><InspirationPhotoCarousel items={card.items}/><div className="inspiration-vignette"/><div className="inspiration-card-count">{String(cardIndex + 1).padStart(2, '0')} · LOOK</div><InspirationRating card={card} onRate={rateInspirationCard} className="inspiration-rating-desktop"/></div><div className="inspiration-card-copy"><div className="inspiration-context"><span>{card.occasion}</span><span><Thermometer size={14}/>{card.temperatureC}°C</span><span>{card.season}</span>{card.location && <span><MapPin size={14}/>{card.location}</span>}</div><div className="eyebrow blush">{card.moment}</div><h2>{card.mood}</h2><p className="inspiration-reason">{card.reason || 'Una propuesta creada a partir de las prendas de tu armario.'}</p><InspirationRating card={card} onRate={rateInspirationCard} className="inspiration-rating-mobile"/><div className="inspiration-item-list">{card.items.map(item => <span key={`${card.id}-tag-${item.id}`}>{item.subcategory || item.category} · {item.name}</span>)}</div><div className="inspiration-card-footer">{card.rating ? <span>Tu puntuación: <b>{card.rating}/5</b> · Se tendrá en cuenta para situaciones parecidas.</span> : <span>¿Te lo pondrías? Tu valoración ayudará a personalizar futuras ideas.</span>}<div className="inspiration-card-actions"><button className={`text-action${card.saved ? ' saved' : ''}`} onClick={() => saveInspirationLook(card)} disabled={card.saved || savingFeedCardId === card.id}>{savingFeedCardId === card.id ? 'Guardando…' : card.saved ? 'Guardado' : 'Favorito'}<Heart size={15} fill={card.saved ? 'currentColor' : 'none'}/></button><button className="text-action" onClick={loadInspirationCard} disabled={feedLoading}>{feedLoading ? 'Preparando…' : 'Siguiente'}<ArrowRight size={15}/></button></div></div></div></article>)}{feedLoading && <div className="feed-loading-indicator"><LoaderCircle size={18} className="spinning"/>Preparando tu siguiente look…</div>}</div>}</section>}

        {page === 'looks' && <section className="content-panel"><div className="welcome-row"><div><div className="eyebrow blush">COMBINACIONES GUARDADAS</div><h1>Mis looks</h1><p>Guarda ideas para volver a ellas cuando las necesites.</p></div><button className="primary-button" onClick={() => { setPage('generate'); if (!currentLook.length) generateLook() }}><Sparkles size={16}/> Crear un look</button></div>{looks.length ? <div className="saved-look-grid">{looks.map(look => <article className="saved-look-card" key={look.id}><div className="saved-look-images">{look.items.map((item, index) => <div className="saved-look-image" key={`${look.id}-${item.id}-${index}`}>{item.image ? <img src={item.image} alt={item.name}/> : <Shirt size={26}/>}<span>{item.name}</span></div>)}</div><div className="saved-look-copy"><div><span className="eyebrow blush">{look.occasion || 'LOOK GUARDADO'}</span><h2>{look.name}</h2><p>{look.mood || ''}{look.createdAt ? ` · ${new Date(look.createdAt).toLocaleDateString('es-ES')}` : ''}</p></div><button className="item-delete" aria-label={`Eliminar ${look.name}`} onClick={() => removeLook(look)}><Trash2 size={16}/></button></div></article>)}</div> : <div className="empty-state"><Heart size={25}/><b>Aún no has guardado ningún look</b><span>Crea una combinación en “Mi armario” y guárdala para verla aquí.</span><button className="outline-button" onClick={() => { setPage('generate'); generateLook() }}><Sparkles size={16}/> Crear combinación</button></div>}</section>}

        {page === 'profile' && <section className="content-panel profile-page"><div className="eyebrow blush">TU CUENTA</div><h1>Mi perfil</h1><p className="profile-intro">Gestiona tu sesión y cómo se guardan tus datos.</p><article className="profile-card"><div className="profile-card-icon"><UserRound size={22}/></div><div className="profile-card-main"><span className="eyebrow">CUENTA</span><h2>{session?.user?.email || 'Sin sesión iniciada'}</h2><p>{cloudMode ? 'Tus prendas y looks se sincronizan con Supabase.' : session?.user?.id === '__local_test__' ? 'Acceso de prueba local. Los datos solo se guardan en este navegador.' : session ? 'Sesión abierta; la sincronización no está disponible ahora.' : supabase ? 'Inicia sesión para guardar y sincronizar tus datos en la nube.' : 'Tus datos se guardan solo en este navegador.'}</p></div>{session ? <button className="outline-button" onClick={async () => { if (session.user.id === '__local_test__') { setSession(null); flash('Sesión de prueba cerrada.'); return }; const { error } = await supabase.auth.signOut(); if (error) flash(error.message); else flash('Sesión cerrada.') }}><LogOut size={16}/> Cerrar sesión</button> : supabase && <button className="outline-button" onClick={() => setShowLogin(true)}><LogIn size={16}/> Conectar cuenta</button>}</article><article className="profile-card"><div className="profile-card-icon"><Download size={22}/></div><div className="profile-card-main"><span className="eyebrow">APLICACIÓN</span><h2>Instala Outfit Check</h2><p>En ordenador usa Instalar en el menú de Chrome o Edge. En iPhone o iPad, abre esta página en Safari, toca Compartir y selecciona Añadir a pantalla de inicio.</p></div><button className="outline-button" onClick={installApp}><Download size={16}/> Instalar aplicación</button></article><article className="profile-card"><div className="profile-card-icon"><Cloud size={22}/></div><div className="profile-card-main"><span className="eyebrow">ALMACENAMIENTO</span><h2>{cloudMode ? 'Armario sincronizado' : 'Guardado local'}</h2><p>{cloudMode ? 'Tu bucket de fotos es privado y la app usa enlaces temporales para mostrarlas.' : 'Las prendas y los looks permanecen en este dispositivo hasta que borres sus datos del navegador.'}</p></div>{session && !cloudMode && <button className="outline-button" onClick={() => { setAuthReady(false); window.setTimeout(() => setAuthReady(true), 0) }}>Reintentar conexión</button>}</article><article className="profile-card"><div className="profile-card-icon"><Download size={22}/></div><div className="profile-card-main"><span className="eyebrow">TUS DATOS</span><h2>Descargar una copia</h2><p>Exporta tus prendas y looks guardados como un archivo JSON.</p></div><button className="outline-button" onClick={exportWardrobe}><Download size={16}/> Descargar copia</button></article><div className="privacy-note"><b>Sobre tus imágenes</b><p>Al guardar una foto con tu cuenta, se envía a Gemini para describir la prenda. Groq recibe solo las descripciones de texto al crear un outfit.</p></div></section>}
        <footer className={page === 'inspiration' ? 'app-footer is-feed' : 'app-footer'}><span>outfit check <span className="footer-heart">♥</span> tu armario, tus reglas</span><span>{cloudMode ? 'Sincronizado con tu cuenta' : 'Guardado en este dispositivo'}</span></footer>
      </div>
    </main>
    <nav className="mobile-tabbar" aria-label="Navegación principal">{navItems.map(({ id, label, icon: Icon }) => <button key={`mobile-${id}`} className={page === id ? 'active' : ''} onClick={() => { setPage(id); if (id === 'inspiration' && !feedCards.length) loadInspirationCard() }}><Icon size={20}/><span>{id === 'generate' ? 'Crear' : id === 'wardrobe' ? 'Armario' : id === 'inspiration' ? 'Ideas' : id === 'looks' ? 'Guardados' : 'Perfil'}</span>{id === 'looks' && looks.length > 0 && <i>{looks.length}</i>}</button>)}</nav>
    {notice && <div className="toast"><Check size={17}/>{notice}</div>}
    {showAuthCallback && <div className="modal-backdrop auth-callback-backdrop"><section className="auth-callback" aria-live="polite">
      <div className={`auth-callback-icon ${authCallbackStatus}`}>
        {authCallbackStatus === 'processing' ? <LoaderCircle className="spinning" size={24}/> : authCallbackStatus === 'success' ? <Check size={24}/> : <X size={24}/>}
      </div>
      <div className="eyebrow blush">ACCESO A OUTFIT CHECK</div>
      <h2>{authCallbackStatus === 'processing' ? 'Comprobando tu acceso…' : authCallbackStatus === 'success' ? 'Ya has iniciado sesión' : 'No se pudo iniciar sesión'}</h2>
      <p>{authCallbackStatus === 'processing' ? 'Estamos validando el enlace del correo y preparando tu armario.' : authCallbackStatus === 'success' ? 'El enlace se ha validado. Tu armario está listo.' : authCallbackError}</p>
      {authCallbackStatus === 'success' && <button className="generate-button" disabled={!dataReady || busy} onClick={() => { setShowAuthCallback(false); setPage('wardrobe') }}>{busy ? 'Cargando tu armario…' : 'Entrar en mi armario'}<ArrowRight size={16}/></button>}
      {authCallbackStatus === 'error' && <div className="auth-callback-actions"><button className="generate-button" onClick={() => { setShowAuthCallback(false); setShowLogin(true) }}><LogIn size={16}/> Solicitar otro enlace</button><button className="text-action" onClick={() => setShowAuthCallback(false)}>Volver a la aplicación</button></div>}
    </section></div>}
    {showEditor && <div className="modal-backdrop" onClick={() => { setShowEditor(false); setPhotoPreview(''); setPhotoName('') }}><form className="add-modal" onSubmit={async event => { event.preventDefault(); setBusy(true); try { await persistItem(new FormData(event.currentTarget), event.currentTarget.elements.photo.files?.[0]); setShowEditor(false); setEditingItem(null); setPhotoPreview(''); setPhotoName(''); flash(editingItem ? 'Prenda actualizada.' : 'Prenda añadida al armario.') } catch (error) { flash(error.message || 'No se pudo guardar la prenda.') } finally { setBusy(false) } }} onClick={event => event.stopPropagation()}><button type="button" className="modal-close" onClick={() => { setShowEditor(false); setPhotoPreview(''); setPhotoName('') }} aria-label="Cerrar"><X size={19}/></button><div className="eyebrow blush">TU ARMARIO</div><h2>{editingItem ? 'Editar prenda' : 'Añadir prenda'}</h2><p className="modal-sub">Guarda los detalles para encontrarla y combinarla después.</p><label className={`upload-zone${photoPreview ? ' has-photo' : ''}`}>{photoPreview ? <img className="upload-preview" src={photoPreview} alt="Vista previa de la foto seleccionada"/> : <Upload size={21}/>}<span>{photoName ? 'Foto seleccionada · completa el formulario para guardarla' : editingItem?.image ? 'Cambiar foto (opcional)' : 'Añadir una foto (opcional)'}</span><small>{photoName || 'JPG, PNG o WebP · hasta 10 MB; se optimiza al guardar'}</small><input name="photo" type="file" accept="image/jpeg,image/png,image/webp" onChange={event => { const file = event.target.files?.[0]; setPhotoPreview(file ? URL.createObjectURL(file) : ''); setPhotoName(file?.name || '') }}/></label><label className="modal-label">Nombre<input name="name" defaultValue={editingItem?.name || ''} placeholder="Ej. Camisa de lino" maxLength={80} required/></label><div className="form-row"><label className="modal-label">Categoría<select name="category" value={editorCategory} onChange={event => { const nextCategory = event.target.value; setEditorCategory(nextCategory); setEditorSubcategory(defaultSubcategory(nextCategory)) }}>{categories.map(value => <option key={value}>{value}</option>)}</select></label></div>{itemTypes[editorCategory] && <label className="modal-label">{editorCategory === 'Accesorios' ? 'Tipo de accesorio' : editorCategory === 'Calzado' ? 'Tipo de calzado' : 'Tipo de prenda'}<select name="subcategory" value={editorSubcategory} onChange={event => setEditorSubcategory(event.target.value)}>{itemTypes[editorCategory].map(value => <option key={value}>{value}</option>)}</select></label>}<div className="form-row"><label className="modal-label">Color<input name="color" defaultValue={editingItem?.color || ''} placeholder="Ej. Azul cielo" maxLength={40}/></label></div><label className="modal-label">Descripción <span className="optional">{cloudMode ? '(Gemini completa los atributos al guardar)' : '(opcional; la IA requiere cuenta conectada)'}</span><textarea name="description" defaultValue={editingItem?.description || ''} rows={4} maxLength={450} placeholder="Gemini completará la descripción y los atributos al guardar si tienes la cuenta conectada."/></label><label className="modal-label">Marca <span className="optional">(opcional)</span><input name="brand" defaultValue={editingItem?.brand || ''} placeholder="Ej. COS" maxLength={60}/></label><button className="generate-button modal-submit" disabled={busy}>{busy ? 'Guardando…' : editingItem ? 'Guardar cambios' : 'Añadir al armario'}</button></form></div>}
    {showLogin && <div className="modal-backdrop" onClick={() => setShowLogin(false)}><form className="add-modal" onSubmit={submitAuth} onClick={event => event.stopPropagation()}><button type="button" className="modal-close" onClick={() => setShowLogin(false)} aria-label="Cerrar"><X size={19}/></button><div className="eyebrow blush">CUENTA OUTFIT CHECK</div><h2>{authMode === 'signup' ? 'Crear cuenta' : authMode === 'recovery' ? 'Recuperar contraseña' : authMode === 'update-password' ? 'Establecer contraseña' : 'Iniciar sesión'}</h2><p className="modal-sub">{loginLinkSent ? authMode === 'recovery' ? <>Te enviamos un enlace para restablecer la contraseña de <b>{email}</b>.</> : <>Te enviamos un correo a <b>{email}</b> para confirmar tu cuenta.</> : authMode === 'update-password' ? 'Elige una contraseña nueva para tu cuenta.' : authMode === 'recovery' ? 'Escribe el correo de tu cuenta y te enviaremos un enlace para cambiarla.' : authMode === 'signup' ? 'Crea tu cuenta con correo y una contraseña de al menos 8 caracteres.' : import.meta.env.DEV ? 'Modo de prueba local: al continuar se abrirá el armario en este navegador.' : 'Usa el correo con el que registraste tu cuenta y tu contraseña.'}</p>{authMode !== 'update-password' && <label className="modal-label">Correo electrónico<input type="email" value={email} onChange={event => { setEmail(event.target.value); setLoginLinkSent(false) }} placeholder="tu@email.com" autoComplete="email" required/></label>}{['login', 'signup', 'update-password'].includes(authMode) && <label className="modal-label">Contraseña<input type="password" value={password} onChange={event => setPassword(event.target.value)} placeholder="Mínimo 8 caracteres" autoComplete={authMode === 'login' ? 'current-password' : 'new-password'} minLength={8} required/></label>}{['signup', 'update-password'].includes(authMode) && <label className="modal-label">Repite la contraseña<input type="password" value={confirmPassword} onChange={event => setConfirmPassword(event.target.value)} autoComplete="new-password" minLength={8} required/></label>}<button className="generate-button modal-submit" disabled={loginBusy || (loginLinkSent && authMode !== 'login')}>{loginBusy ? 'Un momento…' : loginLinkSent ? 'Correo enviado' : authMode === 'signup' ? 'Crear cuenta' : authMode === 'recovery' ? 'Enviar enlace de recuperación' : authMode === 'update-password' ? 'Guardar contraseña' : import.meta.env.DEV ? 'Entrar en modo prueba local' : 'Iniciar sesión'}<LogIn size={16}/></button>{authMode === 'login' && !import.meta.env.DEV && <button type="button" className="text-action" onClick={() => { setAuthMode('recovery'); setLoginLinkSent(false) }}>¿Olvidaste tu contraseña?</button>}{authMode === 'login' && <button type="button" className="text-action" onClick={() => { setAuthMode('signup'); setPassword(''); setConfirmPassword(''); setLoginLinkSent(false) }}>Crear una cuenta nueva</button>}{authMode !== 'login' && authMode !== 'update-password' && <button type="button" className="text-action" onClick={() => { setAuthMode('login'); setLoginLinkSent(false) }}>Volver a iniciar sesión</button>}</form></div>}
  </div>
}

createRoot(document.getElementById('root')).render(<App />)
