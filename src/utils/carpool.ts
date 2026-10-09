// @ts-nocheck
/**
 * Planificateur de covoiturage — logique pure (aucun fetch, aucun Vue), donc testable.
 *
 * Problème : n participants (domiciles) vont vers une même destination D. On forme des voitures
 * (1 conducteur + passagers). Chaque passager rejoint le conducteur en un point de rendez-vous
 * (il y laisse sa voiture) ; le conducteur passe par les points de rendez-vous puis va à D.
 * Coût = km totaux de tous les véhicules (conducteurs + trajets des passagers jusqu'à leur RDV).
 *
 * Résolution EXACTE (n ≤ 12) :
 *   1. pour chaque sous-groupe possible, meilleure voiture (conducteur, points de RDV, ordre) ;
 *   2. programmation dynamique sur les sous-ensembles pour trouver la meilleure partition en voitures.
 * Rien d'heuristique sauf le préfiltrage des candidats par passager (top-K), qui ne retire que des
 * points manifestement mauvais.
 *
 * Numérotation des nœuds dans les matrices : domiciles 0..n-1, destination n, candidats n+1...
 */

export const DEFAULT_OPTIONS = {
    maxPassengers: 4,            // passagers par voiture (voiture 4 places)
    maxDetourRatio: 0.25,        // détour max du conducteur : 25 % de son trajet solo...
    maxDetourKm: 30,             // ...plafonné à 30 km...
    minDetourAllowanceKm: 5,     // ...mais toujours au moins 5 km (trajets courts)
    maxDetourMin: 25,            // idem en minutes (si durées fournies)
    minDetourAllowanceMin: 8,
    maxPassengerLegRatio: 0.85,  // le trajet d'un passager jusqu'au RDV doit être < 85 % de son trajet solo
    minStopToDestKm: 3,          // un RDV doit être à ≥ 3 km de la destination...
    minStopToDestRatio: 0.08,    // ...et à ≥ 8 % du trajet solo du conducteur
    minCarSavingsKm: 3,          // une voiture n'est formée que si elle économise ≥ 3 km...
    minCarSavingsRatio: 0.05,    // ...et ≥ 5 % des km solo du groupe
    driverPenalty: 0.2,          // à coût total égal, on préfère charger moins le conducteur
    qualityWeightKm: 2,          // un lieu peu fiable (point sur la route) coûte jusqu'à 2 km de pénalité
    optionsPerPassenger: 10,     // candidats retenus par passager (préfiltrage)
    allowHomePickup: true,      // désactivé : les rendez-vous sont des lieux de covoiturage, pas des domiciles
    homeQuality: 0.9,
    maxParticipants: 12
}

const EARTH_KM = 6371.0088
export function haversineKm(a, b) {
    const r = Math.PI / 180
    const dLat = (b.lat - a.lat) * r, dLon = (b.lon - a.lon) * r
    const s = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin(dLon / 2) ** 2
    return 2 * EARTH_KM * Math.asin(Math.min(1, Math.sqrt(s)))
}

const popcount = (x) => { let c = 0; while (x) { x &= x - 1; c++ } return c }

function permutations(arr) {
    if (arr.length <= 1) return [arr]
    const out = []
    for (let i = 0; i < arr.length; i++) {
        const rest = [...arr.slice(0, i), ...arr.slice(i + 1)]
        for (const p of permutations(rest)) out.push([arr[i], ...p])
    }
    return out
}

/**
 * @param {object} input
 *   n         nombre de participants
 *   km        matrice km[a][b] (Infinity si inaccessible), nœuds: domiciles, destination, candidats
 *   min       (optionnel) matrice des durées en minutes
 *   quality   quality[node] ∈ [0,1] pour les candidats (1 = aire de covoiturage officielle)
 *   options   surcharge de DEFAULT_OPTIONS
 */
export function planCarpool(input) {
    const o = { ...DEFAULT_OPTIONS, ...(input.options || {}) }
    const { n, km: M, min: T = null, quality = [] } = input
    const D = n
    const N = M.length
    if (n < 2) return emptyPlan(n, M, 'Il faut au moins 2 participants.')
    if (n > o.maxParticipants) return emptyPlan(n, M, `Optimisation exacte limitée à ${o.maxParticipants} participants.`)

    const q = (node) => (node < n ? o.homeQuality : (quality[node] ?? 0.5))
    const soloKm = (i) => M[i][D]
    const allowKm = (d) => Math.max(o.minDetourAllowanceKm, Math.min(o.maxDetourKm, o.maxDetourRatio * M[d][D]))
    const allowMin = (d) => T ? Math.max(o.minDetourAllowanceMin, Math.min(o.maxDetourMin, o.maxDetourRatio * T[d][D])) : Infinity

    // ---------- meilleure voiture pour (conducteur d, passagers qs) ----------
    function planCar(d, qs) {
        if (!isFinite(soloKm(d))) return null
        const aKm = allowKm(d), aMin = allowMin(d)
        const minStop = Math.max(o.minStopToDestKm, o.minStopToDestRatio * soloKm(d))

        const perPassenger = []
        for (const p of qs) {
            if (!isFinite(soloKm(p))) return null
            const opts = []
            const consider = (s) => {
                const leg = s === p ? 0 : M[p][s]
                const dToS = M[d][s], sToD = M[s][D]
                if (!isFinite(leg) || !isFinite(dToS) || !isFinite(sToD)) return
                if (s !== p && leg > o.maxPassengerLegRatio * soloKm(p)) return
                if (sToD < minStop) return
                const ex = dToS + sToD - M[d][D]
                if (ex > aKm) return
                if (T && T[d][s] + T[s][D] - T[d][D] > aMin) return
                const qpen = (1 - q(s)) * o.qualityWeightKm
                opts.push({ s, leg, qpen, score: leg + Math.max(0, ex) + qpen })
            }
            for (let s = n + 1; s < N; s++) consider(s)
            if (o.allowHomePickup) consider(p)
            opts.sort((a, b) => a.score - b.score)
            if (opts.length === 0) return null
            perPassenger.push(opts.slice(0, o.optionsPerPassenger))
        }

        let best = null
        const chosen = new Array(qs.length)
        ;(function rec(i) {
            if (i === qs.length) { evaluate(); return }
            for (const opt of perPassenger[i]) { chosen[i] = opt; rec(i + 1) }
        })(0)
        return best

        function evaluate() {
            const stopsMap = new Map()           // node -> passagers
            let legSum = 0, qualSum = 0
            chosen.forEach((opt, i) => {
                legSum += opt.leg
                if (!stopsMap.has(opt.s)) { stopsMap.set(opt.s, []); qualSum += opt.qpen }
                stopsMap.get(opt.s).push(qs[i])
            })
            const nodes = [...stopsMap.keys()]
            let bestRoute = Infinity, bestOrder = null
            for (const perm of permutations(nodes)) {
                let r = M[d][perm[0]]
                for (let k = 0; k + 1 < perm.length; k++) r += M[perm[k]][perm[k + 1]]
                r += M[perm[perm.length - 1]][D]
                if (r < bestRoute) { bestRoute = r; bestOrder = perm }
            }
            if (!isFinite(bestRoute)) return
            const extra = bestRoute - soloKm(d)
            if (extra > aKm) return
            if (T) {
                let t = T[d][bestOrder[0]]
                for (let k = 0; k + 1 < bestOrder.length; k++) t += T[bestOrder[k]][bestOrder[k + 1]]
                t += T[bestOrder[bestOrder.length - 1]][D]
                if (t - T[d][D] > aMin) return
            }
            const total = bestRoute + legSum
            const cost = total + o.driverPenalty * Math.max(0, extra) + qualSum
            if (!best || cost < best.cost) {
                best = {
                    driver: d, cost, totalKm: total, routeKm: bestRoute, extraKm: extra,
                    stops: bestOrder.map(node => ({ node, passengers: stopsMap.get(node) })),
                    legs: Object.fromEntries(chosen.map((opt, i) => [qs[i], opt.leg]))
                }
            }
        }
    }

    // ---------- meilleure voiture pour un groupe (choix du conducteur) ----------
    const carCache = new Map()
    function bestCar(mask) {
        if (carCache.has(mask)) return carCache.get(mask)
        const members = []
        for (let i = 0; i < n; i++) if (mask & (1 << i)) members.push(i)
        let best = null
        if (members.length >= 2 && members.length - 1 <= o.maxPassengers) {
            const soloSum = members.reduce((a, i) => a + soloKm(i), 0)
            for (const d of members) {
                const plan = planCar(d, members.filter(m => m !== d))
                if (!plan) continue
                const savings = soloSum - plan.totalKm
                if (savings < Math.max(o.minCarSavingsKm, o.minCarSavingsRatio * soloSum)) continue
                plan.savingsKm = savings
                plan.members = members
                if (!best || plan.cost < best.cost) best = plan
            }
        }
        carCache.set(mask, best)
        return best
    }

    // ---------- DP sur les sous-ensembles : meilleure partition en voitures ----------
    const full = (1 << n) - 1
    const dp = new Float64Array(full + 1).fill(Infinity)
    const choice = new Int32Array(full + 1)
    dp[0] = 0
    for (let mask = 1; mask <= full; mask++) {
        const low = mask & -mask, rest = mask ^ low
        for (let sub = rest; ; sub = (sub - 1) & rest) {
            const group = sub | low
            let c
            if (group === low) c = soloKm(Math.log2(low))
            else { const car = bestCar(group); c = car ? car.cost : Infinity }
            const cand = dp[mask ^ group] + c
            if (cand < dp[mask]) { dp[mask] = cand; choice[mask] = group }
            if (sub === 0) break
        }
    }

    const cars = [], solos = []
    for (let mask = full; mask;) {
        const group = choice[mask]
        if (popcount(group) === 1) solos.push(Math.log2(group))
        else cars.push(bestCar(group))
        mask ^= group
    }
    solos.sort((a, b) => a - b)

    const soloTotalKm = Array.from({ length: n }, (_, i) => soloKm(i)).reduce((a, b) => a + b, 0)
    const totalKm = cars.reduce((a, c) => a + c.totalKm, 0) + solos.reduce((a, i) => a + soloKm(i), 0)
    const result = {
        cars, solos, totalKm, soloTotalKm,
        savingsKm: soloTotalKm - totalKm,
        savingsPct: soloTotalKm > 0 ? (soloTotalKm - totalKm) / soloTotalKm : 0,
        reason: cars.length === 0 ? 'no-profit' : null
    }
    Object.defineProperty(result, '_bestCar', { value: bestCar, enumerable: false })   // pour les tests
    return result
}

function emptyPlan(n, M, message) {
    const soloTotalKm = Array.from({ length: n }, (_, i) => M[i]?.[n] ?? 0).reduce((a, b) => a + b, 0)
    return { cars: [], solos: Array.from({ length: n }, (_, i) => i), totalKm: soloTotalKm, soloTotalKm, savingsKm: 0, savingsPct: 0, reason: 'invalid', message }
}

/** Kilomètres de chaque participant dans le plan (pour afficher « avant → après »). */
export function perPersonKm(plan, n, M) {
    const out = Array.from({ length: n }, (_, i) => ({ index: i, soloKm: M[i][n], planKm: M[i][n], role: 'solo' }))
    for (const car of plan.cars) {
        out[car.driver].planKm = car.routeKm; out[car.driver].role = 'driver'
        for (const [p, leg] of Object.entries(car.legs)) { out[p].planKm = leg; out[p].role = 'passenger' }
    }
    return out
}