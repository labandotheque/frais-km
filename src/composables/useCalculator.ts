// @ts-nocheck
import { ref, computed, onMounted, onUnmounted, nextTick, watch } from 'vue'
import { useLocalStorage } from './useLocalStorage'
import { formatAddress, cityOf, formatAddressMain, formatAddressSecondary, addressTypeIcon } from '../utils/formatting'
import { serializeCalculatorState } from '../utils/sharing'
import { useCalculatorPersistence, STORAGE_PREFIX } from './useCalculatorPersistence'
import { useCalculatorAddress } from './useCalculatorAddress'
import { useCalculatorMap } from './useCalculatorMap'
import { useCalculatorFuel } from './useCalculatorFuel'
import { useCalculatorCarpool } from './useCalculatorCarpool'
import { safeFetchJson } from '../services/api'
import { osrmJson } from '../utils/osrm'

const DEFAULTS = { fuelPrice: 1.75, fuelConsumption: 6.5, baremeRate: 0.35 }

// Paramètres de navigation d'une URL (« ?mode=reels ») : ils choisissent un affichage, ils ne transportent aucune donnée.
const NAVIGATION_KEYS = new Set(['mode', 'inputMode', 'calcMode'])
const hasSharedData = (s) => !!s && typeof s === 'object'
    && Object.keys(s).some(k => !NAVIGATION_KEYS.has(k) && s[k] !== undefined && s[k] !== null && s[k] !== '')

const copyToClipboard = async (text) => {
    if (navigator.clipboard?.writeText) { await navigator.clipboard.writeText(text); return }
    const input = document.createElement('textarea')
    input.value = text
    document.body.appendChild(input)
    input.select()
    document.execCommand('copy')
    input.remove()
}

export function useCalculator(initialMode: string | null = null, sharedState: any = null, initialCalculationMode: 'bareme' | 'reels' | null = null) {
    // `sharedState` désactive TOUTE la persistance (lecture et écriture du localStorage) : il ne doit exister que pour un vrai
    // lien de partage. Sans cette garde, `/covoiturage?mode=reels` produit un objet (même vide : `{}` est « truthy » en JS)
    // et la sauvegarde cesse de fonctionner.
    // `?mode=reels` (ou `bareme`) reste pris en compte comme mode de calcul, même si ce n'est pas un partage.
    if (!initialCalculationMode && ['bareme', 'reels'].includes(sharedState?.calcMode)) initialCalculationMode = sharedState.calcMode
    sharedState = hasSharedData(sharedState) ? sharedState : null

    const { safeGetLocalStorage } = useLocalStorage()
    const persistence = useCalculatorPersistence({ sharedState })

    // ───────── Lecture de l'état initial (lien de partage > localStorage > valeur par défaut)
    const readInitialValue = (key, fallback, storageKey = `${STORAGE_PREFIX}${key}`) => {
        if (sharedState) return sharedState[key] ?? fallback
        return safeGetLocalStorage(storageKey, fallback)
    }
    const readNumber = (key, fallback) => Number(readInitialValue(key, fallback)) || fallback
    const readBool = (key, fallback = false) => {
        const v = readInitialValue(key, fallback)
        return v === true || v === 'true'
    }

    const inputMode = ref(initialMode || 'cities')
    const notification = ref({ show: false, message: '' })
    const selectedParticipantToAdd = ref({})
    const showFuelModal = ref(false)
    const selectedFuelType = ref(readInitialValue('selectedFuelType', 'gazole'))

    let notificationTimer = null
    const showNotification = (msg) => {
        notification.value = { show: true, message: msg }
        clearTimeout(notificationTimer)                     // une nouvelle notification ne doit pas être masquée par l'ancienne
        notificationTimer = setTimeout(() => { notification.value.show = false }, 5000)
    }

    // ───────── Champs d'adresse (étapes, destination) et participants
    const emptyField = (src = {}) => ({
        query: src.query || '', suggestions: [], coords: src.coords || null, isSelecting: false, selectedIndex: -1
    })

    let nextWaypointId = 1
    const createWaypoint = (w = {}) => ({ id: nextWaypointId++, ...emptyField(w) })
    const savedWaypoints = readInitialValue('waypoints', null)
    const waypoints = ref(savedWaypoints ? savedWaypoints.map(w => createWaypoint(w)) : [createWaypoint(), createWaypoint()])

    const manualKm = ref(readNumber('manualKm', 0))
    const isRoundTrip = ref(readBool('isRoundTrip'))
    const globalToll = ref(readNumber('globalToll', 0))

    const carpoolDestination = ref(emptyField(readInitialValue('carpoolDestination', null, `${STORAGE_PREFIX}carpoolDest`) || {}))

    const defaultFuelPrice = readNumber('fuelPrice', DEFAULTS.fuelPrice)
    const defaultFuelConsumption = readNumber('fuelConsumption', DEFAULTS.fuelConsumption)

    let nextParticipantId = 1
    const createParticipant = (p = {}, fuel = { price: defaultFuelPrice, consumption: defaultFuelConsumption }) => {
        const id = p.id ?? nextParticipantId
        nextParticipantId = Math.max(nextParticipantId, id + 1)
        return {
            id, ...emptyField(p), name: p.name || '',
            consumption: p.consumption !== undefined ? p.consumption : fuel.consumption,
            fuelPrice: p.fuelPrice !== undefined ? p.fuelPrice : fuel.price,
            fuelType: p.fuelType || 'gazole',
            toll: p.toll !== undefined ? p.toll : 0
        }
    }
    const savedParts = readInitialValue('participants', null)
    const participants = ref(savedParts
        ? savedParts.map(p => createParticipant(p))
        : [createParticipant({ name: 'Alice' }), createParticipant({ name: 'Bob' })])

    // ───────── Arrêts : le scénario (qui conduit, qui monte) est indexé par l'ID des participants, pas par leur nom,
    // pour que renommer quelqu'un ne casse rien. Anciennes sauvegardes et anciens liens de partage (clés = noms) :
    // convertis au chargement. La conversion ne dépend pas du marqueur `keyed` : une clé qui est déjà un id existant est
    // conservée, sinon on cherche un participant de ce nom.
    const idKeys = new Set(participants.value.map(p => String(p.id)))
    const idByName = new Map(participants.value.map(p => [p.name, String(p.id)]))
    const loadMeetingPoint = (mp) => {
        const strict = mp.keyed === 'id'
        const toKey = (k) => {
            const s = String(k)
            if (idKeys.has(s)) return s
            return strict ? null : (idByName.get(k) ?? null)
        }
        const participations = {}
        for (const [k, v] of Object.entries(mp.participations || {})) {
            const id = toKey(k)
            if (id !== null) participations[id] = v
        }
        return {
            ...emptyField(mp), participations,
            selectedDriver: mp.selectedDriver ? toKey(mp.selectedDriver) : null, keyed: 'id'
        }
    }
    const savedMps = readInitialValue('meetingPoints', null)
    const meetingPoints = ref(savedMps ? savedMps.map(loadMeetingPoint) : [])

    // ───────── Résultats et réglages de calcul
    const visualCarpoolResults = ref(sharedState ? [] : safeGetLocalStorage(`${STORAGE_PREFIX}visualResults`, []))
    const tripMode = ref(readInitialValue('tripMode', 'carpool') === 'solo' ? 'solo' : 'carpool')   // covoiturage, ou tout le monde seul (les arrêts sont conservés)
    const tripTotals = ref({ carpool: null, solo: null })                                              // total des deux modes, pour comparer
    const calcMode = ref(initialCalculationMode || readInitialValue('calcMode', 'bareme'))
    const fuelPrice = ref(defaultFuelPrice)
    const fuelConsumption = ref(defaultFuelConsumption)
    const baremeRate = ref(readNumber('baremeRate', DEFAULTS.baremeRate))
    const oneWayKm = ref(0)
    const loading = ref(false)
    const error = ref('')

    const mapApi = useCalculatorMap({ inputMode })
    const mapState = mapApi.state
    let calcToken = 0
    let recalcTimer = null
    let runVisualCarpool = () => {}

    const debouncedRunVisualCarpool = (immediate = false, fitMap = true) => {
        clearTimeout(recalcTimer)
        if (immediate) { runVisualCarpool(fitMap); return }
        recalcTimer = setTimeout(() => runVisualCarpool(fitMap), 400)
    }
    // Recalcul du covoiturage, seulement si on est dans ce mode
    const rerunCarpool = (immediate = false, fitMap = true) => {
        if (inputMode.value === 'carpool') debouncedRunVisualCarpool(immediate, fitMap)
    }

    const fuelApi = useCalculatorFuel({
        selectedFuelType, fuelPrice, calcMode, resetInProgress: persistence.isResetInProgress,
        sharedState, waypoints, carpoolDestination, showFuelModal, showNotification, persistence
    })

    const carpoolApi = useCalculatorCarpool({
        inputMode, carpoolDestination, participants, meetingPoints, visualCarpoolResults,
        selectedParticipantToAdd, isRoundTrip, calcMode, fuelConsumption, fuelPrice, baremeRate,
        tripMode, tripTotals, loading, error, mapState, clearMarkers: mapApi.clearMarkers, clearRoutes: mapApi.clearRoutes,
        fitMapToMarkers: mapApi.fitMapToMarkers, showNotification,
        debouncedRunVisualCarpoolRef: debouncedRunVisualCarpool,
        createParticipantId: () => nextParticipantId++
    })
    runVisualCarpool = carpoolApi.runVisualCarpool

    // ───────── Trajet « villes » (A → B → C…)
    const totalDistanceKm = computed(() => {
        const base = inputMode.value === 'km' ? Number(manualKm.value || 0) : oneWayKm.value
        return isRoundTrip.value ? base * 2 : base
    })
    const totalDistanceAmount = computed(() => calcMode.value === 'bareme'
        ? totalDistanceKm.value * baremeRate.value
        : (totalDistanceKm.value / 100) * fuelConsumption.value * fuelPrice.value)
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
            const data = await osrmJson(`https://router.project-osrm.org/route/v1/driving/${coordsList.join(';')}?overview=full&geometries=geojson`, safeFetchJson)
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

    const reverseWaypoints = () => {
        waypoints.value = [...waypoints.value].reverse()
        handleCalculate()
    }

    const addWaypoint = () => {
        const newWp = createWaypoint()
        if (waypoints.value.length >= 1) waypoints.value.splice(waypoints.value.length - 1, 0, newWp)
        else waypoints.value.push(newWp)
        if (inputMode.value === 'cities') handleCalculate()
    }
    const removeWaypoint = (index) => {
        waypoints.value.splice(index, 1)
        handleCalculate()
    }

    // ───────── Persistance : branchée champ par champ (un changement ne réécrit que sa propre clé)
    const PERSISTED_FIELDS = [
        ['inputMode', inputMode], ['waypoints', waypoints, true], ['manualKm', manualKm], ['isRoundTrip', isRoundTrip],
        ['globalToll', globalToll], ['carpoolDestination', carpoolDestination, true], ['participants', participants, true],
        ['meetingPoints', meetingPoints, true], ['visualCarpoolResults', visualCarpoolResults, true], ['tripMode', tripMode],
        ['calcMode', calcMode], ['fuelPrice', fuelPrice], ['fuelConsumption', fuelConsumption],
        ['baremeRate', baremeRate], ['selectedFuelType', selectedFuelType]
    ]
    PERSISTED_FIELDS.forEach(([key, source, deep]) => persistence.watchField(source, key, deep ? { deep: true } : undefined))

    // ───────── Réactions : tout ce qui change le résultat relance le calcul du covoiturage
    let oldDestCoords = carpoolDestination.value.coords ? { ...carpoolDestination.value.coords } : null
    watch(() => carpoolDestination.value.coords, (newCoords) => {
        if (newCoords && inputMode.value === 'carpool') {
            if (!oldDestCoords || oldDestCoords.lat !== newCoords.lat || oldDestCoords.lon !== newCoords.lon) {
                oldDestCoords = { ...newCoords }
                carpoolApi.autoDetectMeetingPoints()
            }
        } else if (!newCoords) oldDestCoords = null
    })
    watch(tripMode, () => rerunCarpool(true, false))                    // changer de mode ne recadre pas la carte
    watch(isRoundTrip, () => rerunCarpool(true))
    watch([carpoolDestination, participants, meetingPoints], () => rerunCarpool(), { deep: true })
    watch(calcMode, (v) => {
        rerunCarpool(true)
        if (v === 'reels') fuelApi.ensureFuelPrice()
    })
    watch([fuelPrice, fuelConsumption, baremeRate], () => rerunCarpool())

    // ───────── Carte et cycle de vie
    const syncMapSize = () => {
        mapState.map?.invalidateSize(true)
        requestAnimationFrame(() => mapState.map?.invalidateSize(true))
    }
    const startForMode = () => {
        if (inputMode.value === 'cities') handleCalculate()
        else if (inputMode.value === 'carpool') runVisualCarpool()
    }

    onMounted(() => {
        document.addEventListener('click', addressApi.handleDocumentClick)
        const savedMode = localStorage.getItem(`${STORAGE_PREFIX}inputMode`)
        if (!initialMode && savedMode) inputMode.value = savedMode
        nextTick(() => {
            mapApi.initializeMap()
            syncMapSize()
            fuelApi.ensureFuelPrice()
            startForMode()
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
            syncMapSize()
            startForMode()
        })
    })

    onUnmounted(() => {
        document.removeEventListener('click', addressApi.handleDocumentClick)
        clearTimeout(recalcTimer)
        clearTimeout(notificationTimer)
        mapApi.destroyMap()
    })

    // ───────── Remise à zéro / partage
    const resetData = () => {
        if (!confirm("Voulez-vous effacer toutes les données enregistrées ?")) return
        persistence.setResetInProgress(true)
        persistence.removeAll()
        const fuel = { price: DEFAULTS.fuelPrice, consumption: DEFAULTS.fuelConsumption }
        waypoints.value = [createWaypoint(), createWaypoint()]
        manualKm.value = 0
        isRoundTrip.value = false
        globalToll.value = 0
        carpoolDestination.value = emptyField()
        nextParticipantId = 1                               // Alice et Bob repartent des ids 1 et 2 (couleurs d'origine)
        participants.value = [createParticipant({ name: 'Alice' }, fuel), createParticipant({ name: 'Bob' }, fuel)]
        meetingPoints.value = []
        tripMode.value = 'carpool'
        visualCarpoolResults.value = []
        selectedParticipantToAdd.value = {}
        calcMode.value = 'bareme'
        fuelPrice.value = DEFAULTS.fuelPrice
        fuelConsumption.value = DEFAULTS.fuelConsumption
        baremeRate.value = DEFAULTS.baremeRate
        selectedFuelType.value = 'gazole'
        window.location.replace(window.location.pathname.replace(/\/(bareme|reels)$/, '') || '/')
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
            await copyToClipboard(url.toString())
            showNotification('Lien de partage copié dans le presse-papiers.')
        } catch {
            showNotification('Impossible de copier le lien de partage.')
        }
    }

    return {
        inputMode, notification, waypoints, manualKm, isRoundTrip, globalToll, carpoolDestination, participants, meetingPoints,
        visualCarpoolResults, calcMode, fuelPrice, fuelConsumption, baremeRate, loading, error, selectedParticipantToAdd,
        showFuelModal, ...fuelApi, selectedFuelType, debouncedRunVisualCarpool,
        tripMode, tripTotals, cityOf,
        formatAddress, formatAddressMain, formatAddressSecondary, addressTypeIcon,
        addWaypoint, removeWaypoint, reverseWaypoints, handleCalculate, ...carpoolApi,
        ...addressApi,
        resetData, shareTrip,
        totalDistanceKm, totalDistanceAmount, finalAmount, totalVisualCarpoolAmount
    }
}