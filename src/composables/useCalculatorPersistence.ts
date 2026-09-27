// @ts-nocheck
import { watch } from 'vue'

export const STORAGE_PREFIX = 'cfk_'

const STORAGE_KEYS = {
    inputMode: `${STORAGE_PREFIX}inputMode`,
    waypoints: `${STORAGE_PREFIX}waypoints`,
    manualKm: `${STORAGE_PREFIX}manualKm`,
    isRoundTrip: `${STORAGE_PREFIX}isRoundTrip`,
    globalToll: `${STORAGE_PREFIX}globalToll`,
    carpoolDestination: `${STORAGE_PREFIX}carpoolDest`,
    participants: `${STORAGE_PREFIX}participants`,
    meetingPoints: `${STORAGE_PREFIX}meetingPoints`,
    visualCarpoolResults: `${STORAGE_PREFIX}visualResults`,
    calcMode: `${STORAGE_PREFIX}calcMode`,
    fuelPrice: `${STORAGE_PREFIX}fuelPrice`,
    fuelConsumption: `${STORAGE_PREFIX}fuelConsumption`,
    baremeRate: `${STORAGE_PREFIX}baremeRate`,
    selectedFuelType: `${STORAGE_PREFIX}selectedFuelType`
}

const serializers = {
    inputMode: String,
    waypoints: JSON.stringify,
    manualKm: String,
    isRoundTrip: String,
    globalToll: String,
    carpoolDestination: JSON.stringify,
    participants: JSON.stringify,
    meetingPoints: JSON.stringify,
    visualCarpoolResults: JSON.stringify,
    calcMode: String,
    fuelPrice: String,
    fuelConsumption: String,
    baremeRate: String,
    selectedFuelType: String
}

export function useCalculatorPersistence({ sharedState = null } = {}) {
    let storageEnabled = !sharedState
    const dirtyFields = new Set()
    let resetInProgress = false

    const isResetInProgress = () => resetInProgress
    const setResetInProgress = (value) => { resetInProgress = value }

    const markDirty = (field) => {
        if (resetInProgress) return
        dirtyFields.add(field)
    }

    const persistField = (field, value) => {
        if (!storageEnabled || resetInProgress || !dirtyFields.has(field)) return
        const serializer = serializers[field] || String
        localStorage.setItem(STORAGE_KEYS[field] || `${STORAGE_PREFIX}${field}`, serializer(value))
        dirtyFields.delete(field)
    }

    const persistDirty = (state) => {
        if (!storageEnabled || resetInProgress) return
        for (const field of [...dirtyFields]) {
            if (field in state) persistField(field, state[field])
        }
    }

    const enableStorage = () => {
        if (resetInProgress) return
        storageEnabled = true
    }

    const markDirtyAndPersist = (field, value) => {
        if (resetInProgress) return
        markDirty(field)
        enableStorage()
        persistField(field, value)
    }

    const isStorageEnabled = () => storageEnabled
    const hasStoredValue = (field) => localStorage.getItem(STORAGE_KEYS[field] || `${STORAGE_PREFIX}${field}`) !== null

    const watchField = (source, field, options = {}) => {
        watch(source, (value) => markDirtyAndPersist(field, value), options)
    }

    const removeAll = () => {
        Object.values(STORAGE_KEYS).forEach(key => localStorage.removeItem(key))
        dirtyFields.clear()
        storageEnabled = false
    }

    return {
        STORAGE_KEYS,
        isResetInProgress,
        setResetInProgress,
        markDirty,
        persistField,
        persistDirty,
        markDirtyAndPersist,
        enableStorage,
        hasStoredValue,
        isStorageEnabled,
        watchField,
        removeAll
    }
}
