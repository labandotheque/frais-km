// @ts-nocheck
import { ref } from 'vue'
import { safeFetchJson } from '../services/api'
import { formatAddress, cityOf } from '../utils/formatting'
import { suggestMeetingPoints } from '../services/carpool'
import { cfgsFromMeetingPoints, writeCfgsToMeetingPoints, simulateScenario, repairScenario, applyRole, roleAvailability } from '../utils/carpool-scenario'
import { osrmJson } from '../utils/osrm'
import { getParticipantColor, DESTINATION_COLOR, STOP_NEUTRAL_COLOR } from '../utils/participants'

export function useCalculatorCarpool({
    inputMode, carpoolDestination, participants, meetingPoints, visualCarpoolResults,
    selectedParticipantToAdd, isRoundTrip, calcMode, fuelConsumption, fuelPrice, baremeRate,
    tripMode, tripTotals, loading, error, mapState, clearMarkers, clearRoutes, fitMapToMarkers,
    showNotification, debouncedRunVisualCarpoolRef, createParticipantId
}) {
    let carpoolToken = 0
    const suggestionSummary = ref(null)      // résumé du dernier plan proposé (affiché par MeetingPoints.vue)
    const isDraggingMarker = ref(false)      // flag pour éviter le refit quand on drags un marqueur
    // Tous les appels à l'OSRM public passent par la file partagée (≤ 1 requête/s, cache, dédoublonnage)
    const osrm = (url) => osrmJson(url, safeFetchJson)

    const getParticipantColorByName = (pName) => {
        const p = participants.value.find(pp => pp.name === pName)
        return p ? getParticipantColor(p.id) : getParticipantColor(0)
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

    // ───────── Rendu carte / résultats (carpool + solo)
    const CAR_LANE_SPACING_PX = 14        // écartement entre les voies des voitures partagées
    const SOLO_LANE_SPACING_PX = 5        // en solo : les trajets qui empruntent la même route sont côte à côte
    const SPREAD_PX = 30                  // deux repères plus proches que ça (à l'écran) sont écartés en éventail
    let lastFitKey = '', lastFitMap = null, ribbonOff = null, layoutOff = null, decorGroup = null

    const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))

    // trajet « metro » d'une personne : étapes + voiture utilisée sur chaque tronçon (JSON brut, la vue décide de l'affichage)
    const buildJourney = (p, sim, solo = false) => {
        const nodes = [{ type: 'home', label: p.query, city: cityOf(p.query) }]
        const segments = []
        let car = p.name
        if (!solo) {
            meetingPoints.value.forEach((mp, k) => {
                const rec = sim.stops[k]
                if (!mp.coords || !rec?.valid || !rec.owner) return
                if (!(rec.owner === p.name || rec.boarding.includes(p.name) || rec.aboardBefore.includes(p.name))) return
                segments.push({ carOf: car })
                nodes.push({ type: 'stop', index: k, label: mp.query, city: cityOf(mp.query) })
                car = sim.carOfAfter[k][p.name]
            })
        }
        segments.push({ carOf: car })
        nodes.push({ type: 'dest', label: carpoolDestination.value.query, city: cityOf(carpoolDestination.value.query) })
        return { nodes, segments }
    }

    const toLatLngs = (coords) => coords.map(c => [c[1], c[0]])

    // Décale une polyligne de `px` pixels (écran) sur le côté.
    // 1. on simplifie d'abord en pixels (OSRM renvoie des milliers de points collés : leur direction n'est que du bruit)
    // 2. on décale segment par segment ; à chaque sommet, angle (« miter ») limité, et pour un virage très serré
    //    ou un demi-tour on coupe le coin au lieu de laisser la normale basculer d'un côté à l'autre (blobs)
    const offsetLatLngs = (map, latlngs, px) => {
        if (!px) return latlngs
        let pts = latlngs.map(ll => map.project(ll))
        if (pts.length > 2) pts = L.LineUtil.simplify(pts, 1.5)
        const normals = []
        const kept = [pts[0]]
        for (let i = 1; i < pts.length; i++) {
            const a = kept[kept.length - 1], b = pts[i]
            const dx = b.x - a.x, dy = b.y - a.y, len = Math.hypot(dx, dy)
            if (len < 0.5) continue
            kept.push(b)
            normals.push({ x: -dy / len, y: dx / len })
        }
        if (kept.length < 2) return latlngs
        const out = []
        const push = (p, n, k = 1) => out.push(map.unproject(L.point(p.x + n.x * px * k, p.y + n.y * px * k)))
        push(kept[0], normals[0])
        for (let i = 1; i < kept.length - 1; i++) {
            const n1 = normals[i - 1], n2 = normals[i]
            const dot = n1.x * n2.x + n1.y * n2.y
            if (dot < 0) { push(kept[i], n1); push(kept[i], n2); continue }       // virage > 90° : on coupe le coin
            const mx = n1.x + n2.x, my = n1.y + n2.y, ml = Math.hypot(mx, my) || 1
            const u = { x: mx / ml, y: my / ml }
            push(kept[i], u, Math.min(2, 1 / Math.max(0.5, u.x * n1.x + u.y * n1.y)))
        }
        push(kept[kept.length - 1], normals[normals.length - 1])
        return out
    }

    const drawRibbons = (map, group, ribbons) => {
        group.clearLayers()
        for (const { latlngs, color, dash, laneOffset = 0, weight = 5 } of ribbons) {
            const lane = offsetLatLngs(map, latlngs, laneOffset)
            if (!dash) {
                // Contour sombre sous le ruban de la voiture pour détacher les voies parallèles
                group.addLayer(L.polyline(lane, {
                    color: '#0f172a', weight: weight + 2, opacity: 0.35, lineCap: 'round', lineJoin: 'round'
                }))
            }
            group.addLayer(L.polyline(lane, {
                color, weight: dash ? 3 : weight, opacity: 0.95, lineCap: 'round', lineJoin: 'round',
                ...(dash ? { dashArray: '5,6' } : {})
            }))
        }
    }

    // ───────── Repères de la carte
    const badgeIcon = ({ bg, text, square = false, size = 26 }) => L.divIcon({
        className: 'custom-marker',
        html: `<div style="background-color: ${bg}; width: ${size}px; height: ${size}px;" class="text-white font-bold ${square ? 'rounded-md' : 'rounded-full'} flex items-center justify-center text-[10px] shadow-md border-2 border-white">${text}</div>`,
        iconSize: [size, size],
        iconAnchor: [size / 2, size / 2]
    })

    // Écarte en éventail les repères qui se chevauchent à l'écran (recalculé à chaque zoom).
    // Chaque repère déplacé reste relié par un trait fin à son vrai emplacement (petit point sombre).
    const layoutMarkers = (map, items, decor) => {
        decor.clearLayers()
        const pts = items.map(it => map.latLngToLayerPoint(it.ll))
        const parent = items.map((_, i) => i)
        const find = (i) => { while (parent[i] !== i) { parent[i] = parent[parent[i]]; i = parent[i] } return i }
        for (let i = 0; i < items.length; i++) {
            for (let j = i + 1; j < items.length; j++) {
                if (pts[i].distanceTo(pts[j]) < SPREAD_PX) parent[find(i)] = find(j)
            }
        }
        const groups = new Map()
        items.forEach((_, i) => {
            const root = find(i)
            if (!groups.has(root)) groups.set(root, [])
            groups.get(root).push(i)
        })
        for (const idxs of groups.values()) {
            if (idxs.length === 1) { items[idxs[0]].marker.setLatLng(items[idxs[0]].ll); continue }
            const k = idxs.length
            const cx = idxs.reduce((a, i) => a + pts[i].x, 0) / k
            const cy = idxs.reduce((a, i) => a + pts[i].y, 0) / k
            const radius = Math.max(24, SPREAD_PX / (2 * Math.sin(Math.PI / k)))
            const start = k === 2 ? Math.PI : -Math.PI / 2
            idxs.forEach((idx, n) => {
                const a = start + (2 * Math.PI * n) / k
                const ll = map.layerPointToLatLng(L.point(cx + radius * Math.cos(a), cy + radius * Math.sin(a)))
                const it = items[idx]
                it.marker.setLatLng(ll)
                decor.addLayer(L.polyline([it.ll, ll], { color: '#0f172a', weight: 1.5, opacity: 0.7, interactive: false }))
                decor.addLayer(L.circleMarker(it.ll, { radius: 3, color: '#ffffff', weight: 1.5, fillColor: '#0f172a', fillOpacity: 1, interactive: false }))
            })
        }
    }

    // ───────── Deux façons de rouler : chacun seul, ou le scénario de covoiturage
    const routeUrl = (pts) => `https://router.project-osrm.org/route/v1/driving/${pts.map(c => `${c.lon},${c.lat}`).join(';')}?overview=full&geometries=geojson&steps=true`

    // Solo : trajet direct domicile → destination pour chacun
    const planSolo = async (parts, route) => {
        const km = {}, roles = {}, ribbons = []
        const dest = carpoolDestination.value.coords
        const found = await Promise.all(parts.map(async (p) => {
            const r = (await route([p.coords, dest]))?.routes?.[0]
            return r ? { km: r.distance / 1000, latlngs: toLatLngs(r.geometry.coordinates) } : null
        }))
        parts.forEach((p, i) => {
            km[p.name] = found[i]?.km ?? 0
            roles[p.name] = 'solo'
            if (found[i]) {
                ribbons.push({
                    latlngs: found[i].latlngs, color: getParticipantColor(p.id), weight: 4,
                    laneOffset: parts.length > 1 ? (i - (parts.length - 1) / 2) * SOLO_LANE_SPACING_PX : 0
                })
            }
        })
        return { km, roles, ribbons }
    }

    // Covoiturage : voitures qui passent par les arrêts + trajets d'acheminement + ceux qui roulent seuls
    const planCarpoolMode = async (parts, sim, route) => {
        const km = {}, roles = {}, ribbons = []
        parts.forEach(p => { km[p.name] = 0; roles[p.name] = 'solo' })
        const hasCoords = (k) => !!meetingPoints.value[k]?.coords
        const destCoords = carpoolDestination.value.coords

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
            const carDest = parkedIdx !== null && hasCoords(parkedIdx) ? meetingPoints.value[parkedIdx].coords : destCoords
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
                        laneOffset: 0
                    })
                }))
            }
        }

        // Participants qui roulent seuls dans leur propre véhicule (sa propre route = pas de décalage)
        await Promise.all(parts.map(async (p) => {
            const involved = sim.cars[p.name]?.stops?.some(hasCoords) || (sim.parkedAt[p.name] !== undefined && hasCoords(sim.parkedAt[p.name]))
            if (involved) return
            const d = await route([p.coords, destCoords])
            const rr = d?.routes?.[0]
            km[p.name] = rr ? rr.distance / 1000 : 0
            if (rr) {
                ribbons.push({
                    latlngs: toLatLngs(rr.geometry.coordinates),
                    color: getParticipantColorByName(p.name),
                    laneOffset: 0
                })
            }
        }))
        return { km, roles, ribbons }
    }

    // résultats : données brutes uniquement, la vue décide de l'affichage
    const buildResults = (parts, plan, sim, solo) => parts.map((p) => {
        const oneWay = plan.km[p.name] || 0
        const finalKm = Math.round((isRoundTrip.value ? oneWay * 2 : oneWay) * 10) / 10
        const consumption = p.consumption !== undefined ? p.consumption : fuelConsumption.value
        const price = p.fuelPrice !== undefined ? p.fuelPrice : fuelPrice.value
        const toll = Number(p.toll || 0)
        const fuelCost = calcMode.value === 'bareme' ? finalKm * baremeRate.value : (finalKm / 100) * consumption * price
        return {
            name: p.name, color: getParticipantColor(p.id), role: plan.roles[p.name],
            km: finalKm, liters: (finalKm * consumption) / 100, consumption, fuelPrice: price,
            fuelCost, toll, amount: fuelCost + toll,
            journey: buildJourney(p, sim, solo)
        }
    })
    const totalOf = (results) => results.reduce((a, r) => a + r.amount, 0)
    const kmOf = (results) => results.reduce((a, r) => a + r.km, 0)
    // tripTotals = { carpool: €, solo: €, carpoolKm, soloKm }
    const setTotal = (mode, euros, km) => { if (tripTotals) tripTotals.value = { ...tripTotals.value, [mode]: euros, [`${mode}Km`]: km } }

    const runVisualCarpool = async (fitMap = true) => {
        const myToken = ++carpoolToken
        const alive = () => myToken === carpoolToken
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
        if (!alive()) return
        const parts = participants.value.filter(p => p.coords)
        if (parts.length === 0 || !mapState.map) return
        const solo = tripMode?.value === 'solo'
        // Une exécution périmée ne met plus rien dans la file OSRM
        const route = (pts) => alive() ? osrm(routeUrl(pts)) : Promise.resolve(null)

        loading.value = true
        try {
            const map = mapState.map
            clearMarkers()
            decorGroup?.remove()
            decorGroup = L.layerGroup().addTo(map)
            const sim = simulateAll()

            // Repères (créés à leur vraie position ; l'éventail est calculé ensuite)
            const items = []
            const addItem = (latlng, icon, options = {}) => {
                const marker = L.marker(latlng, { icon, ...options }).addTo(map)
                mapState.markers.push(marker)
                items.push({ marker, ll: L.latLng(latlng) })
                return marker
            }

            if (carpoolDestination.value.coords) {
                const d = carpoolDestination.value.coords
                addItem([d.lat, d.lon], badgeIcon({ bg: DESTINATION_COLOR, text: '🎯', size: 28 }),
                    { zIndexOffset: 1000, title: carpoolDestination.value.query || 'Destination' })
            }

            // Arrêts : seulement en covoiturage (en solo ils sont conservés mais masqués)
            if (!solo) {
                meetingPoints.value.forEach((mp, i) => {
                    if (!mp.coords) return
                    const owner = sim.stops[i]?.owner
                    const marker = addItem([mp.coords.lat, mp.coords.lon],
                        badgeIcon({ bg: owner ? getParticipantColorByName(owner) : STOP_NEUTRAL_COLOR, text: String(i + 1), square: true }),
                        { draggable: true, zIndexOffset: 500, title: mp.query || `Arrêt ${i + 1}` })
                    marker.on('dragstart', () => { isDraggingMarker.value = true })
                    marker.on('dragend', async (e) => {
                        const newLatLng = e.target.getLatLng()
                        mp.coords = { lat: newLatLng.lat, lon: newLatLng.lng }
                        const revData = await safeFetchJson(`https://api-adresse.data.gouv.fr/reverse/?lon=${newLatLng.lng}&lat=${newLatLng.lat}`)
                        mp.query = revData?.features?.length > 0 ? revData.features[0].properties.label : `${newLatLng.lat.toFixed(4)}, ${newLatLng.lng.toFixed(4)}`
                        isDraggingMarker.value = false
                        debouncedRunVisualCarpoolRef(true, false)      // pas de recadrage après un déplacement d'arrêt
                    })
                })
            }

            // Domiciles
            parts.forEach(p => {
                addItem([p.coords.lat, p.coords.lon],
                    badgeIcon({ bg: getParticipantColor(p.id), text: esc(p.name.substring(0, 2).toUpperCase()) }),
                    { title: p.name })
            })

            // recadrage uniquement si destination / domiciles / nombre d'arrêts ont changé, ou si la carte est neuve
            const fitKey = JSON.stringify([
                carpoolDestination.value.coords, parts.map(p => p.coords),
                solo ? 0 : meetingPoints.value.filter(m => m.coords).length
            ])
            if ((fitMap && fitKey !== lastFitKey) || map !== lastFitMap) fitMapToMarkers()
            lastFitKey = fitKey; lastFitMap = map

            // éventail pour les repères qui se chevauchent, recalculé à chaque zoom
            layoutOff?.()
            const relayout = () => layoutMarkers(map, items, decorGroup)
            relayout()
            map.on('zoomend', relayout)
            layoutOff = () => map.off('zoomend', relayout)

            // Mode affiché d'abord, puis l'autre mode en arrière-plan (uniquement pour comparer les totaux)
            const primary = solo ? await planSolo(parts, route) : await planCarpoolMode(parts, sim, route)
            if (!alive()) return
            const results = buildResults(parts, primary, sim, solo)

            clearRoutes()
            const group = L.layerGroup()
            drawRibbons(map, group, primary.ribbons)
            group.addTo(map); mapState.routeLayers.push(group)
            ribbonOff?.()                                           // redessine les rubans au changement de zoom (largeur en pixels)
            const redraw = () => drawRibbons(map, group, primary.ribbons)
            map.on('zoomend', redraw)
            ribbonOff = () => map.off('zoomend', redraw)

            visualCarpoolResults.value = results
            setTotal(solo ? 'solo' : 'carpool', totalOf(results), kmOf(results))
            loading.value = false

            const other = solo ? await planCarpoolMode(parts, sim, route) : await planSolo(parts, route)
            if (alive()) {
                const otherResults = buildResults(parts, other, sim, !solo)
                setTotal(solo ? 'carpool' : 'solo', totalOf(otherResults), kmOf(otherResults))
            }
        } catch (err) {
            console.error('Calcul du covoiturage :', err)
            if (alive()) error.value = "Erreur lors du calcul du covoiturage."
        } finally {
            if (alive()) loading.value = false
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