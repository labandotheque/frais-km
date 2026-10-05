// @ts-nocheck
import { toRaw } from 'vue'
import { safeFetchJson } from '../services/api'
import { formatAddress, sortByScore } from '../utils/formatting'

const GEOCODE_URL = 'https://api-adresse.data.gouv.fr/search/'
const SEARCH_DELAY = 150

export function useCalculatorAddress({ waypoints, carpoolDestination, participants, meetingPoints, handleCalculate, debouncedRunVisualCarpool }) {
    // État de recherche gardé hors de l'objet réactif (donc hors persistance) : timer, requête en cours, etc.
    const searchStates = new WeakMap()
    const stateOf = (field) => {
        const raw = toRaw(field)
        let s = searchStates.get(raw)
        if (!s) { s = { timer: null, token: 0, pending: null, flush: null, release: null }; searchStates.set(raw, s) }
        return s
    }

    const cancelSearch = (field) => {
        const s = stateOf(field)
        clearTimeout(s.timer)
        s.token++                       // une réponse déjà en vol sera ignorée
        s.pending = null
        s.flush = null
        s.release?.()                   // libère ceux qui attendaient cette recherche
        s.release = null
    }

    const searchAddress = (field) => {
        cancelSearch(field)
        field.edited = true              // texte modifié à la main : plus considéré comme validé tant qu'on n'a pas choisi
        field.selectedIndex = -1
        const q = (field.query || '').trim()
        if (q.length < 2) { field.suggestions = []; return }

        const s = stateOf(field)
        const token = s.token
        s.pending = new Promise((resolve) => {
            const run = async () => {
                clearTimeout(s.timer)
                s.flush = null
                try {
                    const data = await safeFetchJson(`${GEOCODE_URL}?q=${encodeURIComponent(q)}&limit=6`)
                    if (token === s.token) {
                        field.suggestions = data && data.features ? sortByScore(data.features) : []
                        field.selectedIndex = -1
                    }
                } finally {
                    if (token === s.token) s.pending = null
                    resolve()
                }
            }
            s.release = resolve
            s.flush = run
            s.timer = setTimeout(run, SEARCH_DELAY)
        })
    }

    const navigateAddress = (field, direction) => {
        if (!field.suggestions.length) return
        field.selectedIndex = (field.selectedIndex + direction + field.suggestions.length) % field.suggestions.length
    }

    const selectAddress = (field, item, onSelected) => {
        cancelSearch(field)
        field.edited = false
        field.query = formatAddress(item)
        field.coords = { lat: item.geometry.coordinates[1], lon: item.geometry.coordinates[0] }
        field.suggestions = []
        field.selectedIndex = -1
        if (onSelected) onSelected()
    }

    const handleAddressEnter = async (field, onSelected) => {
        let target = null
        if (field.selectedIndex >= 0 && field.suggestions[field.selectedIndex]) target = field.suggestions[field.selectedIndex]
        else if (field.suggestions.length > 0) target = field.suggestions[0]
        if (target) { selectAddress(field, target, onSelected); return }
        cancelSearch(field)
        const q = (field.query || '').trim()
        if (q.length >= 2) {
            const data = await safeFetchJson(`${GEOCODE_URL}?q=${encodeURIComponent(q)}&limit=1`)
            if (data && data.features && data.features.length > 0) selectAddress(field, data.features[0], onSelected)
        }
    }

    // Entrée / blur : valide la suggestion surlignée (ou la 1re) en attendant le fetch en cours.
    const commitFirstSuggestion = async (field, onSelected) => {
        const q = (field.query || '').trim()
        if (q.length < 2 || (field.coords && !field.edited)) { field.suggestions = []; return }   // vide ou déjà validé

        const s = stateOf(field)
        s.flush?.()                                   // si on est encore dans le debounce, on lance le fetch tout de suite
        if (s.pending) await s.pending
        if ((field.query || '').trim() !== q || (field.coords && !field.edited)) return   // retapé ou déjà choisi pendant l'attente

        const target = field.suggestions[field.selectedIndex] || field.suggestions[0]
        if (target) selectAddress(field, target, onSelected)
        else field.suggestions = []
    }

    const handleFieldBlur = (field) => {
        setTimeout(() => {
            cancelSearch(field)
            field.suggestions = []
            field.selectedIndex = -1
        }, 150)
    }

    const handleFieldEscape = (field) => {
        cancelSearch(field)
        field.suggestions = []
        field.selectedIndex = -1
    }

    // Ne pas annuler la recherche : un blur en cours attend peut-être encore son résultat pour valider.
    const hideSuggestions = (field) => {
        field.suggestions = []
        field.selectedIndex = -1
    }

    const closeAllSuggestions = () => {
        waypoints.value.forEach(hideSuggestions)
        participants.value.forEach(hideSuggestions)
        meetingPoints.value.forEach(hideSuggestions)
        hideSuggestions(carpoolDestination.value)
    }

    const handleDocumentClick = (event) => {
        const target = event.target
        if (target instanceof HTMLElement && target.closest('input[autocomplete="off"]')) return
        closeAllSuggestions()
    }

    const searchLocation = (index) => {
        const wp = waypoints.value[index]
        wp.coords = null                 // dès qu'on retape, la ville n'est plus validée
        searchAddress(wp)
    }
    const navigateSuggestions = (index, direction) => navigateAddress(waypoints.value[index], direction)
    const selectLocation = (index, item) => selectAddress(waypoints.value[index], item, handleCalculate)
    const handleWaypointEnter = (index) => commitFirstSuggestion(waypoints.value[index], handleCalculate)
    const handleWaypointBlur = (index) => commitFirstSuggestion(waypoints.value[index], handleCalculate)

    const handleCarpoolDestBlur = () => commitFirstSuggestion(carpoolDestination.value, () => debouncedRunVisualCarpool(true))
    const searchCarpoolDest = () => searchAddress(carpoolDestination.value)
    const navigateCarpoolDest = (direction) => navigateAddress(carpoolDestination.value, direction)
    const selectCarpoolDest = (item) => selectAddress(carpoolDestination.value, item, () => debouncedRunVisualCarpool(true))
    const handleCarpoolDestEnter = () => commitFirstSuggestion(carpoolDestination.value, () => debouncedRunVisualCarpool(true))

    const handleParticipantBlur = (idx) => commitFirstSuggestion(participants.value[idx], () => debouncedRunVisualCarpool(true))
    const searchParticipant = (idx) => searchAddress(participants.value[idx])
    const navigateParticipant = (idx, direction) => navigateAddress(participants.value[idx], direction)
    const selectParticipant = (idx, item) => selectAddress(participants.value[idx], item, () => debouncedRunVisualCarpool(true))
    const handleParticipantEnter = (idx) => commitFirstSuggestion(participants.value[idx], () => debouncedRunVisualCarpool(true))

    const handleMeetingPointBlur = (mIdx) => commitFirstSuggestion(meetingPoints.value[mIdx], () => debouncedRunVisualCarpool(true))
    const searchMeetingPoint = (mIdx) => searchAddress(meetingPoints.value[mIdx])
    const navigateMeetingPoint = (mIdx, direction) => navigateAddress(meetingPoints.value[mIdx], direction)
    const selectMeetingPoint = (mIdx, item) => selectAddress(meetingPoints.value[mIdx], item, () => debouncedRunVisualCarpool(true))
    const handleMeetingPointEnter = (mIdx) => commitFirstSuggestion(meetingPoints.value[mIdx], () => debouncedRunVisualCarpool(true))

    return {
        searchLocation, selectLocation, handleWaypointEnter, handleWaypointBlur, navigateSuggestions,
        searchCarpoolDest, selectCarpoolDest, handleCarpoolDestEnter, handleCarpoolDestBlur, navigateCarpoolDest,
        searchParticipant, selectParticipant, handleParticipantEnter, handleParticipantBlur, navigateParticipant,
        searchMeetingPoint, selectMeetingPoint, handleMeetingPointEnter, handleMeetingPointBlur, navigateMeetingPoint,
        handleFieldBlur, handleFieldEscape, handleDocumentClick
    }
}