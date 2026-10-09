// @ts-nocheck
/**
 * Suggestion de points de rendez-vous : les points sont EXCLUSIVEMENT des lieux de la base nationale
 * des lieux de covoiturage (BNLC) — jamais un domicile ni la destination.
 *
 * Requêtes réseau :
 *   1. BNLC (data.gouv.fr)  : 1 page (200 lieux), 2 au maximum si la 1re est pleine ; cache 30 min par zone
 *   2. OSRM /table          : 1 requête pour toutes les distances (via la file osrmQueue : ≤ 1 requête/s, cache)
 *   3. géocodage inverse    : seulement pour un lieu BNLC sans adresse/commune (rare)
 * Soit 2 requêtes dans le cas courant, 0 si la zone est déjà en cache ou s'il n'y a aucun lieu.
 */
import { planCarpool, perPersonKm, haversineKm } from '../utils/carpool'
import { osrmJson } from '../utils/osrm'

const BNLC_URL = 'https://tabular-api.data.gouv.fr/api/resources/4fd78dee-e122-4c0d-8bf6-ff55d79f3af1/data/'
const OSRM_URL = 'https://router.project-osrm.org'
const BAN_REVERSE_URL = 'https://api-adresse.data.gouv.fr/reverse/'

const BNLC_PAGE_SIZE = 200
const BNLC_MAX_PAGES = 2
const BNLC_TTL_MS = 30 * 60 * 1000
const MAX_CANDIDATES = 30
const MIN_SPACING_KM = 0.7
const MAX_SNAP_M = 300            // un lieu à > 300 m d'une route n'est pas exploitable

const BNLC_QUALITY = {
    'Aire de covoiturage': 1.0, 'Parking relais': 0.9, "Sortie d'autoroute": 0.8,
    'Parking': 0.7, 'Supermarché': 0.6, 'Délaissé routier': 0.5
}

const fmt = (n) => Number(n).toFixed(5)
const bnlcCache = new Map()      // clé de zone -> { t, rows }

// ------------------------------------------------------------------ BNLC
function gridBbox(points, pad) {            // arrondi à 0,1° vers l'extérieur : meilleures chances de réutiliser le cache
    const lat = points.map(p => p.lat), lon = points.map(p => p.lon)
    return {
        south: Math.floor((Math.min(...lat) - pad) * 10) / 10, north: Math.ceil((Math.max(...lat) + pad) * 10) / 10,
        west: Math.floor((Math.min(...lon) - pad) * 10) / 10, east: Math.ceil((Math.max(...lon) + pad) * 10) / 10
    }
}

async function fetchBnlc(bbox, getJson) {
    const key = `${bbox.south},${bbox.west},${bbox.north},${bbox.east}`
    const hit = bnlcCache.get(key)
    if (hit && Date.now() - hit.t < BNLC_TTL_MS) return hit.rows

    const params = new URLSearchParams({
        Xlong__greater: bbox.west, Xlong__less: bbox.east,
        Ylat__greater: bbox.south, Ylat__less: bbox.north, page_size: String(BNLC_PAGE_SIZE)
    })
    let url = `${BNLC_URL}?${params}`
    const rows = []
    let ok = false
    for (let page = 0; page < BNLC_MAX_PAGES && url; page++) {
        const res = await getJson(url)
        if (!res || !Array.isArray(res.data)) break
        ok = true
        for (const r of res.data) {
            const lat = Number(r.Ylat), lon = Number(r.Xlong)
            const base = BNLC_QUALITY[r.type]
            if (!isFinite(lat) || !isFinite(lon) || base === undefined) continue      // exclut « Auto-stop » et types inconnus
            const bonus = (Number(r.nbre_pl) >= 10 ? 0.03 : 0) + (String(r.lumiere).toLowerCase() === 'true' ? 0.02 : 0)
            const place = [r.ad_lieu, r.com_lieu].filter(Boolean).join(', ')
            rows.push({
                lat, lon, kind: r.type, quality: Math.min(1, base + bonus),
                label: [r.nom_lieu || r.type, place].filter(Boolean).join(' – '),
                needsReverse: !place
            })
        }
        // page suivante seulement si celle-ci est pleine (sinon il n'y a rien de plus)
        url = res.data.length >= BNLC_PAGE_SIZE && res.links && res.links.next ? res.links.next : null
    }
    if (ok) bnlcCache.set(key, { t: Date.now(), rows })      // on ne met pas en cache un échec
    return rows
}

// ------------------------------------------------------------------ préfiltrage (à vol d'oiseau, sans réseau)
function roughCost(c, homes, dest) {
    let best = Infinity
    for (let j = 0; j < homes.length; j++) {
        const hjd = haversineKm(homes[j], dest)
        const ex = haversineKm(homes[j], c) + haversineKm(c, dest) - hjd
        if (ex > 0.35 * hjd + 4 || haversineKm(c, dest) < 3) continue
        for (let i = 0; i < homes.length; i++) {
            if (i === j) continue
            const leg = haversineKm(homes[i], c)
            if (leg > 0.9 * haversineKm(homes[i], dest)) continue
            best = Math.min(best, ex + leg)
        }
    }
    return best
}

function thinCandidates(cands, homes, dest) {
    const scored = cands.map(c => ({ ...c, rough: roughCost(c, homes, dest) })).filter(c => isFinite(c.rough))
    scored.sort((a, b) => (a.rough - a.quality * 1.5) - (b.rough - b.quality * 1.5))
    const kept = []
    for (const c of scored) {
        if (kept.length >= MAX_CANDIDATES) break
        if (kept.every(k => haversineKm(k, c) >= MIN_SPACING_KM)) kept.push(c)
    }
    return kept
}

// ------------------------------------------------------------------ matrice OSRM
async function fetchMatrix(points, getJson) {
    const coords = points.map(p => `${fmt(p.lon)},${fmt(p.lat)}`).join(';')
    const data = await osrmJson(`${OSRM_URL}/table/v1/driving/${coords}?annotations=distance,duration`, getJson)
    if (!data || data.code !== 'Ok' || !data.distances) return null
    const conv = (m, k) => m.map(r => r.map(v => (v === null || v === undefined) ? Infinity : v / k))
    return { km: conv(data.distances, 1000), min: data.durations ? conv(data.durations, 60) : null, snap: (data.sources || []).map(s => s.distance ?? 0) }
}

function approxMatrix(points) {      // secours si OSRM est indisponible : vol d'oiseau × 1,3 à 70 km/h (aucune requête)
    const km = points.map((a, i) => points.map((b, j) => i === j ? 0 : haversineKm(a, b) * 1.3))
    return { km, min: km.map(r => r.map(x => x / 70 * 60)), snap: points.map(() => 0) }
}

async function reverseLabel(c, getJson) {
    const data = await getJson(`${BAN_REVERSE_URL}?lon=${fmt(c.lon)}&lat=${fmt(c.lat)}`)
    const addr = data?.features?.[0]?.properties?.label || `${c.lat.toFixed(4)}, ${c.lon.toFixed(4)}`
    return `${c.label} – ${addr}`
}

// ------------------------------------------------------------------ API publique
/**
 * @param participants [{ name, coords:{lat,lon} }]
 * @param dest         {lat, lon}
 * @param deps         { getJson(url) -> json|null }
 * @param options      surcharge de DEFAULT_OPTIONS (maxPassengers, maxDetourRatio, ...)
 */
export async function suggestMeetingPoints({ participants, dest, deps, options = {} }) {
    const getJson = deps.getJson
    const homes = participants.map(p => ({ lat: p.coords.lat, lon: p.coords.lon }))
    const n = homes.length

    // 1. lieux de covoiturage (BNLC)
    const bbox = gridBbox([...homes, dest], 0.06)
    const bnlc = await fetchBnlc(bbox, getJson)
    const candidates = thinCandidates(bnlc, homes, dest)
    if (!candidates.length) {
        return {
            ok: false, reason: 'no-places',
            message: bnlc.length
                ? 'Aucun lieu de covoiturage utile sur ces trajets. Ajoutez un point de rendez-vous à la main.'
                : 'Aucun lieu de covoiturage trouvé sur cette zone (base nationale vide ou indisponible). Ajoutez un point à la main.'
        }
    }

    // 2. une seule matrice de distances routières
    const points = [...homes, dest, ...candidates]
    let matrix = await fetchMatrix(points, getJson)
    let approx = false
    if (!matrix) { matrix = approxMatrix(points); approx = true }
    const km = matrix.km.map(r => r.slice())
    candidates.forEach((c, k) => {
        const node = n + 1 + k
        if (matrix.snap[node] > MAX_SNAP_M) for (let x = 0; x < km.length; x++) { km[node][x] = Infinity; km[x][node] = Infinity }
    })
    if (homes.some((_, i) => !isFinite(km[i][n]))) {
        return { ok: false, reason: 'unreachable', message: 'Un des domiciles n’est pas relié à la destination par la route.' }
    }

    // 3. résolution exacte — jamais de ramassage à domicile : seuls les lieux BNLC sont des points de rendez-vous
    const quality = [...homes.map(() => 0), 0, ...candidates.map(c => c.quality)]
    const plan = planCarpool({ n, km, min: matrix.min, quality, options: { allowHomePickup: false, ...options } })
    if (plan.reason === 'invalid') return { ok: false, reason: 'invalid', message: plan.message }
    const perPerson = perPersonKm(plan, n, km)
    if (!plan.cars.length) {
        return {
            ok: false, reason: 'no-profit', approx, plan, perPerson,
            message: 'Aucun covoiturage rentable : les trajets ne se croisent pas assez (détour conducteur ou trajet passager trop long).'
        }
    }

    // 4. libellés (déjà fournis par la BNLC ; géocodage inverse seulement si l'adresse manque)
    const cars = await Promise.all(plan.cars.map(async (car) => {
        const stops = await Promise.all(car.stops.map(async (s) => {
            const c = candidates[s.node - n - 1]
            const label = c.needsReverse ? await reverseLabel(c, getJson) : c.label
            return { coords: { lat: c.lat, lon: c.lon }, label, kind: c.kind, passengers: s.passengers }
        }))
        return { driver: car.driver, members: car.members, stops, routeKm: car.routeKm, extraKm: car.extraKm, totalKm: car.totalKm, savingsKm: car.savingsKm }
    }))
    cars.sort((a, b) => haversineKm(b.stops[0].coords, dest) - haversineKm(a.stops[0].coords, dest))

    return {
        ok: true, approx, plan, perPerson, cars, solos: plan.solos,
        summary: { totalKm: plan.totalKm, soloTotalKm: plan.soloTotalKm, savingsKm: plan.savingsKm, savingsPct: plan.savingsPct }
    }
}