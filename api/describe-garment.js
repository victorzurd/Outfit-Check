import { requireUser, sendJson, parseModelJson, readGeminiText } from '../server/ai-utils.js'

const allowedMimeTypes = new Set(['image/jpeg', 'image/png', 'image/webp'])

export default async function handler(req, res) {
  if (req.method !== 'POST') return sendJson(res, 405, { error: 'Método no permitido.' })
  try {
    const auth = await requireUser(req)
    if (auth.error) return sendJson(res, auth.status, { error: auth.error })

    const { imageBase64, mimeType, category, subcategory, name } = req.body || {}
    if (!allowedMimeTypes.has(mimeType) || typeof imageBase64 !== 'string' || imageBase64.length < 100 || imageBase64.length > 1_500_000) {
      return sendJson(res, 400, { error: 'La imagen no es válida o supera el tamaño permitido.' })
    }
    const apiKey = process.env.GEMINI_API_KEY
    if (!apiKey) return sendJson(res, 500, { error: 'Añade GEMINI_API_KEY a las variables de entorno de Vercel.' })

    const prompt = `Analiza exclusivamente la prenda u objeto de moda principal de la imagen para un armario personal. Devuelve SOLO un objeto JSON válido con estas claves: description (descripción detallada en español de lo visible, máximo 450 caracteres), color (color principal y secundarios visibles), pattern (estampado o "liso"), material (solo apariencia visual; usa "no identificable en la imagen" si no se puede saber), fit (corte/silueta visible), style (estilo), formality (uno de "informal", "smart casual", "formal", "deportivo", "fiesta", "desconocido"), seasons (array con estaciones adecuadas), confidence (número de 0 a 1). No inventes marca, composición textil ni características ocultas. Si la foto no permite afirmarlo, dilo claramente. Categoría elegida por la persona: ${String(category || '').slice(0, 40)}. Tipo elegido: ${String(subcategory || '').slice(0, 60)}. Nombre: ${String(name || '').slice(0, 80)}.`

    const models = [...new Set([
      process.env.GEMINI_MODEL || 'gemini-3.8-flash',
      process.env.GEMINI_FALLBACK_MODEL || 'gemini-3.7-flash',
      'gemini-3.5-flash-lite',
    ])]
    let parsed
    let lastFailure = ''
    for (const model of models) {
      try {
        const upstream = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
          body: JSON.stringify({
            contents: [{ parts: [{ inline_data: { mime_type: mimeType, data: imageBase64 } }, { text: prompt }] }],
            generationConfig: {
              responseMimeType: 'application/json', temperature: 0.2, maxOutputTokens: 700,
              ...(!model.includes('flash-lite') ? { thinkingConfig: { thinkingLevel: 'low' } } : {}),
            },
          }),
        })
        const response = await upstream.json().catch(() => ({}))
        if (!upstream.ok) {
          const detail = String(response.error?.message || `Respuesta HTTP ${upstream.status}`).replace(/https?:\/\/\S+/g, '[enlace]').slice(0, 240)
          console.error('Gemini model failed:', model, upstream.status, detail)
          lastFailure = `${model} (${upstream.status}): ${detail}`
          if (upstream.status === 429 || upstream.status >= 500) continue
          return sendJson(res, 502, { error: 'Gemini rechazó la solicitud.', detail })
        }
        parsed = parseModelJson(readGeminiText(response))
        if (typeof parsed.description === 'string' && parsed.description.trim()) break
        lastFailure = `${model}: respuesta sin descripción`
        parsed = null
      } catch (error) {
        lastFailure = `${model}: ${String(error.message || 'error de respuesta').slice(0, 180)}`
        parsed = null
      }
    }
    if (!parsed) {
      console.error('All Gemini models failed:', lastFailure)
      return sendJson(res, 502, { error: 'Gemini no pudo analizar la foto con los modelos disponibles.', detail: lastFailure })
    }
    if (typeof parsed.description !== 'string' || !parsed.description.trim()) throw new Error('Gemini devolvió una descripción vacía.')
    const attributes = {
      pattern: String(parsed.pattern || 'desconocido').slice(0, 100),
      material: String(parsed.material || 'no identificable en la imagen').slice(0, 100),
      fit: String(parsed.fit || 'desconocido').slice(0, 100),
      style: String(parsed.style || 'desconocido').slice(0, 100),
      formality: String(parsed.formality || 'desconocido').slice(0, 40),
      seasons: Array.isArray(parsed.seasons) ? parsed.seasons.map(value => String(value).slice(0, 30)).slice(0, 4) : [],
      confidence: Number.isFinite(Number(parsed.confidence)) ? Math.max(0, Math.min(1, Number(parsed.confidence))) : null,
    }
    return sendJson(res, 200, { description: parsed.description.trim().slice(0, 450), color: String(parsed.color || '').slice(0, 100), attributes })
  } catch (error) {
    console.error('Garment description failed:', error.message)
    return sendJson(res, 502, { error: 'No se pudo interpretar la respuesta de Gemini.', detail: String(error.message || '').slice(0, 240) })
  }
}
