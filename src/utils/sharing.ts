// @ts-nocheck
// Partage par URL (et format de sauvegarde) de l'état du calculateur.

const COMMON_KEYS = ['isRoundTrip']

const VIEW_KEYS = {
  cities: ['waypoints', 'globalToll'],
  km: ['manualKm', 'globalToll'],
  carpool: ['carpoolDestination', 'participants', 'meetingPoints']
}

const CALCULATION_KEYS = {
  bareme: ['baremeRate'],
  reels: ['fuelPrice', 'fuelConsumption', 'selectedFuelType']
}

const SHARED_KEYS = new Set([
  ...COMMON_KEYS, ...Object.values(VIEW_KEYS).flat(), ...Object.values(CALCULATION_KEYS).flat()
])

const NUMBER_KEYS = new Set(['manualKm', 'globalToll', 'fuelPrice', 'fuelConsumption', 'baremeRate'])
const JSON_KEYS = new Set(['waypoints', 'carpoolDestination', 'participants', 'meetingPoints'])

const getSharedKeys = (inputMode, calcMode) => [
  ...COMMON_KEYS,
  ...(VIEW_KEYS[inputMode] || []),
  ...(CALCULATION_KEYS[calcMode] || CALCULATION_KEYS.bareme)
]

// ───────── État « à plat » : on retire ce qui n'a de sens que dans l'interface (suggestions d'adresse, ligne surlignée,
// drapeau de saisie…). Un champ d'adresse peut contenir jusqu'à 6 résultats de recherche : sans ce tri, les URL de partage
// et le localStorage gonflent pour rien. Les chargeurs reconstruisent ces champs, rien n'est perdu.
const addressOf = (f) => ({ query: f.query, coords: f.coords })

const PLAIN = {
  waypoints: (list) => list.map(addressOf),
  carpoolDestination: addressOf,
  participants: (list) => list.map(p => ({
    id: p.id, name: p.name, ...addressOf(p),
    consumption: p.consumption, fuelPrice: p.fuelPrice, fuelType: p.fuelType, toll: p.toll
  })),
  meetingPoints: (list) => list.map(mp => ({
    ...addressOf(mp), participations: mp.participations, selectedDriver: mp.selectedDriver, keyed: mp.keyed
  }))
}

export const toPlainState = (key, value) => (value && PLAIN[key] ? PLAIN[key](value) : value)

export function serializeCalculatorState(state, inputMode) {
  const params = new URLSearchParams()

  if (state.calcMode === 'bareme' || state.calcMode === 'reels') {
    params.set('mode', state.calcMode)
  }

  getSharedKeys(inputMode, state.calcMode).forEach((key) => {
    const value = state[key]
    if (value === undefined || value === null) return
    params.set(key, typeof value === 'object' ? JSON.stringify(toPlainState(key, value)) : String(value))
  })

  return params
}

// Renvoie undefined quand la valeur est inutilisable (JSON invalide) : le champ est alors ignoré.
function parseValue(key, rawValue) {
  if (key === 'isRoundTrip') return rawValue === 'true' || rawValue === '1'
  if (NUMBER_KEYS.has(key)) return Number(rawValue) || 0
  if (JSON_KEYS.has(key)) {
    try { return JSON.parse(rawValue) } catch { return undefined }
  }
  return rawValue
}

/**
 * @returns l'état partagé, ou null s'il n'y a rien dans l'URL.
 * NB : `?mode=reels` seul renvoie `{ calcMode: 'reels' }` (donc non nul) : c'est un réglage d'affichage, pas un
 * lien de partage. L'appelant (useCalculator) fait la différence via `hasSharedData`.
 */
export function parseCalculatorState(search) {
  const params = new URLSearchParams(search)
  const state = {}

  SHARED_KEYS.forEach((key) => {
    const rawValue = params.get(key)
    if (rawValue === null) return
    const value = parseValue(key, rawValue)
    if (value !== undefined) state[key] = value
  })

  const mode = params.get('mode')
  if (mode === 'bareme' || mode === 'reels') state.calcMode = mode

  return Object.keys(state).length > 0 ? state : null
}