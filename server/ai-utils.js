import { createClient } from '@supabase/supabase-js'

const envFirst = (...keys) => keys.map(key => process.env[key]).find(Boolean)

export const sendJson = (res, status, body) => res.status(status).setHeader('Cache-Control', 'no-store').json(body)

export const requireUser = async req => {
  const authorization = req.headers.authorization || ''
  const token = authorization.match(/^Bearer\s+(.+)$/i)?.[1]
  if (!token) return { error: 'Inicia sesión para usar estas funciones.', status: 401 }

  const url = envFirst('SUPABASE_URL', 'STORAGE_SUPABASE_URL', 'STORAGE_VITE_PUBLIC_SUPABASE_URL', 'VITE_SUPABASE_URL')
  const key = envFirst('SUPABASE_PUBLISHABLE_KEY', 'SUPABASE_ANON_KEY', 'STORAGE_SUPABASE_PUBLISHABLE_KEY', 'STORAGE_SUPABASE_ANON_KEY', 'STORAGE_VITE_PUBLIC_SUPABASE_PUBLISHABLE_KEY', 'STORAGE_VITE_PUBLIC_SUPABASE_ANON_KEY', 'VITE_SUPABASE_ANON_KEY')
  if (!url || !key) return { error: 'Falta configurar la URL y la clave pública de Supabase en Vercel.', status: 500 }

  const client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
  const { data, error } = await client.auth.getUser(token)
  if (error || !data.user) return { error: 'La sesión ha caducado. Vuelve a iniciar sesión.', status: 401 }
  return { user: data.user }
}

export const parseModelJson = value => {
  const text = String(value || '').trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '')
  return JSON.parse(text)
}

export const readGeminiText = payload => (payload?.candidates?.[0]?.content?.parts || []).map(part => part.text || '').join('').trim()
