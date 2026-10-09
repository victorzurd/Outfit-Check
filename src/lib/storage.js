export const localItemsKey = 'outfit-check-wardrobe-v2'
export const localLooksKey = 'outfit-check-saved-looks-v2'
const localFeedbackBaseKey = 'outfit-check-outfit-feedback-v1'
export const feedbackStorageKey = userId => `${localFeedbackBaseKey}-${userId || 'local'}`
export const readFeedback = userId => readLocal(feedbackStorageKey(userId), [])

export const readLocal = (key, fallback = []) => {
  try {
    const value = JSON.parse(localStorage.getItem(key) || 'null')
    return Array.isArray(value) ? value : fallback
  } catch { return fallback }
}
export const normalizeWardrobeItem = item => {
  if (item.category === 'Zapatos') return { ...item, category: 'Calzado' }
  const subtype = String(item.subcategory || '').toLocaleLowerCase('es')
  const outerwear = ['abrigo', 'chaqueta', 'cazadora', 'gabardina', 'blazer', 'chaleco'].includes(subtype)
  if (item.category === 'Parte de arriba' && outerwear) return { ...item, category: 'Ropa de abrigo' }
  if (item.category !== 'Prendas') return item
  const category = ['vestido', 'mono', 'peto'].includes(subtype) ? 'Cuerpo completo'
    : ['pantalón', 'pantalon', 'vaquero', 'falda', 'shorts', 'leggings'].includes(subtype) ? 'Parte de abajo'
      : outerwear ? 'Ropa de abrigo' : 'Parte de arriba'
  return { ...item, category }
}
export const readLocalItems = () => {
  const current = readLocal(localItemsKey, null)
  if (current) {
    const normalized = current.map(normalizeWardrobeItem)
    if (normalized.some((item, index) => item !== current[index])) {
      try { localStorage.setItem(localItemsKey, JSON.stringify(normalized)) } catch {}
    }
    return normalized
  }
  const oldItems = readLocal('outfit-check-wardrobe', [])
  const demoIds = new Set([1, 2, 3, 4, 5, 6, 7, 8])
  const migrated = oldItems.filter(item => !demoIds.has(item.id)).map(normalizeWardrobeItem)
  if (migrated.length) { try { localStorage.setItem(localItemsKey, JSON.stringify(migrated)) } catch {} }
  return migrated
}
