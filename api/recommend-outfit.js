import { requireUser, sendJson, parseModelJson } from '../server/ai-utils.js'

const text = (value, max = 500) => String(value || '').slice(0, max)
const colorFamilyAliases = {
  neutro: ['negro', 'black', 'blanco', 'white', 'gris', 'gray', 'grey', 'beige', 'crema', 'ivory', 'marfil', 'crudo', 'ecru', 'arena', 'taupe', 'topo', 'camel', 'marron', 'brown', 'chocolate', 'nude', 'natural', 'tan'],
  azul: ['azul', 'blue', 'celeste', 'marino', 'navy', 'denim', 'vaquero', 'añil', 'indigo'],
  verde: ['verde', 'green', 'oliva', 'olive', 'caqui', 'khaki', 'esmeralda', 'emerald', 'menta', 'mint', 'pistacho', 'salvia', 'sage'],
  rojo: ['rojo', 'red', 'burdeos', 'burgundy', 'vino', 'wine', 'granate', 'maroon', 'borgona', 'cereza', 'teja'],
  rosa: ['rosa', 'pink', 'fucsia', 'magenta', 'malva', 'blush'],
  amarillo: ['amarillo', 'yellow', 'mostaza', 'mustard', 'dorado', 'oro', 'gold'],
  naranja: ['naranja', 'orange', 'terracota', 'terracotta', 'cobre', 'coral', 'rust'],
  morado: ['morado', 'purple', 'lila', 'lilac', 'lavanda', 'lavender', 'violeta', 'plum', 'purpura'],
  metalizado: ['plata', 'silver', 'plateado', 'plateada', 'metalizado', 'metalizada'],
}
const normalize = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('es')
const colorFamilies = item => {
  const color = normalize(item?.color || item?.attributes?.color || '')
  if (!color) return []
  return Object.entries(colorFamilyAliases)
    .filter(([, aliases]) => aliases.some(alias => color.split(/[^a-z]+/).includes(normalize(alias))))
    .map(([family]) => family)
}
const colorPair = (first, second) => [first, second].sort().join(' + ')

const preferenceContext = (feedback, situation = {}) => {
  const groups = new Map()
  let totalRatings = 0
  let ratingTotal = 0
  for (const entry of feedback) {
    const rating = Number(entry?.rating)
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) continue
    totalRatings += 1
    ratingTotal += rating
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
    const outfit = Array.isArray(entry.outfit) ? entry.outfit.slice(0, 8) : []
    const itemColorFamilies = outfit.map(colorFamilies)
    const outfitPairs = new Set()
    for (let first = 0; first < itemColorFamilies.length; first += 1) {
      for (let second = first + 1; second < itemColorFamilies.length; second += 1) {
        for (const firstFamily of itemColorFamilies[first]) for (const secondFamily of itemColorFamilies[second]) {
          outfitPairs.add(colorPair(firstFamily, secondFamily))
        }
      }
    }
    for (const pair of outfitPairs) {
      const feature = `color-pair:${pair}`
      if (!group.features.has(feature)) group.features.set(feature, { liked: 0, disliked: 0 })
      const tally = group.features.get(feature)
      if (rating >= 4) tally.liked += 1
      if (rating <= 2) tally.disliked += 1
    }
    for (const item of outfit) {
      const attributes = item?.attributes && typeof item.attributes === 'object' ? item.attributes : item
      const features = [
        item?.category && item?.subcategory ? `${text(item.category, 30)}: ${text(item.subcategory, 40)}` : '',
        ...colorFamilies(item).map(family => `color ${family}`),
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
  const profiles = [...groups.values()].map(group => {
    const features = [...group.features.entries()].map(([feature, tally]) => ({ feature, ...tally }))
    return {
      occasion: group.occasion, season: group.season, temperatureBand: group.temperatureBand, mood: group.mood,
      ratingsCount: group.count, averageRating: Number((group.scoreTotal / group.count).toFixed(2)),
      likedFeatures: features.filter(entry => entry.liked > entry.disliked && !entry.feature.startsWith('color-pair:')).sort((a, b) => (b.liked - b.disliked) - (a.liked - a.disliked)).slice(0, 4).map(entry => entry.feature),
      dislikedFeatures: features.filter(entry => entry.disliked > entry.liked && !entry.feature.startsWith('color-pair:')).sort((a, b) => (b.disliked - b.liked) - (a.disliked - a.liked)).slice(0, 4).map(entry => entry.feature),
      likedColorPairs: features.filter(entry => entry.feature.startsWith('color-pair:') && entry.liked > entry.disliked).sort((a, b) => (b.liked - b.disliked) - (a.liked - a.disliked)).slice(0, 4).map(entry => entry.feature.slice('color-pair:'.length)),
      dislikedColorPairs: features.filter(entry => entry.feature.startsWith('color-pair:') && entry.disliked > entry.liked).sort((a, b) => (b.disliked - b.liked) - (a.disliked - a.liked)).slice(0, 4).map(entry => entry.feature.slice('color-pair:'.length)),
    }
  })
  const overallFeatures = new Map()
  for (const group of groups.values()) for (const [feature, tally] of group.features) {
    const current = overallFeatures.get(feature) || { liked: 0, disliked: 0 }
    current.liked += tally.liked
    current.disliked += tally.disliked
    overallFeatures.set(feature, current)
  }
  const targetTemperature = Number(situation.temperatureC)
  const targetBand = !Number.isFinite(targetTemperature) ? '' : targetTemperature < 10 ? 'frío (<10°C)' : targetTemperature < 20 ? 'templado (10-19°C)' : targetTemperature < 28 ? 'cálido (20-27°C)' : 'caluroso (28°C o más)'
  const relevance = profile => (profile.occasion === (text(situation.occasion, 60) || 'otra') ? 8 : 0)
    + (profile.season === (text(situation.season, 30) || 'sin estación') ? 4 : 0)
    + (profile.temperatureBand === targetBand && targetBand ? 2 : 0)
  const sortedFeatures = [...overallFeatures.entries()].map(([feature, tally]) => ({ feature, ...tally }))
  const sortedColorPairs = sortedFeatures.filter(entry => entry.feature.startsWith('color-pair:'))
  return {
    ratingsCount: totalRatings,
    averageRating: totalRatings ? Number((ratingTotal / totalRatings).toFixed(2)) : null,
    overallLikedFeatures: sortedFeatures.filter(entry => entry.liked > entry.disliked && !entry.feature.startsWith('color-pair:')).sort((a, b) => (b.liked - b.disliked) - (a.liked - a.disliked)).slice(0, 6).map(entry => entry.feature),
    overallDislikedFeatures: sortedFeatures.filter(entry => entry.disliked > entry.liked && !entry.feature.startsWith('color-pair:')).sort((a, b) => (b.disliked - b.liked) - (a.disliked - a.liked)).slice(0, 6).map(entry => entry.feature),
    likedColorPairs: sortedColorPairs.filter(entry => entry.liked > entry.disliked).sort((a, b) => (b.liked - b.disliked) - (a.liked - a.disliked)).slice(0, 6).map(entry => entry.feature.slice('color-pair:'.length)),
    dislikedColorPairs: sortedColorPairs.filter(entry => entry.disliked > entry.liked).sort((a, b) => (b.disliked - b.liked) - (a.disliked - a.liked)).slice(0, 6).map(entry => entry.feature.slice('color-pair:'.length)),
    similarSituations: profiles.sort((a, b) => relevance(b) - relevance(a) || b.ratingsCount - a.ratingsCount).slice(0, 3),
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return sendJson(res, 405, { error: 'Método no permitido.' })
  let activeStage = 'desconocida'
  try {
    const auth = await requireUser(req)
    if (auth.error) return sendJson(res, auth.status, { error: auth.error })

    const { inventory, occasion, mood, temperatureC, apparentTemperatureC, season, weather, location, timezone, selectedItems = [] } = req.body || {}
    const stage = req.body?.stage
    activeStage = stage || activeStage
    const stageInstructions = {
      complete: 'Elige el outfit completo usando la lista entera. Debe incluir exactamente un Calzado y una prenda de Cuerpo completo O una Parte de arriba más una Parte de abajo. Puedes añadir cero o una prenda de Ropa de abrigo (toda segunda capa o capa exterior, incluidos Jersey y Sudadera). Con 10 °C o menos, incluye una capa cálida si hay una adecuada: prioriza Abrigo o Gabardina y, si no hay, Jersey o Sudadera. Entre 11 y 15 °C normalmente añade Jersey, Sudadera, Abrigo, Chaqueta, Cazadora o Gabardina. Con tiempo fresco elige una segunda capa acorde a la sensación térmica y el plan; con más de 22 °C normalmente omítela, salvo lluvia que justifique una prenda ligera. Usa temperatura aparente, o real si falta, y ten en cuenta estación y lluvia. Puede llevar cero o un Bolso. Puede incluir varios Accesorios; máximo uno de Pendientes (un par), Collares, Relojes, Cinturones, Sombreros, Bufandas, Gafas y Otros. Pulseras y Anillos pueden repetirse. No combines Cuerpo completo con partes de arriba o abajo.',
      base: 'Elige exactamente UNA sola opción para iniciar el outfit: una Parte de arriba o una prenda de Cuerpo completo. Si eliges Cuerpo completo, no se añadirán partes de arriba ni de abajo. Prioriza una base que permita crear una paleta equilibrada con las prendas candidatas disponibles; no elijas un color solo porque coincida con muchas otras prendas.',
      bottom: 'Elige exactamente una Parte de abajo que combine con la parte de arriba ya elegida. Compara sus familias de color; evita repetir el mismo color dominante si hay una alternativa armónica. No repitas ni sustituyas las prendas ya seleccionadas.',
      outerwear: 'La ropa de abrigo es una capa opcional: elige cero o una, nunca más. Jersey y Sudadera también son capas y deben considerarse. Prioriza la temperatura aparente; si falta, usa la temperatura. Con 10 °C o menos, elige Abrigo o Gabardina si existe; si no, Jersey o Sudadera. Entre 11 y 15 °C normalmente añade Jersey, Sudadera, Abrigo, Chaqueta, Cazadora o Gabardina según lo cálida que sea la prenda. Entre 16 y 20 °C prefiere Jersey fino, Cárdigan, Chaqueta, Cazadora, Gabardina o Sobrecamisa. Con tiempo templado puedes elegir Blazer o Chaleco si encaja con el plan. Por encima de 22 °C omite la capa, salvo lluvia que justifique una prenda ligera. Si no hace frío ni llueve, puedes omitirla. Combínala con el outfit elegido y no devuelvas más de un ID.',
      footwear: 'Elige exactamente un Calzado que combine con todas las prendas ya seleccionadas. Úsalo para equilibrar la paleta con un neutro o repetir discretamente un color de acento; evita que todo el outfit quede en una sola familia de color.',
      extras: 'Elige cero o un Bolso y los Accesorios que mejor completen el outfit. Prefiere un neutro o un accesorio que repita un único acento ya presente; no añadas un color nuevo sin motivo. Como máximo uno de cada tipo que se lleve de uno en uno: Pendientes (un par), Collares, Relojes, Cinturones, Sombreros, Bufandas, Gafas y Otros. Pulseras y Anillos sí pueden repetirse. Devuelve solo artículos de la lista candidata; la lista puede quedar vacía.',
    }
    if (!Object.hasOwn(stageInstructions, stage)) return sendJson(res, 400, { error: 'Falta una etapa válida para crear el outfit.' })
    if (!Array.isArray(inventory) || inventory.length === 0) {
      if (stage !== 'extras' || !Array.isArray(inventory)) return sendJson(res, 400, { error: 'No hay candidatos para esta etapa del outfit.' })
    }
    const wardrobe = inventory.map(item => ({
      id: text(item?.id, 80), name: text(item?.name, 80), category: text(item?.category, 40),
      subcategory: text(item?.subcategory, 60), color: text(item?.color, 100),
      description: text(item?.description, 450), attributes: item?.attributes && typeof item.attributes === 'object' ? item.attributes : {},
    })).filter(item => item.id && item.name && ['Parte de arriba', 'Ropa de abrigo', 'Parte de abajo', 'Cuerpo completo', 'Calzado', 'Bolsos', 'Accesorios'].includes(item.category))
    if (!wardrobe.length) return sendJson(res, 400, { error: 'No hay prendas válidas para combinar.' })
    const validStages = {
      complete: () => true,
      base: item => ['Parte de arriba', 'Cuerpo completo'].includes(item.category),
      bottom: item => item.category === 'Parte de abajo',
      outerwear: item => item.category === 'Ropa de abrigo',
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
    if (['outerwear', 'footwear', 'extras'].includes(stage) && !chosenContext.length) {
      return sendJson(res, 400, { error: 'Esta etapa necesita las prendas seleccionadas anteriormente.' })
    }

    const apiKey = process.env.GROQ_API_KEY
    if (!apiKey) return sendJson(res, 500, { error: 'Añade GROQ_API_KEY a las variables de entorno de Vercel.' })
    const model = process.env.GROQ_MODEL || 'openai/gpt-oss-20b'
    const feedback = Array.isArray(req.body.feedback) ? req.body.feedback.slice(0, 100) : []
    const preferences = preferenceContext(feedback, { occasion, season, temperatureC })
    const upstream = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model, temperature: 0.35, reasoning_effort: 'low', max_completion_tokens: 400,
        messages: [
          { role: 'system', content: `Eres estilista personal y trabajas en la etapa "${stage}" de un outfit. Elige EXCLUSIVAMENTE IDs de candidates; no inventes ni repitas prendas. ${stageInstructions[stage]}

PALETA DE COLOR (prioridad alta): planifica el conjunto completo, no cada prenda de forma aislada. Busca normalmente 2 o 3 familias de color distintas: una base y uno o dos acentos. Puedes repetir negro, blanco, beige, gris, camel y otros neutros para dar cohesión, pero evita que todas las prendas repitan el mismo color dominante cuando haya opciones que contrasten bien. Combina tonos con criterio (neutro + color, tonos cercanos o un acento complementario); no fuerces colores que no estén en los datos. Si ya hay prendas elegidas, armoniza con ellas sin alterar sus colores. El calzado, el bolso y los accesorios pueden repetir discretamente un acento. No propongas un look monocromático salvo que las valoraciones indiquen que a la persona le gusta y los tonos tengan variación suficiente.

PERSONALIZACIÓN DEL COLOR: usa personalizedPreferences.likedColorPairs y los pares positivos de similarSituations como evidencia de combinaciones que la persona ha puntuado con 4 o 5. Evita los pares en dislikedColorPairs y los pares negativos de situaciones similares (puntuaciones 1 o 2). Da más peso a la misma ocasión, estación y franja térmica. Una puntuación 3 es neutral; con pocos datos, aplica las reglas generales de paleta y no inventes preferencias.

Considera también situación, comodidad, estación, temperatura y formalidad. Prioriza la sensación térmica para decidir comodidad y capas; adapta calzado y prendas a lluvia, nieve o calor cuando el tiempo lo indique. Usa la ubicación solo para interpretar la estación y el contexto climático. Si faltan descripciones o colores, decide con el nombre y la categoría y no deduzcas un color ausente. Devuelve una razón breve que mencione el equilibrio del look sin afirmar colores que no aparezcan. Responde únicamente con JSON.` },
          { role: 'user', content: JSON.stringify({
            situation: {
              occasion: text(occasion, 80), mood: text(mood, 100),
              temperatureC: temperatureC !== null && temperatureC !== undefined && temperatureC !== '' && Number.isFinite(Number(temperatureC)) ? Number(temperatureC) : null,
              apparentTemperatureC: apparentTemperatureC !== null && apparentTemperatureC !== undefined && apparentTemperatureC !== '' && Number.isFinite(Number(apparentTemperatureC)) ? Number(apparentTemperatureC) : null,
              season: text(season, 30), weather: text(weather, 60), location: text(location, 80), timezone: text(timezone, 80),
            },
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
      const retryMatch = detail.match(/try again in\s+([\d.]+)s/i)
      const retryAfterSeconds = retryMatch ? Math.min(60, Math.max(1, Number(retryMatch[1]))) : null
      return sendJson(res, upstream.status === 429 ? 429 : 502, {
        error: upstream.status === 429 ? `Groq alcanzó su límite durante la etapa ${activeStage}.` : `Groq falló durante la etapa ${activeStage}.`,
        detail,
        ...(retryAfterSeconds ? { retryAfterSeconds } : {}),
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
    if (stage === 'complete') {
      const fullBody = chosen.find(item => item.category === 'Cuerpo completo')
      const top = chosen.find(item => item.category === 'Parte de arriba')
      const bottom = chosen.find(item => item.category === 'Parte de abajo')
      const shoe = chosen.find(item => item.category === 'Calzado')
      if (!shoe || (!fullBody && (!top || !bottom))) {
        return sendJson(res, 502, { error: 'Groq no completó las prendas imprescindibles del outfit. Inténtalo otra vez.' })
      }
      selected = fullBody ? [fullBody] : [top, bottom]
      const outerwear = chosen.find(item => item.category === 'Ropa de abrigo')
      if (outerwear) selected.push(outerwear)
      selected.push(shoe)
      if (!fullBody) selected.push(...chosen.filter(item => item.category === 'Parte de arriba' && item.id !== top.id))
      const bag = chosen.find(item => item.category === 'Bolsos')
      if (bag) selected.push(bag)
      const accessoryCounts = new Map()
      for (const accessory of chosen.filter(item => item.category === 'Accesorios')) {
        const subtype = accessory.subcategory || 'Otros'
        const count = accessoryCounts.get(subtype) || 0
        if (!['Pulseras', 'Anillos'].includes(subtype) && count >= 1) continue
        selected.push(accessory)
        accessoryCounts.set(subtype, count + 1)
      }
      return sendJson(res, 200, { itemIds: selected.map(item => item.id), reason: text(parsed.reason, 300) })
    }
    if (stage === 'base') selected = chosen.filter(item => ['Parte de arriba', 'Cuerpo completo'].includes(item.category)).slice(0, 1)
    if (stage === 'bottom') selected = chosen.filter(item => item.category === 'Parte de abajo').slice(0, 1)
    if (stage === 'outerwear') selected = chosen.filter(item => item.category === 'Ropa de abrigo').slice(0, 1)
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
    if (!['extras', 'outerwear'].includes(stage) && selected.length !== 1) return sendJson(res, 502, { error: 'Groq no pudo elegir una prenda válida para esta etapa. Inténtalo otra vez.' })
    return sendJson(res, 200, { itemIds: selected.map(item => item.id), reason: text(parsed.reason, 300) })
  } catch (error) {
    const detail = text(error.message || 'Error desconocido.', 320)
    console.error('Outfit recommendation failed:', activeStage, detail)
    return sendJson(res, 502, { error: `No se pudo completar la etapa ${activeStage}.`, detail })
  }
}
