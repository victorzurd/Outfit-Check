const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { ...corsHeaders, 'Content-Type': 'application/json' },
})

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (request.method !== 'POST') return json({ error: 'Método no permitido.' }, 405)

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  const fashnKey = Deno.env.get('FASHN_API_KEY')
  const authorization = request.headers.get('Authorization')
  if (!supabaseUrl || !anonKey || !serviceRoleKey || !fashnKey) return json({ error: 'Falta configurar la función de prueba virtual.' }, 503)
  if (!authorization?.startsWith('Bearer ')) return json({ error: 'Inicia sesión para usar esta función.' }, 401)

  // Verify the caller with Supabase Auth; never accept identity supplied in the body.
  const authResponse = await fetch(`${supabaseUrl}/auth/v1/user`, {
    headers: { apikey: anonKey, Authorization: authorization },
  })
  if (!authResponse.ok) return json({ error: 'Tu sesión no es válida. Vuelve a iniciar sesión.' }, 401)

  let input: { modelImage?: unknown; garmentImage?: unknown; category?: unknown }
  try { input = await request.json() } catch { return json({ error: 'La solicitud no tiene un formato válido.' }, 400) }

  const isImage = (value: unknown) => typeof value === 'string' && (
    /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(value) ||
    value.startsWith('https://')
  )
  if (!isImage(input.modelImage) || !isImage(input.garmentImage)) {
    return json({ error: 'Sube una foto válida de la persona y selecciona una imagen de prenda.' }, 400)
  }

  const modelImage = input.modelImage as string
  const garmentImage = input.garmentImage as string
  if (modelImage.length > 7_000_000 || garmentImage.length > 7_000_000) {
    return json({ error: 'La foto es demasiado grande. Prueba con una imagen más pequeña.' }, 413)
  }
  if (modelImage.startsWith('https://')) {
    return json({ error: 'La foto personal se envía en formato temporal para proteger mejor tu privacidad.' }, 400)
  }

  if (garmentImage.startsWith('https://')) {
    let garmentUrl: URL
    try { garmentUrl = new URL(garmentImage) } catch { return json({ error: 'La imagen de la prenda no es válida.' }, 400) }
    const storageOrigin = new URL(supabaseUrl).origin
    const fromWardrobeStorage = garmentUrl.origin === storageOrigin && garmentUrl.pathname.startsWith('/storage/v1/object/public/wardrobe-photos/')
    const fromExampleCatalog = garmentUrl.hostname === 'images.unsplash.com'
    if (!fromWardrobeStorage && !fromExampleCatalog) return json({ error: 'La prenda debe ser una foto subida a tu armario.' }, 400)
  }

  try {
    const userResponse = await authResponse.json()
    const quotaResponse = await fetch(`${supabaseUrl}/rest/v1/rpc/reserve_virtual_tryon`, {
      method: 'POST',
      headers: { apikey: serviceRoleKey, Authorization: `Bearer ${serviceRoleKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ p_user_id: userResponse.id }),
    })
    if (!quotaResponse.ok) {
      const quotaError = await quotaResponse.text()
      if (quotaError.includes('daily_limit_reached')) return json({ error: 'Has alcanzado el límite de 3 pruebas virtuales de hoy.' }, 429)
      return json({ error: 'No se pudo comprobar el límite diario de pruebas.' }, 503)
    }

    const startResponse = await fetch('https://api.fashn.ai/v1/run', {
      method: 'POST',
      headers: { Authorization: `Bearer ${fashnKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model_name: 'tryon-v1.6',
        inputs: {
          model_image: modelImage,
          garment_image: garmentImage,
          category: ['tops', 'bottoms', 'one-pieces'].includes(String(input.category)) ? input.category : 'auto',
          mode: 'balanced',
          num_samples: 1,
          output_format: 'jpeg',
          return_base64: true,
          moderation_level: 'conservative',
        },
      }),
    })
    const start = await startResponse.json()
    if (!startResponse.ok || start.error || !start.id) {
      return json({ error: start.message || start.error || 'El proveedor no pudo iniciar la prueba virtual.' }, startResponse.status >= 400 ? 502 : 502)
    }

    // Keep the result in memory and request a short-lived base64 output. Nothing is stored in Supabase.
    for (let attempt = 0; attempt < 35; attempt++) {
      await new Promise(resolve => setTimeout(resolve, 1_500))
      const statusResponse = await fetch(`https://api.fashn.ai/v1/status/${encodeURIComponent(start.id)}`, {
        headers: { Authorization: `Bearer ${fashnKey}` },
      })
      const status = await statusResponse.json()
      if (!statusResponse.ok) return json({ error: 'No se pudo consultar el resultado de la prueba.' }, 502)
      if (status.status === 'completed' && Array.isArray(status.output) && status.output[0]) {
        return json({ image: status.output[0] })
      }
      if (status.status === 'failed') return json({ error: status.error?.message || 'No se pudo procesar esta combinación. Prueba con otra foto.' }, 422)
    }
    return json({ error: 'La prueba está tardando más de lo esperado. Inténtalo de nuevo en un momento.' }, 504)
  } catch {
    return json({ error: 'No se pudo conectar con el proveedor de prueba virtual.' }, 502)
  }
})
