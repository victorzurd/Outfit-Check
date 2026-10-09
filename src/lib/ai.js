import { supabase } from './supabase.js'

export const callAiEndpoint = async (endpoint, body) => {
  if (!supabase) throw new Error('Conecta Supabase para usar la IA.')
  const { data: { session: activeSession } } = await supabase.auth.getSession()
  if (!activeSession?.access_token) throw new Error('Inicia sesión para usar la IA.')
  const sendRequest = () => fetch(`/api/${endpoint}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${activeSession.access_token}` },
    body: JSON.stringify(body),
  })
  let response = await sendRequest()
  let result = await response.json().catch(() => ({}))
  if (response.status === 429 && Number.isFinite(Number(result.retryAfterSeconds))) {
    const delayMs = Math.min(60, Math.max(1, Number(result.retryAfterSeconds) + 1)) * 1000
    await new Promise(resolve => window.setTimeout(resolve, delayMs))
    response = await sendRequest()
    result = await response.json().catch(() => ({}))
  }
  if (!response.ok) throw new Error([result.error, result.detail].filter(Boolean).join(' · ') || 'No se pudo completar la solicitud de IA.')
  return result
}
