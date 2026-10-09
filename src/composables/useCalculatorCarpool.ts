// @ts-nocheck
import { ref } from 'vue'
import { safeFetchJson } from '../services/api'
import { formatAddress } from '../utils/formatting'
import { suggestMeetingPoints } from '../services/carpool'
import { cfgsFromMeetingPoints, writeCfgsToMeetingPoints, simulateScenario, repairScenario, applyRole, roleAvailability } from '../utils/carpool-scenario'
import { osrmJson } from '../utils/osrm'

export function useCalculatorCarpool({
    inputMode, carpoolDestination, participants, meetingPoints, visualCarpoolResults,
    selectedParticipantToAdd, isRoundTrip, calcMode, fuelConsumption, fuelPrice, baremeRate,
    loading, error, mapState, clearMarkers, clearRoutes, fitMapToMarkers,
    showNotification, debouncedRunVisualCarpoolRef, createParticipantId
}) {
    let carpoolToken = 0
    const suggestionSummary = ref(null)      // résumé du dernier plan proposé (affiché par MeetingPoints.vue)
    const isDraggingMarker = ref(false)      // flag pour éviter le refit quand on drags un marqueur
    // Tous les appels à l'OSRM public passent par la file partagée (≤ 1 requête/s, cache, dédoublonnage)
    const osrm = (url) => osrmJson(url, safeFetchJson)

    const participantColors = ['#4f46e5', '#10b981', '#f59e0b', '#ec4899', '#8b5cf6', '#06b6d4']
    const getParticipantColor = (id) => participantColors[id % participantColors.length]
    const getParticipantColorByName = (pName) => {
        const p = participants.value.find(pp => pp.name === pName)
        return p ? getParticipantColor(p.id) : participantColors[0]
    }

    // ───────── Règles physiques du scénario (voir utils/carpoolScenario.ts)
    // `selectedDriver` = propriétaire de la voiture qui repart de l'arrêt (« voiture de X »), pas forcément qui conduit.
    const scenarioNames = () => participants.value.map(p => p.name)
    const readCfgs = () => cfgsFromMeetingPoints(meetingPoints.value)
    const simulateAll = () => simulateScenario(scenarioNames(), readCfgs())
    const roleOptions = (mIdx, pName) => roleAvailability(scenarioNames(), readCfgs(), mIdx, pName)
    const changeRole = (mIdx, pName, role) => {                 // role : 'car' | 'passenger' | 'none'
        const res = applyRole(scenarioNames(), readCfgs(), mIdx, pName, role)
        writeCfgsToMeetingPoints(meetingPoints.value, res.cfgs)
        debouncedRunVisualCarpoolRef(true)
        return res.adjustments
    }
    const fixScenario = () => {                                 // retire/complète ce qui est devenu impossible
        const res = repairScenario(scenarioNames(), readCfgs())
        if (res.adjustments.length) { writeCfgsToMeetingPoints(meetingPoints.value, res.cfgs); debouncedRunVisualCarpoolRef(true) }
        return res.adjustments
    }
    const notifyAdjustments = (adj) => { if (adj.length) showNotification(adj.join(' ')) }

    const getParticipantsAtMp = (mIdx) => {
        const mp = meetingPoints.value[mIdx]
        if (!mp.participations) return []
        return participants.value.filter(p => mp.participations[p.name] === 'yes').map(p => p.name)
    }

    const isParticipantPassengerAtMp = (pName, mIdx) => {
        const mp = meetingPoints.value[mIdx]
        return mp.participations && mp.participations[pName] === 'yes'
    }

    const getPassengersBoardingHere = (mIdx) => {
        const mp = meetingPoints.value[mIdx]
        if (!mp || !mp.participations) return []
        return participants.value
            .filter(p => mp.participations[p.name] === 'yes' && p.name !== mp.selectedDriver)
            .map(p => p.name)
    }

    const getPassengersFromPreviousSteps = (mIdx) => {
        const currentDriver = meetingPoints.value[mIdx]?.selectedDriver
        if (!currentDriver) return []
        let list = []
        for (let i = 0; i < mIdx; i++) {
            const mp = meetingPoints.value[i]
            if (mp && mp.selectedDriver === currentDriver && mp.participations) {
                const passengersAtI = participants.value
                    .filter(p => mp.participations[p.name] === 'yes' && p.name !== mp.selectedDriver)
                    .map(p => p.name)
                list = list.concat(passengersAtI)
            }
        }
        return [...new Set(list)]
    }

    const addParticipantToMp = (mIdx) => {
        const pName = selectedParticipantToAdd.value[mIdx]
        if (!pName) return
        selectedParticipantToAdd.value[mIdx] = null
        notifyAdjustments(changeRole(mIdx, pName, 'passenger'))
    }

    const removeParticipantFromMp = (mIdx, pName) => notifyAdjustments(changeRole(mIdx, pName, 'none'))

    const setDriver = (mIdx, pName) => {
        if (!pName) return
        notifyAdjustments(changeRole(mIdx, pName, 'car'))
    }

    const addParticipant = () => {
        const nextId = createParticipantId()
        participants.value.push({
            id: nextId,
            name: `Pers. ${participants.value.length + 1}`,
            query: '', suggestions: [], coords: null, isSelecting: false, selectedIndex: -1,
            consumption: fuelConsumption.value, fuelPrice: fuelPrice.value, fuelType: 'gazole', toll: 0
        })
        if (inputMode.value === 'carpool') debouncedRunVisualCarpoolRef(true)
    }

    const removeParticipant = (idx) => {
        const removedName = participants.value[idx].name
        participants.value.splice(idx, 1)
        meetingPoints.value.forEach(mp => {
            if (mp.participations) delete mp.participations[removedName]
            if (mp.selectedDriver === removedName) mp.selectedDriver = null
        })
        notifyAdjustments(fixScenario())
        debouncedRunVisualCarpoolRef(true)
    }

    const addMeetingPoint = () => {
        meetingPoints.value.push({
            query: '', suggestions: [], coords: null, isSelecting: false, selectedIndex: -1,
            participations: {}, selectedDriver: null
        })
    }

    const removeMeetingPoint = (idx) => {
        meetingPoints.value.splice(idx, 1)
        notifyAdjustments(fixScenario())
        debouncedRunVisualCarpoolRef(true)
    }

    const autoDetectMeetingPoints = async () => {
        if (!carpoolDestination.value.coords && carpoolDestination.value.query.trim().length >= 2) {
            const dataDest = await safeFetchJson(`https://api-adresse.data.gouv.fr/search/?q=${encodeURIComponent(carpoolDestination.value.query)}&limit=1`)
            if (dataDest && dataDest.features && dataDest.features.length > 0) {
                carpoolDestination.value.coords = { lat: dataDest.features[0].geometry.coordinates[1], lon: dataDest.features[0].geometry.coordinates[0] }
                carpoolDestination.value.query = formatAddress(dataDest.features[0])
            }
        }
        if (!carpoolDestination.value.coords) {
            showNotification("Veuillez d'abord renseigner la ville d'arrivée.")
            return
        }
        const activeParts = participants.value.filter(p => p.coords)
        if (activeParts.length < 2) {
            showNotification("Il faut au moins 2 participants avec domiciles.")
            return
        }
        if (activeParts.length > 12) {
            showNotification("La suggestion automatique est limitée à 12 participants.")
            return
        }

        showNotification("Recherche des meilleurs points de rendez-vous…")
        loading.value = true
        let res
        try {
            res = await suggestMeetingPoints({
                participants: activeParts.map(p => ({ name: p.name, coords: p.coords, label: p.query })),
                dest: carpoolDestination.value.coords,
                deps: { getJson: safeFetchJson }
            })
        } catch (e) {
            console.error('Suggestion de points de rendez-vous :', e)
            showNotification("Erreur pendant la recherche de points de rendez-vous.")
            return
        } finally {
            loading.value = false
        }
        if (!res.ok) {
            showNotification(res.message)          // on ne touche pas aux arrêts existants en cas d'échec
            return
        }

        const name = (i) => activeParts[i].name
        const newMps = []
        for (const car of res.cars) {
            const driverName = name(car.driver)
            car.stops.forEach((stop, i) => {
                const participations = { [driverName]: 'yes' }
                stop.passengers.forEach(idx => { participations[name(idx)] = 'yes' })
                newMps.push({
                    query: stop.label, suggestions: [], coords: stop.coords, selectedIndex: -1, edited: false,
                    participations, selectedDriver: driverName
                })
            })
        }
        meetingPoints.value = newMps
        const fixed = fixScenario()                             // garde-fou : le plan proposé doit être physiquement possible
        if (fixed.length) console.warn('Plan suggéré corrigé :', fixed)
        visualCarpoolResults.value = []
        suggestionSummary.value = {
            savingsKm: Math.round(res.summary.savingsKm),
            savingsPct: Math.round(res.summary.savingsPct * 100),
            approx: !!res.approx
        }

        const who = res.cars.map(c => `${name(c.driver)} conduit et récupère ${c.members.filter(m => m !== c.driver).map(name).join(', ')}`).join(' ; ')
        const solo = res.solos.length ? ` · Seul(s) : ${res.solos.map(name).join(', ')}` : ''
        const approx = res.approx ? ' (distances approchées : service de routage indisponible)' : ''
        showNotification(`${who}. Économie : ${Math.round(res.summary.savingsKm)} km (${Math.round(res.summary.savingsPct * 100)} %)${solo}${approx}`)
        debouncedRunVisualCarpoolRef(true)
    }

    const runVisualCarpool = async () => {
        const myToken = ++carpoolToken
        error.value = ''
        if (!carpoolDestination.value.coords && !carpoolDestination.value.edited && carpoolDestination.value.query.trim().length >= 2) {
            const dataDest = await safeFetchJson(`https://api-adresse.data.gouv.fr/search/?q=${encodeURIComponent(carpoolDestination.value.query)}&limit=1`)
            if (dataDest?.features?.length > 0) {
                carpoolDestination.value.coords = { lat: dataDest.features[0].geometry.coordinates[1], lon: dataDest.features[0].geometry.coordinates[0] }
                carpoolDestination.value.query = formatAddress(dataDest.features[0])
            }
        }
        if (!carpoolDestination.value.coords) return
        await Promise.all(participants.value.filter(p => !p.coords && !p.edited && p.query.trim().length >= 2).map(async (p) => {
            const dataP = await safeFetchJson(`https://api-adresse.data.gouv.fr/search/?q=${encodeURIComponent(p.query)}&limit=1`)
            if (dataP?.features?.length > 0) {
                p.coords = { lat: dataP.features[0].geometry.coordinates[1], lon: dataP.features[0].geometry.coordinates[0] }
                p.query = formatAddress(dataP.features[0])
            }
        }))
        if (myToken !== carpoolToken) return
        const activeParts = participants.value.filter(p => p.coords)
        if (activeParts.length === 0) return
        loading.value = true
        try {
            let results = []
            clearMarkers()
            const destIcon = L.divIcon({ className: 'custom-marker', html: '<div style="background-color: #dc2626;" class="text-white font-bold w-7 h-7 rounded-full flex items-center justify-center text-xs shadow-md border-2 border-white">🎯</div>', iconSize: [28, 28], iconAnchor: [14, 14] })
            mapState.markers.push(L.marker([carpoolDestination.value.coords.lat, carpoolDestination.value.coords.lon], { icon: destIcon }).addTo(mapState.map))
            meetingPoints.value.forEach((mp, i) => {
                if (!mp.coords) return
                const icon = L.divIcon({ className: 'custom-marker', html: `<div style="background-color: #059669;" class="text-white font-bold w-6 h-6 rounded-full flex items-center justify-center text-[10px] shadow-md border-2 border-white">${i + 1}</div>`, iconSize: [24, 24], iconAnchor: [12, 12] })
                const marker = L.marker([mp.coords.lat, mp.coords.lon], { icon, draggable: true }).addTo(mapState.map)
                marker.on('dragstart', () => { isDraggingMarker.value = true })
                marker.on('dragend', async (e) => {
                    const newLatLng = e.target.getLatLng()
                    mp.coords = { lat: newLatLng.lat, lon: newLatLng.lng }
                    const revData = await safeFetchJson(`https://api-adresse.data.gouv.fr/reverse/?lon=${newLatLng.lng}&lat=${newLatLng.lat}`)
                    mp.query = revData?.features?.length > 0 ? revData.features[0].properties.label : `${newLatLng.lat.toFixed(4)}, ${newLatLng.lng.toFixed(4)}`
                    isDraggingMarker.value = false
                    debouncedRunVisualCarpoolRef(true)
                })
                mapState.markers.push(marker)
            })
            activeParts.forEach(p => {
                const bgColor = getParticipantColor(p.id)
                mapState.markers.push(L.marker([p.coords.lat, p.coords.lon], { icon: L.divIcon({ className: 'custom-marker', html: `<div style="background-color: ${bgColor};" class="text-white font-bold w-6 h-6 rounded-full flex items-center justify-center text-[10px] shadow-md border-2 border-white">${p.name.substring(0, 2).toUpperCase()}</div>`, iconSize: [24, 24], iconAnchor: [12, 12] }) }).addTo(mapState.map))
            })
            fitMapToMarkers()
            let tracking = {}
            activeParts.forEach(p => { tracking[p.name] = { km: 0, steps: [`Trajet direct de ${p.query || 'Domicile'} à ${carpoolDestination.value.query || 'Destination'} (Solo)`], color: getParticipantColor(p.id), role: 'solo' } })
            let newRouteLayers = []
            const sim = simulateAll()
            const hasCoords = (k) => !!meetingPoints.value[k]?.coords
            const driverNames = scenarioNames().filter(n => sim.cars[n].stops.some(hasCoords))
            for (const driverName of driverNames) {
                const driverParticipant = participants.value.find(p => p.name === driverName && p.coords)
                if (!driverParticipant) continue
                const driverMps = sim.cars[driverName].stops.filter(hasCoords).map(k => ({ mp: meetingPoints.value[k], index: k }))
                if (driverMps.length === 0) continue
                // la voiture va jusqu'à l'arrêt où son propriétaire monte dans une autre voiture (elle y est laissée), sinon jusqu'à la destination
                const parkedIdx = sim.cars[driverName].parkedAt
                const nextMpAfter = parkedIdx !== null && hasCoords(parkedIdx) ? meetingPoints.value[parkedIdx] : null
                const carDestination = nextMpAfter ? nextMpAfter.coords : carpoolDestination.value.coords
                const chain = driverMps.map(x => x.mp)
                const waypoints = [driverParticipant.coords, ...chain.map(mp => mp.coords), carDestination]
                const dataDriver = await osrm(`https://router.project-osrm.org/route/v1/driving/${waypoints.map(c => `${c.lon},${c.lat}`).join(';')}?overview=full&geometries=geojson`)
                let driverTotalKm = 0
                if (dataDriver?.routes) {
                    driverTotalKm = dataDriver.routes[0].distance / 1000
                    newRouteLayers.push(L.polyline(dataDriver.routes[0].geometry.coordinates.map(c => [c[1], c[0]]), { color: getParticipantColor(driverParticipant.id), weight: 5 }))
                }
                tracking[driverName].km += driverTotalKm
                tracking[driverName].role = 'driver'
                let stepsText = chain.map((mp, i) => i === 0 ? `Départ ${driverParticipant.query} ➔ ${mp.query} (Conducteur)` : `Puis ${chain[i - 1].query} ➔ ${mp.query}`)
                stepsText.push(!nextMpAfter ? `Puis ${chain[chain.length - 1].query} ➔ ${carpoolDestination.value.query}` : `Puis ${chain[chain.length - 1].query} ➔ ${nextMpAfter.query} (voiture laissée ici)`)
                tracking[driverName].steps = stepsText
                for (const { mp, index } of driverMps) {
                    // seuls ceux qui arrivent avec leur propre voiture ont un trajet jusqu'à l'arrêt ; les autres changent de voiture sur place
                    const passengersHere = participants.value.filter(p => p.coords && sim.stops[index].arriving.includes(p.name))
                    await Promise.all(passengersHere.map(async (p) => {
                        const dataToMp = await osrm(`https://router.project-osrm.org/route/v1/driving/${p.coords.lon},${p.coords.lat};${mp.coords.lon},${mp.coords.lat}?overview=full&geometries=geojson`)
                        if (dataToMp?.routes) {
                            const kmToMp = dataToMp.routes[0].distance / 1000
                            newRouteLayers.push(L.polyline(dataToMp.routes[0].geometry.coordinates.map(c => [c[1], c[0]]), { color: getParticipantColor(p.id), weight: 3, dashArray: '4,4' }))
                            tracking[p.name].km += kmToMp
                            tracking[p.name].role = 'passenger'
                            tracking[p.name].steps = [`Départ ${p.query} ➔ ${mp.query} (Passager avec ${driverName})`]
                        }
                    }))
                }
            }
            await Promise.all(activeParts.map(async (p) => {
                const involved = sim.cars[p.name].stops.some(hasCoords) || (sim.parkedAt[p.name] !== undefined && hasCoords(sim.parkedAt[p.name]))
                if (!involved) {
                    const dataSolo = await osrm(`https://router.project-osrm.org/route/v1/driving/${p.coords.lon},${p.coords.lat};${carpoolDestination.value.coords.lon},${carpoolDestination.value.coords.lat}?overview=full&geometries=geojson`)
                    let soloKm = 0
                    if (dataSolo?.routes) {
                        soloKm = dataSolo.routes[0].distance / 1000
                        newRouteLayers.push(L.polyline(dataSolo.routes[0].geometry.coordinates.map(c => [c[1], c[0]]), { color: getParticipantColor(p.id), weight: 4 }))
                    }
                    tracking[p.name].km = soloKm
                    tracking[p.name].role = 'solo'
                    tracking[p.name].steps = [`Trajet direct de ${p.query || 'Domicile'} à ${carpoolDestination.value.query || 'Destination'} (Solo)`]
                }
            }))
            for (const p of activeParts) {
                const t = tracking[p.name]
                const finalKm = Math.round((isRoundTrip.value ? t.km * 2 : t.km) * 10) / 10
                const pConso = p.consumption !== undefined ? p.consumption : fuelConsumption.value
                const pPrice = p.fuelPrice !== undefined ? p.fuelPrice : fuelPrice.value
                const pToll = Number(p.toll || 0)
                const fuelCost = calcMode.value === 'bareme' ? finalKm * baremeRate.value : (finalKm / 100) * pConso * pPrice
                const totalAmount = fuelCost + pToll
                results.push({ name: p.name, km: finalKm, liters: ((finalKm * pConso) / 100).toFixed(1), consoDisplay: `${pConso} L/100km`, amount: totalAmount, toll: pToll, steps: t.steps, color: t.color, role: t.role, fuelPrice: pPrice })
            }
            if (myToken !== carpoolToken) return
            clearRoutes()
            newRouteLayers.forEach(l => { l.addTo(mapState.map); mapState.routeLayers.push(l) })
            visualCarpoolResults.value = results
        } catch (err) {
            if (myToken === carpoolToken) error.value = "Erreur lors du calcul du covoiturage."
        } finally {
            loading.value = false
        }
    }

    return {
        getParticipantColor, getParticipantColorByName,
        getParticipantsAtMp, addParticipantToMp, removeParticipantFromMp, setDriver,
        getPassengersFromPreviousSteps, getPassengersBoardingHere,
        addParticipant, removeParticipant, addMeetingPoint, removeMeetingPoint,
        autoDetectMeetingPoints, runVisualCarpool, suggestionSummary,
        simulateAll, roleOptions, changeRole, fixScenario, isDraggingMarker
    }
}