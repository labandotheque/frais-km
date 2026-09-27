// @ts-nocheck
import { ref, computed, onMounted, onUnmounted, nextTick, watch } from 'vue'
import { useLocalStorage } from './useLocalStorage'
import { formatAddress, formatAddressMain, formatAddressSecondary, addressTypeIcon } from '../utils/formatting'
import { serializeCalculatorState } from '../utils/sharing'
import { useCalculatorPersistence, STORAGE_PREFIX } from './useCalculatorPersistence'
import { useCalculatorAddress } from './useCalculatorAddress'
import { useCalculatorMap } from './useCalculatorMap'
import { useCalculatorFuel } from './useCalculatorFuel'
import { useCalculatorCarpool } from './useCalculatorCarpool'
import { safeFetchJson } from '../services/api'

export function useCalculator(initialMode = null, sharedState = null, initialCalculationMode = null) {
    const { safeGetLocalStorage } = useLocalStorage()
    const persistence = useCalculatorPersistence({ sharedState })
    const readInitialValue = (key, fallback, storageKey = `${STORAGE_PREFIX}${key}`) => {
        if (sharedState) return sharedState[key] ?? fallback
        return safeGetLocalStorage(storageKey, fallback)
    }

    const inputMode = ref(initialMode || 'cities')
    const notification = ref({ show: false, message: '' })
    const selectedParticipantToAdd = ref({})
    const draggedIndex = ref(null)
    const showFuelModal = ref(false)
    const selectedFuelType = ref(readInitialValue('selectedFuelType', 'gazole'))

    const showNotification = (msg) => {
        notification.value = { show: true, message: msg }
        setTimeout(() => { notification.value.show = false }, 5000)
    }

    const savedWaypoints = readInitialValue('waypoints', null)
    const waypoints = ref(savedWaypoints ? savedWaypoints.map(w => ({
        query: w.query || '', suggestions: [], coords: w.coords || null, isSelecting: false, selectedIndex: -1
    })) : [
        { query: '', suggestions: [], coords: null, isSelecting: false, selectedIndex: -1 },
        { query: '', suggestions: [], coords: null, isSelecting: false, selectedIndex: -1 }
    ])

    const manualKm = ref(Number(readInitialValue('manualKm', 0)) || 0)
    const isRoundTrip = ref(readInitialValue('isRoundTrip', false) === true || readInitialValue('isRoundTrip', false) === 'true')
    const globalToll = ref(Number(readInitialValue('globalToll', 0)) || 0)

    const savedCd = readInitialValue('carpoolDestination', null, `${STORAGE_PREFIX}carpoolDest`)
    const carpoolDestination = ref(savedCd ? {
        query: savedCd.query || '', suggestions: [], coords: savedCd.coords || null, isSelecting: false, selectedIndex: -1
    } : { query: '', suggestions: [], coords: null, isSelecting: false, selectedIndex: -1 })

    const savedParts = readInitialValue('participants', null)
    const defaultFuelPrice = Number(readInitialValue('fuelPrice', 1.75)) || 1.75
    const defaultFuelConsumption = Number(readInitialValue('fuelConsumption', 6.5)) || 6.5

    let nextParticipantId = 1
    const participants = ref(savedParts ? savedParts.map(p => {
        const id = p.id !== undefined && p.id !== null ? p.id : nextParticipantId++
        nextParticipantId = Math.max(nextParticipantId, id + 1)
        return {
            id,
            name: p.name || '', query: p.query || '', suggestions: [], coords: p.coords || null, isSelecting: false, selectedIndex: -1,
            consumption: p.consumption !== undefined ? p.consumption : defaultFuelConsumption,
            fuelPrice: p.fuelPrice !== undefined ? p.fuelPrice : defaultFuelPrice,
            fuelType: p.fuelType || 'gazole',
            toll: p.toll !== undefined ? p.toll : 0
        }
    }) : [
        { id: nextParticipantId++, name: 'Alice', query: '', suggestions: [], coords: null, isSelecting: false, selectedIndex: -1, consumption: defaultFuelConsumption, fuelPrice: defaultFuelPrice, fuelType: 'gazole', toll: 0 },
        { id: nextParticipantId++, name: 'Bob', query: '', suggestions: [], coords: null, isSelecting: false, selectedIndex: -1, consumption: defaultFuelConsumption, fuelPrice: defaultFuelPrice, fuelType: 'gazole', toll: 0 }
    ])

    const savedMps = readInitialValue('meetingPoints', null)
    const meetingPoints = ref(savedMps ? savedMps.map(mp => ({
        query: mp.query || '', suggestions: [], coords: mp.coords || null, isSelecting: false, selectedIndex: -1,
        participations: mp.participations || {}, selectedDriver: mp.selectedDriver || null
    })) : [])

    const visualCarpoolResults = ref(sharedState ? [] : safeGetLocalStorage(`${STORAGE_PREFIX}visualResults`, []))
    const calcMode = ref(initialCalculationMode || readInitialValue('calcMode', 'bareme'))
    const fuelPrice = ref(defaultFuelPrice)
    const fuelConsumption = ref(defaultFuelConsumption)
    const baremeRate = ref(Number(readInitialValue('baremeRate', 0.35)) || 0.35)
    const oneWayKm = ref(0)
    const loading = ref(false)
    const error = ref('')

    const mapApi = useCalculatorMap({ inputMode })
    const mapState = mapApi.state
    let calcToken = 0
    let recalcTimer = null
    let runVisualCarpool = () => {}

    const debouncedRunVisualCarpool = (immediate = false) => {
        clearTimeout(recalcTimer)
        if (immediate) { runVisualCarpool(); return }
        recalcTimer = setTimeout(() => runVisualCarpool(), 400)
    }

    const fuelApi = useCalculatorFuel({
        selectedFuelType, fuelPrice, calcMode, resetInProgress: persistence.isResetInProgress,
        sharedState, waypoints, carpoolDestination, showFuelModal, showNotification, persistence
    })

    const carpoolApi = useCalculatorCarpool({
        inputMode, carpoolDestination, participants, meetingPoints, visualCarpoolResults,
        selectedParticipantToAdd, isRoundTrip, calcMode, fuelConsumption, fuelPrice, baremeRate,
        loading, error, mapState, clearMarkers: mapApi.clearMarkers, clearRoutes: mapApi.clearRoutes,
        fitMapToMarkers: mapApi.fitMapToMarkers, showNotification,
        debouncedRunVisualCarpoolRef: debouncedRunVisualCarpool,
        createParticipantId: () => nextParticipantId++
    })
    runVisualCarpool = carpoolApi.runVisualCarpool

    const totalDistanceKm = computed(() => {
        const base = inputMode.value === 'km' ? Number(manualKm.value || 0) : oneWayKm.value
        return isRoundTrip.value ? base * 2 : base
    })
    const totalDistanceAmount = computed(() => {
        let baseVal = 0
        if (calcMode.value === 'bareme') baseVal = totalDistanceKm.value * baremeRate.value
        else baseVal = (totalDistanceKm.value / 100) * fuelConsumption.value * fuelPrice.value
        return baseVal
    })
    const finalAmount = computed(() => totalDistanceAmount.value + Number(globalToll.value || 0))
    const totalVisualCarpoolAmount = computed(() => visualCarpoolResults.value.reduce((acc, curr) => acc + curr.amount, 0))

    const handleCalculate = async () => {
        error.value = ''
        if (inputMode.value !== 'cities') return
        const allFilled = waypoints.value.every(w => w.query.trim().length > 0 && w.coords)
        if (!allFilled) return
        const myToken = ++calcToken
        loading.value = true
        try {
            mapApi.updateMarkers(waypoints.value.map((w, i) => ({ coords: w.coords, label: String.fromCharCode(65 + i), color: '#4f46e5' })))
            const coordsList = waypoints.value.map(w => `${w.coords.lon},${w.coords.lat}`)
            const data = await safeFetchJson(`https://router.project-osrm.org/route/v1/driving/${coordsList.join(';')}?overview=full&geometries=geojson`)
            if (myToken !== calcToken) return
            if (!data || !data.routes) throw new Error("Erreur de calcul d'itinéraire")
            oneWayKm.value = Math.round((data.routes[0].distance / 1000) * 10) / 10
            mapApi.clearRoutes()
            const latLngs = data.routes[0].geometry.coordinates.map(c => [c[1], c[0]])
            if (!mapState.map) return
            const rLayer = L.polyline(latLngs, { color: '#4f46e5', weight: 5, opacity: 1, renderer: L.svg() }).addTo(mapState.map)
            mapState.routeLayers.push(rLayer)
            rLayer.bringToFront()
            mapState.map.fitBounds(rLayer.getBounds().pad(0.3), { maxZoom: 13, padding: [24, 24] })
            requestAnimationFrame(() => mapState.map?.invalidateSize(true))
        } catch (err) {
            if (myToken === calcToken) error.value = err.message
        } finally {
            if (myToken === calcToken) loading.value = false
        }
    }

    const addressApi = useCalculatorAddress({
        waypoints, carpoolDestination, participants, meetingPoints,
        handleCalculate, debouncedRunVisualCarpool
    })

    const onDragStart = (index, event) => {
        draggedIndex.value = index
        event.dataTransfer.effectAllowed = 'move'
    }
    const onDragOver = (index, event) => {
        event.preventDefault()
        event.dataTransfer.dropEffect = 'move'
    }
    const onDrop = (index) => {
        if (draggedIndex.value === null || draggedIndex.value === index) return
        const movedItem = waypoints.value.splice(draggedIndex.value, 1)[0]
        waypoints.value.splice(index, 0, movedItem)
        draggedIndex.value = null
        handleCalculate()
    }
    const onDragEnd = () => { draggedIndex.value = null }

    const addWaypoint = () => {
        const newWp = { query: '', suggestions: [], coords: null, isSelecting: false, selectedIndex: -1 }
        if (waypoints.value.length >= 1) waypoints.value.splice(waypoints.value.length - 1, 0, newWp)
        else waypoints.value.push(newWp)
        if (inputMode.value === 'cities') handleCalculate()
    }
    const removeWaypoint = (index) => {
        waypoints.value.splice(index, 1)
        handleCalculate()
    }

    // La persistance est volontairement branchée champ par champ : un dirty ne réécrit que sa propre clé.
    persistence.watchField(inputMode, 'inputMode')
    persistence.watchField(waypoints, 'waypoints', { deep: true })
    persistence.watchField(manualKm, 'manualKm')
    persistence.watchField(isRoundTrip, 'isRoundTrip')
    persistence.watchField(globalToll, 'globalToll')
    persistence.watchField(carpoolDestination, 'carpoolDestination', { deep: true })
    persistence.watchField(participants, 'participants', { deep: true })
    persistence.watchField(meetingPoints, 'meetingPoints', { deep: true })
    persistence.watchField(visualCarpoolResults, 'visualCarpoolResults', { deep: true })
    persistence.watchField(calcMode, 'calcMode')
    persistence.watchField(fuelPrice, 'fuelPrice')
    persistence.watchField(fuelConsumption, 'fuelConsumption')
    persistence.watchField(baremeRate, 'baremeRate')
    persistence.watchField(selectedFuelType, 'selectedFuelType')

    let oldDestCoords = carpoolDestination.value.coords ? { ...carpoolDestination.value.coords } : null
    watch(() => carpoolDestination.value.coords, (newCoords) => {
        if (newCoords && inputMode.value === 'carpool') {
            if (!oldDestCoords || oldDestCoords.lat !== newCoords.lat || oldDestCoords.lon !== newCoords.lon) {
                oldDestCoords = { ...newCoords }
                carpoolApi.autoDetectMeetingPoints()
            }
        } else if (!newCoords) oldDestCoords = null
    })
    watch(isRoundTrip, () => { if (inputMode.value === 'carpool') debouncedRunVisualCarpool(true) })
    watch(carpoolDestination, () => { if (inputMode.value === 'carpool') debouncedRunVisualCarpool() }, { deep: true })
    watch(participants, () => { if (inputMode.value === 'carpool') debouncedRunVisualCarpool() }, { deep: true })
    watch(meetingPoints, () => { if (inputMode.value === 'carpool') debouncedRunVisualCarpool() }, { deep: true })
    watch(calcMode, (v) => {
        if (inputMode.value === 'carpool') debouncedRunVisualCarpool(true)
        if (v === 'reels') fuelApi.ensureFuelPrice()
    })
    watch(fuelPrice, () => { if (inputMode.value === 'carpool') debouncedRunVisualCarpool() })
    watch(fuelConsumption, () => { if (inputMode.value === 'carpool') debouncedRunVisualCarpool() })
    watch(baremeRate, () => { if (inputMode.value === 'carpool') debouncedRunVisualCarpool() })

    onMounted(() => {
        document.addEventListener('click', addressApi.handleDocumentClick)
        const savedMode = localStorage.getItem(`${STORAGE_PREFIX}inputMode`)
        if (!initialMode && savedMode) inputMode.value = savedMode
        nextTick(() => {
            mapApi.initializeMap()
            requestAnimationFrame(() => mapState.map?.invalidateSize(true))
            fuelApi.ensureFuelPrice()
            if (inputMode.value === 'cities') handleCalculate()
            else if (inputMode.value === 'carpool') runVisualCarpool()
        })
    })

    watch(inputMode, () => {
        mapApi.clearMap()
        if (inputMode.value === 'km') {
            mapApi.destroyMap()
            return
        }
        nextTick(() => {
            mapApi.initializeMap()
            if (mapState.map) {
                mapState.map.invalidateSize(true)
                requestAnimationFrame(() => mapState.map?.invalidateSize(true))
            }
            if (inputMode.value === 'cities') handleCalculate()
            else if (inputMode.value === 'carpool') runVisualCarpool()
        })
    })

    onUnmounted(() => {
        document.removeEventListener('click', addressApi.handleDocumentClick)
        clearTimeout(recalcTimer)
        mapApi.destroyMap()
    })

    const resetData = () => {
        if (confirm("Voulez-vous effacer toutes les données enregistrées ?")) {
            persistence.setResetInProgress(true)
            persistence.removeAll()
            waypoints.value = [
                { query: '', suggestions: [], coords: null, isSelecting: false, selectedIndex: -1 },
                { query: '', suggestions: [], coords: null, isSelecting: false, selectedIndex: -1 }
            ]
            manualKm.value = 0
            isRoundTrip.value = false
            globalToll.value = 0
            carpoolDestination.value = { query: '', suggestions: [], coords: null, isSelecting: false, selectedIndex: -1 }
            participants.value = [
                { id: 1, name: 'Alice', query: '', suggestions: [], coords: null, isSelecting: false, selectedIndex: -1, consumption: 6.5, fuelPrice: 1.75, fuelType: 'gazole', toll: 0 },
                { id: 2, name: 'Bob', query: '', suggestions: [], coords: null, isSelecting: false, selectedIndex: -1, consumption: 6.5, fuelPrice: 1.75, fuelType: 'gazole', toll: 0 }
            ]
            meetingPoints.value = []
            visualCarpoolResults.value = []
            selectedParticipantToAdd.value = {}
            calcMode.value = 'bareme'
            fuelPrice.value = 1.75
            fuelConsumption.value = 6.5
            baremeRate.value = 0.35
            selectedFuelType.value = 'gazole'
            const cleanPath = window.location.pathname.replace(/\/(bareme|reels)$/, '') || '/'
            window.location.replace(cleanPath)
        }
    }

    const shareTrip = async () => {
        const url = new URL(window.location.href)
        url.search = serializeCalculatorState({
            waypoints: waypoints.value, manualKm: manualKm.value, isRoundTrip: isRoundTrip.value,
            globalToll: globalToll.value, carpoolDestination: carpoolDestination.value, participants: participants.value,
            meetingPoints: meetingPoints.value, calcMode: calcMode.value, fuelPrice: fuelPrice.value,
            fuelConsumption: fuelConsumption.value, baremeRate: baremeRate.value, selectedFuelType: selectedFuelType.value
        }, inputMode.value).toString()
        try {
            if (navigator.clipboard?.writeText) await navigator.clipboard.writeText(url.toString())
            else {
                const input = document.createElement('textarea')
                input.value = url.toString()
                document.body.appendChild(input)
                input.select()
                document.execCommand('copy')
                input.remove()
            }
            showNotification('Lien de partage copié dans le presse-papiers.')
        } catch {
            showNotification('Impossible de copier le lien de partage.')
        }
    }

    return {
        inputMode, notification, waypoints, manualKm, isRoundTrip, globalToll, carpoolDestination, participants, meetingPoints,
        visualCarpoolResults, calcMode, fuelPrice, fuelConsumption, baremeRate, loading, error, selectedParticipantToAdd, draggedIndex,
        showFuelModal, ...fuelApi, selectedFuelType, debouncedRunVisualCarpool,
        formatAddress, formatAddressMain, formatAddressSecondary, addressTypeIcon,
        addWaypoint, removeWaypoint, ...carpoolApi,
        ...addressApi,
        onDragStart, onDragOver, onDrop, onDragEnd,
        resetData, shareTrip,
        totalDistanceKm, totalDistanceAmount, finalAmount, totalVisualCarpoolAmount
    }
}
