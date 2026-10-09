export const seasonForLatitude = (latitude, localDate = new Date()) => {
  const month = localDate instanceof Date ? localDate.getMonth() : Number(String(localDate).slice(5, 7)) - 1
  const northSeason = month === 11 || month <= 1 ? 'Invierno' : month <= 4 ? 'Primavera' : month <= 7 ? 'Verano' : 'Otoño'
  if (!(Number.isFinite(latitude) && latitude < 0)) return northSeason
  return { Invierno: 'Verano', Verano: 'Invierno', Primavera: 'Otoño', Otoño: 'Primavera' }[northSeason]
}
export const weatherDescription = code => code === 0 ? 'Despejado' : code <= 3 ? 'Nubes y claros' : code <= 48 ? 'Niebla' : code <= 67 ? 'Lluvia' : code <= 77 ? 'Nieve' : code <= 82 ? 'Chubascos' : code <= 99 ? 'Tormenta' : 'Tiempo actual'
export const cityFromCoordinates = async ({ latitude, longitude }) => {
  try {
    const params = new URLSearchParams({ latitude: String(latitude), longitude: String(longitude), localityLanguage: 'es' })
    const response = await fetch(`https://api.bigdatacloud.net/data/reverse-geocode-client?${params}`)
    if (!response.ok) return ''
    const place = await response.json()
    return String(place.city || place.locality || place.principalSubdivision || '').trim()
  } catch {
    return ''
  }
}
