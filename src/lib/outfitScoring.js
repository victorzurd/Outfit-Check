import { moodStyleSignals, occasionStyleProfiles, styleDimensions, subtypeStyleProfiles } from '../data/catalog.js'

export const shuffle = list => [...list].sort(() => Math.random() - 0.5)
export const normalizeMatchText = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('es')
export const getStyleContext = situation => {
  const profile = Object.fromEntries(styleDimensions.map(dimension => [dimension, occasionStyleProfiles[situation.occasion]?.[dimension] || 0]))
  const mood = normalizeMatchText(situation.mood)
  for (const signal of moodStyleSignals) {
    if (signal.terms.some(term => mood.includes(normalizeMatchText(term)))) {
      for (const [dimension, value] of Object.entries(signal.profile)) profile[dimension] += value
    }
  }
  return profile
}
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
const neutralColorFamilies = new Set(['neutro', 'metalizado'])
export const colorFamiliesFor = item => {
  const attributes = item?.aiAttributes || item?.attributes || {}
  const color = normalizeMatchText(item?.color || attributes.color || '')
  if (!color) return []
  return Object.entries(colorFamilyAliases)
    .filter(([, aliases]) => aliases.some(alias => color.split(/[^a-z]+/).includes(normalizeMatchText(alias))))
    .map(([family]) => family)
}
export const colorToneFor = item => normalizeMatchText(item?.color || item?.aiAttributes?.color || item?.attributes?.color || '').trim()
export const colorPairKey = (first, second) => [first, second].sort().join('|')
export const temperatureBandFor = temperature => {
  if (temperature === null || temperature === undefined || temperature === '') return ''
  const value = Number(temperature)
  if (!Number.isFinite(value)) return ''
  return value < 10 ? 'frio' : value < 20 ? 'templado' : value < 28 ? 'calido' : 'caluroso'
}
export const buildRatedColorPreferences = (feedback, situation) => {
  const familyTallies = new Map()
  const pairTallies = new Map()
  const add = (map, key, value, weight) => {
    const tally = map.get(key) || { total: 0, weight: 0 }
    tally.total += value * weight
    tally.weight += weight
    map.set(key, tally)
  }
  const targetBand = temperatureBandFor(situation.temperatureC)
  for (const [index, entry] of (Array.isArray(feedback) ? feedback : []).slice(0, 100).entries()) {
    const rating = Number(entry.rating)
    if (!Number.isFinite(rating) || rating === 3 || rating < 1 || rating > 5) continue
    const outfits = (entry.outfit || entry.outfit_snapshot || entry.outfitSnapshot || []).slice(0, 8)
    const itemFamilies = outfits.map(colorFamiliesFor)
    const families = [...new Set(itemFamilies.flat())]
    if (!families.length) continue
    const entryTemperature = entry.temperatureC ?? entry.temperature_c
    const weight = (1 + (entry.occasion === situation.occasion ? 0.75 : 0)
      + (entry.season && entry.season === situation.season ? 0.35 : 0)
      + (targetBand && temperatureBandFor(entryTemperature) === targetBand ? 0.25 : 0))
      * Math.max(0.45, 1 - index * 0.02)
    for (const family of families) add(familyTallies, family, rating - 3, weight)
    const outfitPairs = new Set()
    for (let first = 0; first < itemFamilies.length; first += 1) {
      for (let second = first + 1; second < itemFamilies.length; second += 1) {
        for (const firstFamily of itemFamilies[first]) for (const secondFamily of itemFamilies[second]) {
          outfitPairs.add(colorPairKey(firstFamily, secondFamily))
        }
      }
    }
    for (const pair of outfitPairs) add(pairTallies, pair, rating - 3, weight)
  }
  const values = tallies => new Map([...tallies.entries()].map(([key, tally]) => [key, tally.total / tally.weight]))
  return { families: values(familyTallies), pairs: values(pairTallies) }
}
export const paletteHarmonyScore = (first, second, firstTone = '', secondTone = '') => {
  if (first === second) {
    if (!neutralColorFamilies.has(first)) return -1.6
    return firstTone && firstTone === secondTone ? -0.65 : 0.25
  }
  if (neutralColorFamilies.has(first) && neutralColorFamilies.has(second)) return 0.25
  if (neutralColorFamilies.has(first) || neutralColorFamilies.has(second)) return 0.8
  return 0.45
}
export const shortlistAiCandidates = (candidates, stage, situation, selected, feedback) => {
  const limits = { base: 12, bottom: 9, footwear: 9, extras: 12 }
  const styleContext = getStyleContext(situation)
  const colorPreferences = buildRatedColorPreferences(feedback, situation)
  const preferenceScores = new Map()
  for (const entry of feedback) {
    const rating = Number(entry.rating)
    if (!Number.isFinite(rating) || rating === 3) continue
    const weight = (entry.occasion === situation.occasion ? 2 : 1) + (situation.season && entry.season === situation.season ? 1 : 0)
    const value = (rating - 3) * weight
    for (const item of entry.outfit || entry.outfit_snapshot || entry.outfitSnapshot || []) {
      const attrs = item.attributes || item
      const features = [
        item.category && item.subcategory ? `type:${normalizeMatchText(item.category)}:${normalizeMatchText(item.subcategory)}` : '',
        attrs.style ? `style:${normalizeMatchText(attrs.style)}` : '',
        attrs.pattern ? `pattern:${normalizeMatchText(attrs.pattern)}` : '',
        attrs.formality ? `formality:${normalizeMatchText(attrs.formality)}` : '',
      ].filter(Boolean)
      for (const feature of features) preferenceScores.set(feature, (preferenceScores.get(feature) || 0) + value)
    }
  }
  const contextWords = normalizeMatchText(`${situation.occasion} ${situation.mood}`).split(/[^a-z0-9]+/).filter(word => word.length > 3)
  const scored = candidates.map(item => {
    const attrs = item.aiAttributes || item.attributes || {}
    const seasonNames = (attrs.seasons || []).map(normalizeMatchText)
    let score = 0
    const subtypeProfile = subtypeStyleProfiles[item.category]?.[item.subcategory]
    if (subtypeProfile) {
      score += styleDimensions.reduce((total, dimension) => total + (styleContext[dimension] || 0) * (subtypeProfile[dimension] || 0), 0) * 3
    }
    if (situation.season && seasonNames.includes(normalizeMatchText(situation.season))) score += 4
    if (Number.isFinite(Number(situation.temperatureC)) && seasonNames.length) {
      const expectedSeason = Number(situation.temperatureC) < 10 ? 'invierno' : Number(situation.temperatureC) > 25 ? 'verano' : ''
      if (expectedSeason && seasonNames.includes(expectedSeason)) score += 2
    }
    const styleText = normalizeMatchText(`${attrs.style || ''} ${attrs.formality || ''} ${item.description || ''}`)
    score += contextWords.filter(word => styleText.includes(word)).length * 1.5
    const itemFeatures = [
      item.category && item.subcategory ? `type:${normalizeMatchText(item.category)}:${normalizeMatchText(item.subcategory)}` : '',
      attrs.style ? `style:${normalizeMatchText(attrs.style)}` : '',
      attrs.pattern ? `pattern:${normalizeMatchText(attrs.pattern)}` : '',
      attrs.formality ? `formality:${normalizeMatchText(attrs.formality)}` : '',
    ].filter(Boolean)
    score += itemFeatures.reduce((total, feature) => total + (preferenceScores.get(feature) || 0), 0)
    const families = colorFamiliesFor(item)
    score += families.reduce((total, family) => total + (colorPreferences.families.get(family) || 0) * 0.7, 0)
    const colorRelations = selected.flatMap(chosen => colorFamiliesFor(chosen).flatMap(chosenFamily => families.map(family => ({
      chosenFamily, family, chosenTone: colorToneFor(chosen), tone: colorToneFor(item),
    }))))
    if (colorRelations.length) {
      score += colorRelations.reduce((total, pair) => total + paletteHarmonyScore(pair.chosenFamily, pair.family, pair.chosenTone, pair.tone), 0) / colorRelations.length * 1.8
      score += colorRelations.reduce((total, pair) => total + (colorPreferences.pairs.get(colorPairKey(pair.chosenFamily, pair.family)) || 0), 0) / colorRelations.length * 1.8
    }
    return { item, score, tie: Math.random() }
  }).sort((a, b) => b.score - a.score || a.tie - b.tie)

  const groups = new Map()
  for (const entry of scored) {
    const key = `${entry.item.category}|${entry.item.subcategory || 'Otros'}`
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key).push(entry.item)
  }
  const pools = [...groups.values()]
  const shortlist = []
  while (shortlist.length < limits[stage] && pools.some(pool => pool.length)) {
    for (const pool of pools) if (pool.length && shortlist.length < limits[stage]) shortlist.push(pool.shift())
  }
  return shortlist
}
export const compactAiItem = item => ({
  id: String(item.id), name: item.name, category: item.category, subcategory: item.subcategory || '',
  color: item.color || (item.aiAttributes || item.attributes)?.color || '', description: String(item.description || '').slice(0, 180),
  attributes: Object.fromEntries(['style', 'pattern', 'formality', 'seasons', 'fit'].filter(key => (item.aiAttributes || item.attributes)?.[key] != null).map(key => [key, (item.aiAttributes || item.attributes)[key]])),
})
