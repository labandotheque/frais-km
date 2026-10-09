// @ts-nocheck
/**
 * File d'attente partagée pour TOUS les appels à l'OSRM public (routeur basé sur OpenStreetMap).
 * Sa politique d'usage demande de ne pas dépasser 1 requête par seconde.
 *
 *  - séquentiel : une seule requête OSRM en vol à la fois, démarrages espacés d'au moins `minGapMs`
 *  - cache mémoire : une URL identique (mêmes coordonnées) n'est jamais redemandée pendant `ttlMs`
 *    -> recalculer la carte après une petite modification ne refait que les trajets qui ont changé
 *  - dédoublonnage : deux appels simultanés sur la même URL partagent une seule requête
 *  - repli : après un échec (429, réseau...), on attend `failureCooldownMs` avant la requête suivante
 *
 * Note : la limite s'applique par adresse IP, donc par navigateur. Cette file protège chaque utilisateur
 * individuellement ; si l'application grossit, il faudra un OSRM à soi (ou un proxy avec la même file).
 */
const cfg = { minGapMs: 1100, ttlMs: 10 * 60 * 1000, maxEntries: 300, failureCooldownMs: 5000 }
const sleep = (ms) => new Promise(r => setTimeout(r, ms))

let chain = Promise.resolve()
let lastStart = 0
let cooldownUntil = 0
const cache = new Map()      // url -> { t, data }
const inflight = new Map()   // url -> Promise

export function configureOsrmQueue(overrides) { Object.assign(cfg, overrides) }
export function resetOsrmQueue() { cache.clear(); inflight.clear(); lastStart = 0; cooldownUntil = 0 }

export function osrmJson(url, getJson) {
    const hit = cache.get(url)
    if (hit && Date.now() - hit.t < cfg.ttlMs) return Promise.resolve(hit.data)
    if (inflight.has(url)) return inflight.get(url)

    const run = chain.then(async () => {
        const wait = Math.max(lastStart + cfg.minGapMs, cooldownUntil) - Date.now()
        if (wait > 0) await sleep(wait)
        lastStart = Date.now()
        const data = await getJson(url)
        if (data) {
            cache.set(url, { t: Date.now(), data })
            if (cache.size > cfg.maxEntries) cache.delete(cache.keys().next().value)
        } else {
            cooldownUntil = Date.now() + cfg.failureCooldownMs
        }
        return data
    })
    chain = run.then(() => {}, () => {})
    const p = run.finally(() => inflight.delete(url))
    inflight.set(url, p)
    return p
}