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
  let activeStage = 'desconocida'
  try {
    const auth = await requireUser(req)
    if (auth.error) return sendJson(res, auth.status, { error: auth.error })

    const { inventory, occasion, mood, temperatureC, season, selectedItems = [] } = req.body || {}
    const stage = req.body?.stage
    activeStage = stage || activeStage
    const stageInstructions = {
      base: 'Elige exactamente UNA sola opción para iniciar el outfit: una Parte de arriba o una prenda de Cuerpo completo. Si eliges Cuerpo completo, no se añadirán partes de arriba ni de abajo.',
      bottom: 'Elige exactamente una Parte de abajo que combine con la parte de arriba ya elegida. No repitas ni sustituyas las prendas ya seleccionadas.',
      footwear: 'Elige exactamente un Calzado que combine con todas las prendas ya seleccionadas.',
      extras: 'Elige cero o un Bolso y los Accesorios que mejor completen el outfit. Como máximo uno de cada tipo que se lleve de uno en uno: Pendientes (un par), Collares, Relojes, Cinturones, Sombreros, Bufandas, Gafas y Otros. Pulseras y Anillos sí pueden repetirse. Devuelve solo artículos de la lista candidata; la lista puede quedar vacía.',
    }
    if (!Object.hasOwn(stageInstructions, stage)) return sendJson(res, 400, { error: 'Falta una etapa válida para crear el outfit.' })
    if (!Array.isArray(inventory) || inventory.length === 0) {
      if (stage !== 'extras' || !Array.isArray(inventory)) return sendJson(res, 400, { error: 'No hay candidatos para esta etapa del outfit.' })
    }
    const wardrobe = inventory.map(item => ({
      id: text(item?.id, 80), name: text(item?.name, 80), category: text(item?.category, 40),
      subcategory: text(item?.subcategory, 60), color: text(item?.color, 100),
      description: text(item?.description, 450), attributes: item?.attributes && typeof item.attributes === 'object' ? item.attributes : {},
    })).filter(item => item.id && item.name && ['Parte de arriba', 'Parte de abajo', 'Cuerpo completo', 'Calzado', 'Bolsos', 'Accesorios'].includes(item.category))
    if (!wardrobe.length) return sendJson(res, 400, { error: 'No hay prendas válidas para combinar.' })
    const validStages = {
      base: item => ['Parte de arriba', 'Cuerpo completo'].includes(item.category),
      bottom: item => item.category === 'Parte de abajo',
      footwear: item => item.category === 'Calzado',
      extras: item => ['Bolsos', 'Accesorios'].includes(item.category),
    }
    const candidates = wardrobe.filter(validStages[stage])
    if (!candidates.length && stage !== 'extras') return sendJson(res, 422, { error: 'No hay prendas disponibles para esta parte del outfit.' })
    const chosenContext = (Array.isArray(selectedItems) ? selectedItems : []).slice(0, 8).map(item => ({
      id: text(item?.id, 80), name: text(item?.name, 80), category: text(item?.category, 40),
      subcategory: text(item?.subcategory, 60), color: text(item?.color, 100),
      description: text(item?.description, 300), attributes: item?.attributes && typeof item.attributes === 'object' ? item.attributes : {},
    }))
    if (stage === 'bottom' && !chosenContext.some(item => item.category === 'Parte de arriba')) {
      return sendJson(res, 400, { error: 'La etapa de parte de abajo necesita una parte de arriba ya elegida.' })
    }
    if (['footwear', 'extras'].includes(stage) && !chosenContext.length) {
      return sendJson(res, 400, { error: 'Esta etapa necesita las prendas seleccionadas anteriormente.' })
    }

    const apiKey = process.env.GROQ_API_KEY
    if (!apiKey) return sendJson(res, 500, { error: 'Añade GROQ_API_KEY a las variables de entorno de Vercel.' })
    const model = process.env.GROQ_MODEL || 'openai/gpt-oss-20b'
    const feedback = Array.isArray(req.body.feedback) ? req.body.feedback : []
    const preferences = preferenceContext(feedback)
    const upstream = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model, temperature: 0.35, reasoning_effort: 'low', max_completion_tokens: 1200,
        messages: [
          { role: 'system', content: `Eres estilista personal y trabajas en la etapa "${stage}" de un outfit. Elige EXCLUSIVAMENTE IDs de candidates; no inventes ni repitas prendas. ${stageInstructions[stage]} Considera la situación, las prendas que ya se eligieron, comodidad, armonía de colores, estación, temperatura y formalidad. Usa las preferencias personales como guía para esta situación. Si faltan descripciones, decide con nombre, categoría y color. Responde únicamente con JSON.` },
          { role: 'user', content: JSON.stringify({
            situation: { occasion: text(occasion, 80), mood: text(mood, 100), temperatureC: temperatureC !== null && temperatureC !== undefined && temperatureC !== '' && Number.isFinite(Number(temperatureC)) ? Number(temperatureC) : null, season: text(season, 30) },
            alreadySelected: chosenContext, candidates, personalizedPreferences: preferences,
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
      const detail = text(response.error?.message || `Groq respondió HTTP ${upstream.status}.`, 320)
      console.error('Groq request failed:', activeStage, upstream.status, detail)
      return sendJson(res, upstream.status === 429 ? 429 : 502, {
        error: upstream.status === 429 ? `Groq alcanzó su límite durante la etapa ${activeStage}.` : `Groq falló durante la etapa ${activeStage}.`,
        detail,
      })
    }

    const completion = response.choices?.[0]
    const modelText = completion?.message?.content
    if (!modelText) {
      const detail = `Groq no devolvió contenido (finish_reason: ${completion?.finish_reason || 'sin respuesta'}).`
      console.error('Groq returned no content:', activeStage, detail)
      return sendJson(res, 502, { error: `Respuesta vacía durante la etapa ${activeStage}.`, detail })
    }
    const parsed = parseModelJson(modelText)
    const inventoryById = new Map(candidates.map(item => [item.id, item]))
    const chosen = [...new Set(Array.isArray(parsed.itemIds) ? parsed.itemIds.map(String) : [])]
      .map(id => inventoryById.get(id)).filter(Boolean)
    let selected = []
    if (stage === 'base') selected = chosen.filter(item => ['Parte de arriba', 'Cuerpo completo'].includes(item.category)).slice(0, 1)
    if (stage === 'bottom') selected = chosen.filter(item => item.category === 'Parte de abajo').slice(0, 1)
    if (stage === 'footwear') selected = chosen.filter(item => item.category === 'Calzado').slice(0, 1)
    if (stage === 'extras') {
      let bagAdded = false
      const accessoryCounts = new Map()
      for (const item of chosen) {
        if (item.category === 'Bolsos') {
          if (bagAdded) continue
          bagAdded = true
          selected.push(item)
        } else if (item.category === 'Accesorios') {
          const subtype = item.subcategory || 'Otros'
          const count = accessoryCounts.get(subtype) || 0
          if (!['Pulseras', 'Anillos'].includes(subtype) && count >= 1) continue
          accessoryCounts.set(subtype, count + 1)
          selected.push(item)
        }
      }
    }
    if (stage !== 'extras' && selected.length !== 1) return sendJson(res, 502, { error: 'Groq no pudo elegir una prenda válida para esta etapa. Inténtalo otra vez.' })
    return sendJson(res, 200, { itemIds: selected.map(item => item.id), reason: text(parsed.reason, 300) })
  } catch (error) {
    const detail = text(error.message || 'Error desconocido.', 320)
    console.error('Outfit recommendation failed:', activeStage, detail)
    return sendJson(res, 502, { error: `No se pudo completar la etapa ${activeStage}.`, detail })
  }
}
