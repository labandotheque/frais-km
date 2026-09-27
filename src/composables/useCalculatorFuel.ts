// @ts-nocheck
import { FUEL_API_URL, FUEL_FIELDS } from '../services/fuel'
import { safeFetchJson } from '../services/api'

export function useCalculatorFuel({ selectedFuelType, fuelPrice, calcMode, resetInProgress, sharedState, waypoints, carpoolDestination, showFuelModal, showNotification, persistence }) {
    const toggleFuelModal = () => {
        showFuelModal.value = !showFuelModal.value
    }

    const fetchFuelFromApi = async (fuelType = selectedFuelType.value, persist = true) => {
        selectedFuelType.value = fuelType
        if (persist && !resetInProgress()) persistence.markDirtyAndPersist('selectedFuelType', fuelType)
        showFuelModal.value = false
        showNotification("Interrogation de l'API des carburants de l'État...")

        let lat = 46.603354, lon = 1.888334
        if (waypoints.value[0] && waypoints.value[0].coords) {
            lat = waypoints.value[0].coords.lat
            lon = waypoints.value[0].coords.lon
        } else if (carpoolDestination.value && carpoolDestination.value.coords) {
            lat = carpoolDestination.value.coords.lat
            lon = carpoolDestination.value.coords.lon
        }
        void lat; void lon

        const priceField = FUEL_FIELDS[fuelType] || FUEL_FIELDS.gazole
        const data = await safeFetchJson(FUEL_API_URL)

        if (data && data.results && data.results.length > 0) {
            const validPrices = []
            for (const record of data.results) {
                const val = record[priceField]
                if (val && typeof val === 'number' && val > 0) validPrices.push(val)
            }

            if (validPrices.length > 0) {
                const average = validPrices.reduce((acc, curr) => acc + curr, 0) / validPrices.length
                fuelPrice.value = Number(average.toFixed(2))
                if (persist && !resetInProgress()) persistence.markDirtyAndPersist('fuelPrice', fuelPrice.value)
                showNotification(`Prix moyen ${fuelType.toUpperCase()} : ${fuelPrice.value} €/L (Moyenne de ${validPrices.length} stations)`)
            } else {
                showNotification(`Aucun tarif disponible pour ${fuelType.toUpperCase()} dans les stations proches.`)
            }
        } else {
            showNotification("Impossible de contacter l'API de l'État pour le moment.")
        }
    }

    const ensureFuelPrice = () => {
        if (!resetInProgress() && calcMode.value === 'reels' && !persistence.hasStoredValue('fuelPrice') && sharedState?.fuelPrice === undefined) {
            return fetchFuelFromApi(selectedFuelType.value, !sharedState)
        }
    }

    const fetchParticipantFuelPrice = async (participant, fuelType = participant.fuelType || 'gazole') => {
        participant.fuelType = fuelType
        showNotification("Interrogation de l'API des carburants de l'État...")
        const priceField = FUEL_FIELDS[fuelType] || FUEL_FIELDS.gazole
        const data = await safeFetchJson(FUEL_API_URL)
        const validPrices = data?.results?.map(record => record[priceField]).filter(value => typeof value === 'number' && value > 0) || []

        if (validPrices.length === 0) {
            showNotification(`Aucun tarif disponible pour ${fuelType.toUpperCase()} dans les stations proches.`)
            return
        }
        const average = validPrices.reduce((sum, value) => sum + value, 0) / validPrices.length
        participant.fuelPrice = Number(average.toFixed(2))
        showNotification(`Prix moyen ${fuelType.toUpperCase()} : ${participant.fuelPrice.toFixed(2)} €/L (Moyenne de ${validPrices.length} stations)`)
    }

    return { toggleFuelModal, fetchFuelFromApi, fetchParticipantFuelPrice, ensureFuelPrice }
}
