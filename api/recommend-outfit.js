import { requireUser, sendJson, parseModelJson } from '../server/ai-utils.js'

const text = (value, max = 500) => String(value || '').slice(0, max)

const preferenceContext = feedback => {
  const groups = new Map()
  for (const entry of feedback) {
    const rating = Number(entry?.rating)
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) continue
    const temperatureC = entry.temperatureC !== null && entry.temperatureC !== undefined && entry.temperatureC !== '' && Number.isFinite(Number(entry.temperatureC)) ? Number(entry.temperatureC) : null
    const temperatureBand = temperatureC === null ? 'sin temperatura' : temperatureC < 10 ? 'frío (<10°C)' : temperatureC < 20 ? 'templado (10-19°C)' : temperatureC < 28 ? 'cálido (20-27°C)' : 'caluroso (28°C o más)'
    const context = {
      occasion: text(entry.occasion, 60) || 'otra', season: text(entry.season, 30) || 'sin estación',
      temperatureBand, mood: text(entry.mood, 70),
    }
    const key = JSON.stringify(context)
    if (!groups.has(key)) groups.set(key, { ...context, count: 0, scoreTotal: 0, features: new Map() })
    const group = groups.get(key)
    group.count += 1
    group.scoreTotal += rating
    for (const item of Array.isArray(entry.outfit) ? entry.outfit.slice(0, 6) : []) {
      const attributes = item?.attributes && typeof item.attributes === 'object' ? item.attributes : item
      const features = [
        item?.category && item?.subcategory ? `${text(item.category, 30)}: ${text(item.subcategory, 40)}` : '',
        item?.color ? `color ${text(item.color, 40)}` : '',
        attributes?.style ? `estilo ${text(attributes.style, 50)}` : '',
        attributes?.pattern ? `estampado ${text(attributes.pattern, 40)}` : '',
        attributes?.formality ? `formalidad ${text(attributes.formality, 30)}` : '',
        ...(Array.isArray(attributes?.seasons) ? attributes.seasons.slice(0, 2).map(value => `estación ${text(value, 20)}`) : []),
      ].filter(Boolean)
      for (const feature of features) {
        if (!group.features.has(feature)) group.features.set(feature, { liked: 0, disliked: 0 })
        const tally = group.features.get(feature)
        if (rating >= 4) tally.liked += 1
        if (rating <= 2) tally.disliked += 1
      }
    }
  }
  return [...groups.values()].map(group => {
    const features = [...group.features.entries()].map(([feature, tally]) => ({ feature, ...tally }))
    return {
      occasion: group.occasion, season: group.season, temperatureBand: group.temperatureBand, mood: group.mood,
      ratingsCount: group.count, averageRating: Number((group.scoreTotal / group.count).toFixed(2)),
      likedFeatures: features.filter(entry => entry.liked).sort((a, b) => b.liked - a.liked).slice(0, 8).map(entry => entry.feature),
      dislikedFeatures: features.filter(entry => entry.disliked).sort((a, b) => b.disliked - a.disliked).slice(0, 8).map(entry => entry.feature),
    }
  })
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return sendJson(res, 405, { error: 'Método no permitido.' })
  try {
    const auth = await requireUser(req)
    if (auth.error) return sendJson(res, auth.status, { error: auth.error })

    const { inventory, occasion, mood, temperatureC, season } = req.body || {}
    if (!Array.isArray(inventory) || inventory.length === 0 || inventory.length > 100) {
      return sendJson(res, 400, { error: 'El armario debe incluir entre 1 y 100 prendas.' })
    }
    const wardrobe = inventory.map(item => ({
      id: text(item?.id, 80), name: text(item?.name, 80), category: text(item?.category, 40),
      subcategory: text(item?.subcategory, 60), color: text(item?.color, 100),
      description: text(item?.description, 450), attributes: item?.attributes && typeof item.attributes === 'object' ? item.attributes : {},
    })).filter(item => item.id && item.name && ['Prendas', 'Zapatos', 'Bolsos', 'Accesorios'].includes(item.category))
    if (!wardrobe.length) return sendJson(res, 400, { error: 'No hay prendas válidas para combinar.' })

    const apiKey = process.env.GROQ_API_KEY
    if (!apiKey) return sendJson(res, 500, { error: 'Añade GROQ_API_KEY a las variables de entorno de Vercel.' })
    const model = process.env.GROQ_MODEL || 'openai/gpt-oss-20b'
    const feedback = Array.isArray(req.body.feedback) ? req.body.feedback : []
    const preferences = preferenceContext(feedback)
    const upstream = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model, temperature: 0.35, max_completion_tokens: 600,
        messages: [
          { role: 'system', content: 'Eres estilista personal. Elige el outfit más coherente usando EXCLUSIVAMENTE las prendas del armario. No inventes prendas ni devuelvas identificadores ajenos al inventario. Devuelve un único conjunto: una prenda principal si existe, y combina opcionalmente un zapato, un bolso y hasta dos accesorios. Considera ocasión, temperatura, estación, comodidad, armonía de colores, estampados, temporada y formalidad. Usa el perfil de valoraciones del usuario como aprendizaje contextual: prioriza rasgos que suele puntuar alto en situaciones parecidas y evita rasgos puntuados bajo; no generalices una preferencia de una situación a todas las demás. Con pocas valoraciones, da prioridad al buen criterio de estilo. Si faltan descripciones, decide con nombre, categoría y color. Responde únicamente con JSON.' },
          { role: 'user', content: JSON.stringify({
            situation: { occasion: text(occasion, 80), mood: text(mood, 100), temperatureC: temperatureC !== null && temperatureC !== undefined && temperatureC !== '' && Number.isFinite(Number(temperatureC)) ? Number(temperatureC) : null, season: text(season, 30) },
            wardrobe, personalizedPreferences: preferences,
          }) },
        ],
        response_format: {
          type: 'json_schema',
          json_schema: {
            name: 'outfit_recommendation', strict: true,
            schema: {
              type: 'object', properties: {
                itemIds: { type: 'array', items: { type: 'string' } },
                reason: { type: 'string' },
              }, required: ['itemIds', 'reason'], additionalProperties: false,
            },
          },
        },
      }),
    })
    const response = await upstream.json().catch(() => ({}))
    if (!upstream.ok) {
      console.error('Groq request failed:', upstream.status, response.error?.message || '')
      return sendJson(res, upstream.status === 429 ? 429 : 502, { error: upstream.status === 429 ? 'Groq ha alcanzado su límite de uso. Inténtalo más tarde.' : 'Groq no pudo elegir un outfit.' })
    }

    const parsed = parseModelJson(response.choices?.[0]?.message?.content)
    const inventoryById = new Map(wardrobe.map(item => [item.id, item]))
    const chosen = [...new Set(Array.isArray(parsed.itemIds) ? parsed.itemIds.map(String) : [])]
      .map(id => inventoryById.get(id)).filter(Boolean)
    const counts = new Map()
    const selected = chosen.filter(item => {
      const maximum = item.category === 'Prendas' || item.category === 'Zapatos' || item.category === 'Bolsos' ? 1 : 2
      const count = counts.get(item.category) || 0
      if (count >= maximum) return false
      counts.set(item.category, count + 1)
      return true
    })
    if (!selected.length) return sendJson(res, 502, { error: 'Groq no devolvió una selección válida. Inténtalo otra vez.' })
    return sendJson(res, 200, { itemIds: selected.map(item => item.id), reason: text(parsed.reason, 300) })
  } catch (error) {
    console.error('Outfit recommendation failed:', error.message)
    return sendJson(res, 502, { error: 'No se pudo interpretar la respuesta de Groq. Inténtalo otra vez.' })
  }
}
