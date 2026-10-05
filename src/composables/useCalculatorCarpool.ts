// @ts-nocheck
import { safeFetchJson } from '../services/api'
import { formatAddress } from '../utils/formatting'
import { getDistanceKm } from '../utils/distance'

export function useCalculatorCarpool({
    inputMode, carpoolDestination, participants, meetingPoints, visualCarpoolResults,
    selectedParticipantToAdd, isRoundTrip, calcMode, fuelConsumption, fuelPrice, baremeRate,
    loading, error, mapState, clearMarkers, clearRoutes, fitMapToMarkers,
    showNotification, debouncedRunVisualCarpoolRef, createParticipantId
}) {
    let carpoolToken = 0

    const participantColors = ['#4f46e5', '#10b981', '#f59e0b', '#ec4899', '#8b5cf6', '#06b6d4']
    const getParticipantColor = (id) => participantColors[id % participantColors.length]
    const getParticipantColorByName = (pName) => {
        const p = participants.value.find(pp => pp.name === pName)
        return p ? getParticipantColor(p.id) : participantColors[0]
    }

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
        const mp = meetingPoints.value[mIdx]
        if (!mp.participations) mp.participations = {}
        mp.participations[pName] = 'yes'
        if (mp.selectedDriver === pName) mp.selectedDriver = null
        selectedParticipantToAdd.value[mIdx] = null
        debouncedRunVisualCarpoolRef(true)
    }

    const removeParticipantFromMp = (mIdx, pName) => {
        const mp = meetingPoints.value[mIdx]
        if (mp.participations) delete mp.participations[pName]
        if (mp.selectedDriver === pName) mp.selectedDriver = null
        debouncedRunVisualCarpoolRef(true)
    }

    const setDriver = (mIdx, pName) => {
        if (!pName) return
        if (isParticipantPassengerAtMp(pName, mIdx)) {
            showNotification(`${pName} est déjà passager à cet arrêt. Retirez-le des passagers de cet arrêt avant de le désigner conducteur.`)
            return
        }
        const mp = meetingPoints.value[mIdx]
        if (!mp.participations) mp.participations = {}
        mp.selectedDriver = pName
        mp.participations[pName] = 'yes'
        getPassengersFromPreviousSteps(mIdx).forEach(passName => { mp.participations[passName] = 'yes' })
        debouncedRunVisualCarpoolRef(true)
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
        meetingPoints.value = []
        visualCarpoolResults.value = []
        const dest = carpoolDestination.value.coords
        const sortedParts = [...activeParts].map(p => ({ participant: p, dist: getDistanceKm(p.coords.lat, p.coords.lon, dest.lat, dest.lon) }))
            .sort((a, b) => (b.dist - a.dist) || (a.participant.id - b.participant.id))
        const driverCandidate = sortedParts[0].participant
        const dataRouteDriver = await safeFetchJson(`https://router.project-osrm.org/route/v1/driving/${driverCandidate.coords.lon},${driverCandidate.coords.lat};${dest.lon},${dest.lat}?overview=full&geometries=geojson`)
        if (!dataRouteDriver || !dataRouteDriver.routes) {
            showNotification("Impossible de calculer l'itinéraire du conducteur principal.")
            return
        }
        let pickups = []
        try {
            const lineDriver = turf.lineString(dataRouteDriver.routes[0].geometry.coordinates)
            const routeLengthKm = turf.length(lineDriver, { units: 'kilometers' })
            for (const { participant: cand } of sortedParts.slice(1)) {
                const ptCand = turf.point([cand.coords.lon, cand.coords.lat])
                const nearest = turf.nearestPointOnLine(lineDriver, ptCand, { units: 'kilometers' })
                if (!nearest?.geometry?.coordinates) continue
                const [lon, lat] = nearest.geometry.coordinates
                const locationAlongRoute = nearest.properties.location || 0
                const distFromDest = getDistanceKm(lat, lon, dest.lat, dest.lon)
                if (distFromDest > routeLengthKm * 0.1 && locationAlongRoute > routeLengthKm * 0.05) pickups.push({ participant: cand, coords: { lat, lon }, locationAlongRoute })
            }
        } catch (e) {
            console.error("Erreur Turf.js projection amont:", e)
        }
        if (pickups.length === 0) {
            showNotification("Aucun point de covoiturage optimal trouvé : vos trajets ne se croisent pas assez.")
            return
        }
        pickups.sort((a, b) => (a.locationAlongRoute - b.locationAlongRoute) || (a.participant.id - b.participant.id))
        const MERGE_RADIUS_KM = 3
        let stops = []
        for (const pk of pickups) {
            const existing = stops.find(s => getDistanceKm(s.coords.lat, s.coords.lon, pk.coords.lat, pk.coords.lon) < MERGE_RADIUS_KM)
            if (existing) {
                existing.participants.push(pk.participant)
                existing.participants.sort((a, b) => a.id - b.id)
            } else stops.push({ coords: pk.coords, participants: [pk.participant] })
        }
        const labels = await Promise.all(stops.map(s => safeFetchJson(`https://api-adresse.data.gouv.fr/reverse/?lon=${s.coords.lon}&lat=${s.coords.lat}`)))
        stops.forEach((stop, i) => {
            const revData = labels[i]
            const label = revData?.features?.length > 0 ? revData.features[0].properties.label : `${stop.coords.lat.toFixed(4)}, ${stop.coords.lon.toFixed(4)}`
            const participations = { [driverCandidate.name]: 'yes' }
            stop.participants.forEach(p => { participations[p.name] = 'yes' })
            meetingPoints.value.push({ query: label, suggestions: [], coords: stop.coords, isSelecting: true, selectedIndex: -1, participations, selectedDriver: driverCandidate.name })
        })
        const stopsDesc = stops.map(s => s.participants.map(p => p.name).join(' et ')).join(', puis ')
        showNotification(`RDV intelligent créé : ${driverCandidate.name} récupère ${stopsDesc} en chemin !`)
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
                marker.on('dragend', async (e) => {
                    const newLatLng = e.target.getLatLng()
                    mp.coords = { lat: newLatLng.lat, lon: newLatLng.lng }
                    const revData = await safeFetchJson(`https://api-adresse.data.gouv.fr/reverse/?lon=${newLatLng.lng}&lat=${newLatLng.lat}`)
                    mp.query = revData?.features?.length > 0 ? revData.features[0].properties.label : `${newLatLng.lat.toFixed(4)}, ${newLatLng.lng.toFixed(4)}`
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
            const mpsWithDriver = meetingPoints.value.filter(mp => mp.coords && mp.selectedDriver)
            const driverNames = [...new Set(mpsWithDriver.map(mp => mp.selectedDriver))]
            for (const driverName of driverNames) {
                const driverParticipant = participants.value.find(p => p.name === driverName && p.coords)
                if (!driverParticipant) continue
                const driverMps = meetingPoints.value.map((mp, index) => ({ mp, index })).filter(x => x.mp.coords && x.mp.selectedDriver === driverName)
                if (driverMps.length === 0) continue
                const lastStopIndex = driverMps[driverMps.length - 1].index
                const nextMpAfter = meetingPoints.value.slice(lastStopIndex + 1).find(mp => mp.coords)
                const carDestination = nextMpAfter ? nextMpAfter.coords : carpoolDestination.value.coords
                const chain = driverMps.map(x => x.mp)
                const legs = [{ from: driverParticipant.coords, to: chain[0].coords }]
                for (let i = 1; i < chain.length; i++) legs.push({ from: chain[i - 1].coords, to: chain[i].coords })
                legs.push({ from: chain[chain.length - 1].coords, to: carDestination })
                let driverTotalKm = 0
                for (const leg of legs) {
                    const dataLeg = await safeFetchJson(`https://router.project-osrm.org/route/v1/driving/${leg.from.lon},${leg.from.lat};${leg.to.lon},${leg.to.lat}?overview=full&geometries=geojson`)
                    if (dataLeg?.routes) {
                        driverTotalKm += dataLeg.routes[0].distance / 1000
                        newRouteLayers.push(L.polyline(dataLeg.routes[0].geometry.coordinates.map(c => [c[1], c[0]]), { color: getParticipantColor(driverParticipant.id), weight: 5 }))
                    }
                }
                tracking[driverName].km += driverTotalKm
                tracking[driverName].role = 'driver'
                let stepsText = chain.map((mp, i) => i === 0 ? `Départ ${driverParticipant.query} ➔ ${mp.query} (Conducteur)` : `Puis ${chain[i - 1].query} ➔ ${mp.query}`)
                stepsText.push(!nextMpAfter ? `Puis ${chain[chain.length - 1].query} ➔ ${carpoolDestination.value.query}` : `Puis ${chain[chain.length - 1].query} ➔ ${nextMpAfter.query} (Relais / Point de RDV suivant)`)
                tracking[driverName].steps = stepsText
                for (const mp of chain) {
                    const passengersHere = participants.value.filter(p => p.name !== driverName && mp.participations?.[p.name] === 'yes')
                    await Promise.all(passengersHere.map(async (p) => {
                        const dataToMp = await safeFetchJson(`https://router.project-osrm.org/route/v1/driving/${p.coords.lon},${p.coords.lat};${mp.coords.lon},${mp.coords.lat}?overview=full&geometries=geojson`)
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
                const isInValidMp = meetingPoints.value.some(mp => mp.coords && mp.selectedDriver && mp.participations?.[p.name] === 'yes')
                if (!isInValidMp) {
                    const dataSolo = await safeFetchJson(`https://router.project-osrm.org/route/v1/driving/${p.coords.lon},${p.coords.lat};${carpoolDestination.value.coords.lon},${carpoolDestination.value.coords.lat}?overview=full&geometries=geojson`)
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
            if (myToken === carpoolToken) loading.value = false
        }
    }

    return {
        getParticipantColor, getParticipantColorByName,
        getParticipantsAtMp, addParticipantToMp, removeParticipantFromMp, setDriver,
        getPassengersFromPreviousSteps, getPassengersBoardingHere,
        addParticipant, removeParticipant, addMeetingPoint, removeMeetingPoint,
        autoDetectMeetingPoints, runVisualCarpool
    }
}