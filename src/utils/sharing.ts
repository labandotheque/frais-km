// @ts-nocheck

const commonKeys = [
  'isRoundTrip',
  'calcMode'
]

const viewKeys = {
  cities: ['waypoints', 'globalToll'],
  km: ['manualKm', 'globalToll'],
  carpool: ['carpoolDestination', 'participants', 'meetingPoints']
}

const calculationKeys = {
  bareme: ['baremeRate'],
  reels: ['fuelPrice', 'fuelConsumption', 'selectedFuelType']
}

const sharedKeys = [
  ...commonKeys,
  ...viewKeys.cities,
  ...viewKeys.km,
  ...viewKeys.carpool,
  ...calculationKeys.bareme,
  ...calculationKeys.reels
]

const getSharedKeys = (inputMode, calcMode) => [
  ...commonKeys,
  ...(viewKeys[inputMode] || []),
  ...(calculationKeys[calcMode] || calculationKeys.bareme)
]

export function serializeCalculatorState(state, inputMode) {
  const params = new URLSearchParams()
  const keys = getSharedKeys(inputMode, state.calcMode)

  keys.forEach((key) => {
    const value = state[key]
    if (value === undefined || value === null) return
    if (Array.isArray(value) || typeof value === 'object') {
      params.set(key, JSON.stringify(value))
    } else {
      params.set(key, String(value))
    }
  })

  return params
}

export function parseCalculatorState(search) {
  const params = new URLSearchParams(search)
  const state = {}
  let hasState = false

  sharedKeys.forEach((key) => {
    const rawValue = params.get(key)
    if (rawValue === null) return

    hasState = true
    if (key === 'isRoundTrip') {
      state[key] = rawValue === 'true' || rawValue === '1'
      return
    }

    if (['manualKm', 'globalToll', 'fuelPrice', 'fuelConsumption', 'baremeRate'].includes(key)) {
      state[key] = Number(rawValue) || 0
      return
    }

    if (['waypoints', 'carpoolDestination', 'participants', 'meetingPoints'].includes(key)) {
      try {
        state[key] = JSON.parse(rawValue)
      } catch {
        return
      }
      return
    }

    state[key] = rawValue
  })

  return hasState ? state : null
}
