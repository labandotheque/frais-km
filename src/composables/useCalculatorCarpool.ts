// @ts-nocheck
import { ref } from 'vue'
import { safeFetchJson } from '../services/api'
import { formatAddress, cityOf } from '../utils/formatting'
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

    // ───────── Rendu carte / résultats (carpool)
    const CAR_LANE_SPACING_PX = 14                                // écartement en pixels entre les voies des voitures
    let lastFitKey = '', lastFitMap = null, ribbonOff = null

    // trajet « metro » d'une personne : étapes + voiture utilisée sur chaque tronçon (JSON brut, la vue décide de l'affichage)
    const buildJourney = (p, sim) => {
        const nodes = [{ type: 'home', label: p.query, city: cityOf(p.query) }]
        const segments = []
        let car = p.name
        meetingPoints.value.forEach((mp, k) => {
            const rec = sim.stops[k]
            if (!mp.coords || !rec?.valid || !rec.owner) return
            if (!(rec.owner === p.name || rec.boarding.includes(p.name) || rec.aboardBefore.includes(p.name))) return
            segments.push({ carOf: car })
            nodes.push({ type: 'stop', index: k, label: mp.query, city: cityOf(mp.query) })
            car = sim.carOfAfter[k][p.name]
        })
        segments.push({ carOf: car })
        nodes.push({ type: 'dest', label: carpoolDestination.value.query, city: cityOf(carpoolDestination.value.query) })
        return { nodes, segments }
    }

    const toLatLngs = (coords) => coords.map(c => [c[1], c[0]])

    // décale une polyligne de `px` pixels (écran) perpendiculairement à sa direction
    const offsetLatLngs = (map, latlngs, px) => {
        if (!px) return latlngs
        const pts = latlngs.map(ll => map.project(ll))
        return pts.map((p, i) => {
            const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)]
            const dx = b.x - a.x, dy = b.y - a.y, len = Math.hypot(dx, dy) || 1
            return map.unproject(L.point(p.x - (dy / len) * px, p.y + (dx / len) * px))
        })
    }

    const drawRibbons = (map, group, ribbons) => {
        group.clearLayers()
        for (const { latlngs, color, dash, laneOffset = 0 } of ribbons) {
            const lane = offsetLatLngs(map, latlngs, laneOffset)
            if (!dash) {
                // Contour sombre sous le ruban de la voiture pour détacher les voies parallèles
                group.addLayer(L.polyline(lane, {
                    color: '#0f172a', weight: 7, opacity: 0.35, lineCap: 'round', lineJoin: 'round'
                }))
            }
            group.addLayer(L.polyline(lane, {
                color, weight: dash ? 3 : 5, opacity: 0.95, lineCap: 'round', lineJoin: 'round',
                ...(dash ? { dashArray: '5,6' } : {})
            }))
        }
    }

    const runVisualCarpool = async (fitMap = true) => {
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

            // Initialisation de OverlappingMarkerSpiderfier (OMS) si non encore créé
            const OMSClass = window.OverlappingMarkerSpiderfier || L.OverlappingMarkerSpiderfier
            if (!mapState.oms && OMSClass) {
                mapState.oms = new OMSClass(mapState.map, {
                    keepSpiderfied: true,
                    nearbyDistance: 25,
                    circleFootSeparation: 30
                })
            }
            if (mapState.oms) {
                mapState.oms.clearMarkers()
            }

            // Destination
            if (carpoolDestination.value.coords) {
                const destIcon = L.divIcon({
                    className: 'custom-marker',
                    html: '<div style="background-color: #dc2626;" class="text-white font-bold w-7 h-7 rounded-full flex items-center justify-center text-xs shadow-md border-2 border-white">🎯</div>',
                    iconSize: [28, 28],
                    iconAnchor: [14, 14]
                })
                const destMarker = L.marker([carpoolDestination.value.coords.lat, carpoolDestination.value.coords.lon], { icon: destIcon }).addTo(mapState.map)
                mapState.markers.push(destMarker)
                if (mapState.oms) mapState.oms.addMarker(destMarker)
            }

            // Arrêts / Points de rendez-vous
            meetingPoints.value.forEach((mp, i) => {
                if (!mp.coords) return
                const icon = L.divIcon({
                    className: 'custom-marker',
                    html: `<div style="background-color: #059669;" class="text-white font-bold w-6 h-6 rounded-full flex items-center justify-center text-[10px] shadow-md border-2 border-white">${i + 1}</div>`,
                    iconSize: [24, 24],
                    iconAnchor: [12, 12]
                })
                const marker = L.marker([mp.coords.lat, mp.coords.lon], { icon, draggable: true }).addTo(mapState.map)
                marker.on('dragstart', () => { isDraggingMarker.value = true })
                marker.on('dragend', async (e) => {
                    const newLatLng = e.target.getLatLng()
                    mp.coords = { lat: newLatLng.lat, lon: newLatLng.lng }
                    const revData = await safeFetchJson(`https://api-adresse.data.gouv.fr/reverse/?lon=${newLatLng.lng}&lat=${newLatLng.lat}`)
                    mp.query = revData?.features?.length > 0 ? revData.features[0].properties.label : `${newLatLng.lat.toFixed(4)}, ${newLatLng.lng.toFixed(4)}`
                    isDraggingMarker.value = false
                    debouncedRunVisualCarpoolRef(true, false)      // pas de recadrage après un déplacement d'arrêt
                })
                mapState.markers.push(marker)
                if (mapState.oms) mapState.oms.addMarker(marker)
            })

            // Participants
            activeParts.forEach(p => {
                const bgColor = getParticipantColor(p.id)
                const icon = L.divIcon({
                    className: 'custom-marker',
                    html: `<div style="background-color: ${bgColor};" class="text-white font-bold w-6 h-6 rounded-full flex items-center justify-center text-[10px] shadow-md border-2 border-white">${p.name.substring(0, 2).toUpperCase()}</div>`,
                    iconSize: [24, 24],
                    iconAnchor: [12, 12]
                })
                const marker = L.marker([p.coords.lat, p.coords.lon], { icon }).addTo(mapState.map)
                mapState.markers.push(marker)
                if (mapState.oms) mapState.oms.addMarker(marker)
            })

            // recadrage uniquement si destination / domiciles / nombre d'arrêts ont changé, ou si la carte est neuve
            const fitKey = JSON.stringify([
                carpoolDestination.value.coords, activeParts.map(p => p.coords),
                meetingPoints.value.filter(m => m.coords).length
            ])
            if ((fitMap && fitKey !== lastFitKey) || mapState.map !== lastFitMap) fitMapToMarkers()
            lastFitKey = fitKey; lastFitMap = mapState.map

            const km = {}                                           // nom -> km parcourus (aller simple)
            const roles = Object.fromEntries(activeParts.map(p => [p.name, 'solo']))
            const ribbons = []                                      // { latlngs, color, dash?, laneOffset? }
            const sim = simulateAll()
            const hasCoords = (k) => !!meetingPoints.value[k]?.coords
            const route = (pts) => osrm(`https://router.project-osrm.org/route/v1/driving/${pts.map(c => `${c.lon},${c.lat}`).join(';')}?overview=full&geometries=geojson&steps=true`)
            activeParts.forEach(p => { km[p.name] = 0 })

            // Identification des voitures de covoiturage
            const carpoolDrivers = scenarioNames().filter(n => sim.cars[n]?.stops?.some(hasCoords))

            // Ne décaler que si au moins 2 voitures partagent le système de covoiturage
            const getCarOffset = (driverName) => {
                if (carpoolDrivers.length <= 1) return 0
                const idx = carpoolDrivers.indexOf(driverName)
                if (idx === -1) return 0
                return (idx - (carpoolDrivers.length - 1) / 2) * CAR_LANE_SPACING_PX
            }

            for (const driverName of carpoolDrivers) {
                const dp = participants.value.find(p => p.name === driverName && p.coords)
                if (!dp) continue
                const driverMps = sim.cars[driverName].stops.filter(hasCoords).map(k => ({ mp: meetingPoints.value[k], index: k }))
                if (!driverMps.length) continue

                // La voiture va jusqu'à l'arrêt où son propriétaire monte dans une autre voiture, sinon jusqu'à la destination
                const parkedIdx = sim.cars[driverName].parkedAt
                const carDest = parkedIdx !== null && hasCoords(parkedIdx) ? meetingPoints.value[parkedIdx].coords : carpoolDestination.value.coords
                const data = await route([dp.coords, ...driverMps.map(x => x.mp.coords), carDest])
                const r = data?.routes?.[0]
                if (r) {
                    km[driverName] += r.distance / 1000
                    ribbons.push({
                        latlngs: toLatLngs(r.geometry.coordinates),
                        color: getParticipantColorByName(driverName),
                        laneOffset: getCarOffset(driverName)
                    })
                }
                roles[driverName] = 'driver'

                // Trajets pointillés d'acheminement des passagers jusqu'à leur point de prise en charge (leur propre route)
                for (const { mp, index } of driverMps) {
                    const arriving = participants.value.filter(p => p.coords && sim.stops[index].arriving.includes(p.name))
                    await Promise.all(arriving.map(async (p) => {
                        const d = await route([p.coords, mp.coords])
                        const rr = d?.routes?.[0]
                        if (!rr) return
                        km[p.name] += rr.distance / 1000
                        roles[p.name] = 'passenger'
                        ribbons.push({
                            latlngs: toLatLngs(rr.geometry.coordinates),
                            color: getParticipantColorByName(p.name),
                            dash: true,
                            laneOffset: 0                           // Sa propre route de raccordement
                        })
                    }))
                }
            }

            // Trajets des participants se déplaçant seuls dans leur propre véhicule (sa propre route = pas de décalage)
            await Promise.all(activeParts.map(async (p) => {
                const involved = sim.cars[p.name]?.stops?.some(hasCoords) || (sim.parkedAt[p.name] !== undefined && hasCoords(sim.parkedAt[p.name]))
                if (involved) return
                const d = await route([p.coords, carpoolDestination.value.coords])
                const rr = d?.routes?.[0]
                km[p.name] = rr ? rr.distance / 1000 : 0
                if (rr) {
                    ribbons.push({
                        latlngs: toLatLngs(rr.geometry.coordinates),
                        color: getParticipantColorByName(p.name),
                        laneOffset: 0                               // Sa propre route directe
                    })
                }
            }))

            // résultats : données brutes uniquement, la vue décide de l'affichage
            for (const p of activeParts) {
                const finalKm = Math.round((isRoundTrip.value ? km[p.name] * 2 : km[p.name]) * 10) / 10
                const consumption = p.consumption !== undefined ? p.consumption : fuelConsumption.value
                const price = p.fuelPrice !== undefined ? p.fuelPrice : fuelPrice.value
                const toll = Number(p.toll || 0)
                const fuelCost = calcMode.value === 'bareme' ? finalKm * baremeRate.value : (finalKm / 100) * consumption * price
                results.push({
                    name: p.name, color: getParticipantColor(p.id), role: roles[p.name],
                    km: finalKm, liters: (finalKm * consumption) / 100, consumption, fuelPrice: price,
                    fuelCost, toll, amount: fuelCost + toll,
                    journey: buildJourney(p, sim)
                })
            }
            if (myToken !== carpoolToken) return

            clearRoutes()
            const map = mapState.map
            const group = L.layerGroup()
            drawRibbons(map, group, ribbons)
            group.addTo(map); mapState.routeLayers.push(group)
            ribbonOff?.()                                           // redessine les rubans au changement de zoom (largeur en pixels)
            const redraw = () => drawRibbons(map, group, ribbons)
            map.on('zoomend', redraw)
            ribbonOff = () => map.off('zoomend', redraw)

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