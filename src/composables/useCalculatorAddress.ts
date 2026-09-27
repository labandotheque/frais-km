// @ts-nocheck
import { safeFetchJson } from '../services/api'
import { formatAddress, sortByScore } from '../utils/formatting'

const GEOCODE_URL = 'https://api-adresse.data.gouv.fr/search/'

export function useCalculatorAddress({ waypoints, carpoolDestination, participants, meetingPoints, handleCalculate, debouncedRunVisualCarpool }) {
    const searchAddress = (field) => {
        if (field.isSelecting) { field.isSelecting = false; return }
        clearTimeout(field._searchTimer)
        field.selectedIndex = -1
        const q = (field.query || '').trim()
        if (q.length < 2) { field.suggestions = []; return }
        field._searchTimer = setTimeout(async () => {
            const data = await safeFetchJson(`${GEOCODE_URL}?q=${encodeURIComponent(q)}&limit=6`)
            if (data && data.features) field.suggestions = sortByScore(data.features)
        }, 300)
    }

    const navigateAddress = (field, direction) => {
        if (!field.suggestions.length) return
        field.selectedIndex = (field.selectedIndex + direction + field.suggestions.length) % field.suggestions.length
    }

    const selectAddress = (field, item, onSelected) => {
        clearTimeout(field._searchTimer)
        field.isSelecting = true
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
        clearTimeout(field._searchTimer)
        const q = (field.query || '').trim()
        if (q.length >= 2) {
            const data = await safeFetchJson(`${GEOCODE_URL}?q=${encodeURIComponent(q)}&limit=1`)
            if (data && data.features && data.features.length > 0) selectAddress(field, data.features[0], onSelected)
        }
    }

    const handleFieldBlur = (field) => {
        setTimeout(() => {
            clearTimeout(field._searchTimer)
            field.suggestions = []
            field.selectedIndex = -1
        }, 150)
    }

    const handleFieldEscape = (field) => {
        clearTimeout(field._searchTimer)
        field.suggestions = []
        field.selectedIndex = -1
    }

    const closeAllSuggestions = () => {
        waypoints.value.forEach(handleFieldEscape)
        participants.value.forEach(handleFieldEscape)
        meetingPoints.value.forEach(handleFieldEscape)
        handleFieldEscape(carpoolDestination.value)
    }

    const handleDocumentClick = (event) => {
        const target = event.target
        if (target instanceof HTMLElement && target.closest('input[autocomplete="off"]')) return
        closeAllSuggestions()
    }

    const searchLocation = (index) => searchAddress(waypoints.value[index])
    const navigateSuggestions = (index, direction) => navigateAddress(waypoints.value[index], direction)
    const selectLocation = (index, item) => selectAddress(waypoints.value[index], item, handleCalculate)
    const handleWaypointEnter = (index) => handleAddressEnter(waypoints.value[index], handleCalculate)

    const searchCarpoolDest = () => searchAddress(carpoolDestination.value)
    const navigateCarpoolDest = (direction) => navigateAddress(carpoolDestination.value, direction)
    const selectCarpoolDest = (item) => selectAddress(carpoolDestination.value, item, () => debouncedRunVisualCarpool(true))
    const handleCarpoolDestEnter = () => handleAddressEnter(carpoolDestination.value, () => debouncedRunVisualCarpool(true))

    const searchParticipant = (idx) => searchAddress(participants.value[idx])
    const navigateParticipant = (idx, direction) => navigateAddress(participants.value[idx], direction)
    const selectParticipant = (idx, item) => selectAddress(participants.value[idx], item, () => debouncedRunVisualCarpool(true))
    const handleParticipantEnter = (idx) => handleAddressEnter(participants.value[idx], () => debouncedRunVisualCarpool(true))

    const searchMeetingPoint = (mIdx) => searchAddress(meetingPoints.value[mIdx])
    const navigateMeetingPoint = (mIdx, direction) => navigateAddress(meetingPoints.value[mIdx], direction)
    const selectMeetingPoint = (mIdx, item) => selectAddress(meetingPoints.value[mIdx], item, () => debouncedRunVisualCarpool(true))
    const handleMeetingPointEnter = (mIdx) => handleAddressEnter(meetingPoints.value[mIdx], () => debouncedRunVisualCarpool(true))

    return {
        searchLocation, selectLocation, handleWaypointEnter, navigateSuggestions,
        searchCarpoolDest, selectCarpoolDest, handleCarpoolDestEnter, navigateCarpoolDest,
        searchParticipant, selectParticipant, handleParticipantEnter, navigateParticipant,
        searchMeetingPoint, selectMeetingPoint, handleMeetingPointEnter, navigateMeetingPoint,
        handleFieldBlur, handleFieldEscape, handleDocumentClick
    }
}
