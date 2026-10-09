export const categories = ['Parte de arriba', 'Parte de abajo', 'Cuerpo completo', 'Calzado', 'Bolsos', 'Accesorios']
export const accessoryTypes = ['Pendientes', 'Pulseras', 'Collares', 'Anillos', 'Relojes', 'Cinturones', 'Sombreros', 'Bufandas', 'Gafas', 'Otros']
export const singleWearAccessories = new Set(['Pendientes', 'Collares', 'Relojes', 'Cinturones', 'Sombreros', 'Bufandas', 'Gafas', 'Otros'])
export const itemTypes = {
  'Parte de arriba': ['Camiseta', 'Camisa', 'Blusa', 'Top', 'Jersey', 'Sudadera', 'Chaqueta', 'Abrigo', 'Chaleco', 'Otros'],
  'Parte de abajo': ['Pantalón', 'Vaquero', 'Falda', 'Shorts', 'Leggings', 'Otros'],
  'Cuerpo completo': ['Vestido', 'Mono', 'Peto', 'Otros'],
  Calzado: ['Zapatillas', 'Deportivas', 'Sandalias', 'Botas', 'Botines', 'Tacones', 'Mocasines', 'Bailarinas', 'Chanclas', 'Zapatos', 'Otros'],
  Accesorios: accessoryTypes,
}
export const styleDimensions = ['comfort', 'casual', 'polished', 'formal', 'practical', 'festive']
export const occasionStyleProfiles = {
  Diario: { comfort: 0.8, casual: 1, practical: 0.3 },
  Trabajo: { polished: 0.9, formal: 0.45, practical: 0.25 },
  Universidad: { comfort: 0.75, casual: 0.8, practical: 0.3 },
  Cena: { polished: 0.85, formal: 0.5, festive: 0.25 },
  Brunch: { comfort: 0.35, casual: 0.6, polished: 0.4 },
  Fiesta: { polished: 0.45, formal: 0.45, festive: 1 },
  Viaje: { comfort: 0.9, practical: 1, casual: 0.45 },
}
export const moodStyleSignals = [
  { terms: ['comod', 'confort', 'relajad', 'practic', 'andar'], profile: { comfort: 0.8, practical: 0.5 } },
  { terms: ['elegant', 'arreglad', 'chic', 'sofisticad', 'formal'], profile: { polished: 0.8, formal: 0.7 } },
  { terms: ['casual', 'informal', 'sencill', 'diario'], profile: { casual: 0.7 } },
  { terms: ['atrevid', 'especial', 'fiesta', 'festiv'], profile: { festive: 0.8, polished: 0.2 } },
  { terms: ['deportiv', 'sport'], profile: { comfort: 0.6, practical: 0.6, casual: 0.5 } },
]
export const subtypeStyleProfiles = {
  Calzado: {
    Zapatillas: { comfort: 1, casual: 1, practical: 0.35, polished: -0.35, formal: -0.5 },
    Deportivas: { comfort: 1, casual: 0.8, practical: 0.7, polished: -0.45, formal: -0.65 },
    Sandalias: { comfort: 0.4, casual: 0.5, polished: 0.25, practical: 0.15 },
    Botas: { practical: 0.65, polished: 0.2, formal: 0.1 },
    Botines: { practical: 0.35, polished: 0.45, formal: 0.15 },
    Tacones: { polished: 1, formal: 0.8, festive: 0.45, comfort: -0.7, practical: -0.6 },
    Mocasines: { comfort: 0.35, polished: 0.7, formal: 0.35, practical: 0.2 },
    Bailarinas: { comfort: 0.45, polished: 0.4, casual: 0.25 },
    Chanclas: { comfort: 0.5, casual: 0.8, practical: 0.1, polished: -0.8, formal: -0.8 },
    Zapatos: { polished: 0.75, formal: 0.7, practical: 0.1, comfort: -0.15 },
  },
  'Parte de arriba': {
    Camiseta: { comfort: 0.5, casual: 0.8 }, Camisa: { polished: 0.65, formal: 0.25 },
    Blusa: { polished: 0.7, formal: 0.25 }, Top: { casual: 0.55, festive: 0.35 },
    Jersey: { comfort: 0.8, casual: 0.35 }, Sudadera: { comfort: 0.8, casual: 0.9, polished: -0.35 },
    Chaqueta: { polished: 0.35, practical: 0.55 }, Abrigo: { practical: 0.85, polished: 0.25 }, Chaleco: { polished: 0.3 },
  },
  'Parte de abajo': {
    Pantalón: { practical: 0.25, polished: 0.15 }, Vaquero: { comfort: 0.4, casual: 0.8, formal: -0.45 },
    Falda: { polished: 0.45, festive: 0.2 }, Shorts: { comfort: 0.35, casual: 0.8, formal: -0.6 },
    Leggings: { comfort: 0.9, casual: 0.65, practical: 0.2, polished: -0.25 },
  },
  'Cuerpo completo': {
    Vestido: { polished: 0.5, festive: 0.25 }, Mono: { polished: 0.3, practical: 0.2 }, Peto: { casual: 0.7, comfort: 0.35 },
  },
}
export const defaultSubcategory = category => itemTypes[category]?.[0] || ''
export const occasions = ['Diario', 'Trabajo', 'Universidad', 'Cena', 'Brunch', 'Fiesta', 'Viaje']
