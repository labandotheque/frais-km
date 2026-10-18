// @ts-nocheck
import { watch } from 'vue'
import { toPlainState } from '../utils/sharing'

export const STORAGE_PREFIX = 'cfk_'

// Un seul tableau pour tous les champs sauvegardés :
//   key  : nom de la clé de stockage quand il diffère du champ (cfk_<champ> sinon)
//   json : valeur structurée (sérialisée en JSON, sans les champs d'interface), sinon String(valeur)
// Un champ absent d'ici est quand même sauvegardé (cfk_<champ>, en texte) mais ne serait pas effacé par removeAll :
// ajouter ici tout nouveau champ persisté (c'était le cas de `tripMode`, qui survivait à la remise à zéro).
const FIELDS = {
    inputMode: {},
    waypoints: { json: true },
    manualKm: {},
    isRoundTrip: {},
    globalToll: {},
    carpoolDestination: { key: 'carpoolDest', json: true },
    participants: { json: true },
    meetingPoints: { json: true },
    visualCarpoolResults: { key: 'visualResults', json: true },
    tripMode: {},
    calcMode: {},
    fuelPrice: {},
    fuelConsumption: {},
    baremeRate: {},
    selectedFuelType: {}
}

const storageKey = (field) => `${STORAGE_PREFIX}${FIELDS[field]?.key ?? field}`
const serialize = (field, value) => FIELDS[field]?.json ? JSON.stringify(toPlainState(field, value)) : String(value)

const STORAGE_KEYS = Object.fromEntries(Object.keys(FIELDS).map(field => [field, storageKey(field)]))

export function useCalculatorPersistence({ sharedState = null } = {}) {
    // Avec un lien de partage, rien n'est écrit tant que l'utilisateur n'a pas modifié un champ (voir markDirtyAndPersist)
    let storageEnabled = !sharedState
    let resetInProgress = false
    const dirtyFields = new Set()

    const isResetInProgress = () => resetInProgress
    const setResetInProgress = (value) => { resetInProgress = value }
    const isStorageEnabled = () => storageEnabled

    const markDirty = (field) => {
        if (!resetInProgress) dirtyFields.add(field)
    }

    const persistField = (field, value) => {
        if (!storageEnabled || resetInProgress || !dirtyFields.has(field)) return
        try {
            localStorage.setItem(storageKey(field), serialize(field, value))
            dirtyFields.delete(field)
        } catch (err) {
            // quota dépassé, navigation privée… : on ne casse pas l'application pour une sauvegarde
            console.warn(`Sauvegarde impossible (${field})`, err)
        }
    }

    const persistDirty = (state) => {
        if (!storageEnabled || resetInProgress) return
        for (const field of [...dirtyFields]) {
            if (field in state) persistField(field, state[field])
        }
    }

    const enableStorage = () => {
        if (!resetInProgress) storageEnabled = true
    }

    const markDirtyAndPersist = (field, value) => {
        if (resetInProgress) return
        markDirty(field)
        enableStorage()
        persistField(field, value)
    }

    const hasStoredValue = (field) => localStorage.getItem(storageKey(field)) !== null

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