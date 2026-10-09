// @ts-nocheck
/**
 * Règles physiques d'un scénario de covoiturage (logique pure, sans Vue ni réseau).
 *
 * Modèle : chaque personne possède UNE voiture (celle dont on paie l'essence ; qui est au volant importe peu).
 * Les arrêts sont ordonnés dans le temps. À un arrêt :
 *   - `driver` = le PROPRIÉTAIRE de la voiture qui repart de cet arrêt (« voiture de X »)
 *   - `boarding` = les personnes qui montent dedans (elles laissent leur voiture, ou descendent d'une voiture qui s'arrête là)
 *
 * Règles (une voiture est un objet physique : elle est quelque part, ou garée) :
 *   1. Une voiture garée à un arrêt ne repart plus : on ne peut pas « prendre la voiture d'Alice » à l'arrêt 3
 *      si Alice a laissé sa voiture à l'arrêt 1 pour monter chez Bob.
 *   2. Quelqu'un qui est à bord d'une voiture ne peut monter dans une autre que si cette voiture s'arrête là
 *      (donc son propriétaire monte aussi) — sinon il n'est tout simplement pas à cet arrêt.
 *   3. Quand une voiture est laissée à un arrêt, TOUS ses occupants doivent monter dans la voiture qui repart.
 *   4. Une voiture laissée à un arrêt va jusque-là : son trajet s'y termine (sinon : jusqu'à la destination).
 */

const sameSet = (a, b) => a.size === b.size && [...a].every(x => b.has(x))
export const cloneCfgs = (cfgs) => cfgs.map(c => ({ driver: c.driver ?? null, boarding: new Set(c.boarding) }))

/** meetingPoints (modèle de l'application) -> configuration d'arrêts */
export function cfgsFromMeetingPoints(meetingPoints) {
    return meetingPoints.map(mp => {
        const driver = mp.selectedDriver || null
        const boarding = new Set(Object.keys(mp.participations || {}).filter(n => mp.participations[n] === 'yes' && n !== driver))
        return { driver, boarding }
    })
}

/** configuration d'arrêts -> écrit dans meetingPoints (en place, sans remplacer les objets) */
export function writeCfgsToMeetingPoints(meetingPoints, cfgs) {
    cfgs.forEach((c, k) => {
        const mp = meetingPoints[k]
        if (!mp) return
        mp.selectedDriver = c.driver
        mp.participations = Object.fromEntries([...(c.driver ? [c.driver] : []), ...c.boarding].map(n => [n, 'yes']))
    })
}

/**
 * Simule le scénario arrêt par arrêt.
 * @returns { issues, incomplete, stops, cars, parkedAt, carOfBefore, carOfAfter }
 */
export function simulateScenario(names, cfgsIn) {
    const cfgs = cfgsIn.map(c => ({ driver: c.driver ?? null, boarding: new Set(c.boarding) }))
    const carOf = Object.fromEntries(names.map(n => [n, n]))
    const everOwner = new Set()
    const parkedAt = {}
    const cars = Object.fromEntries(names.map(n => [n, { stops: [], parkedAt: null }]))
    const issues = [], incomplete = [], stops = [], carOfBefore = [], carOfAfter = []

    cfgs.forEach((cfg, k) => {
        const before = { ...carOf }
        carOfBefore.push(before)
        const O = cfg.driver && names.includes(cfg.driver) ? cfg.driver : null
        const B = new Set([...cfg.boarding].filter(n => names.includes(n) && n !== O))
        const rec = { owner: O, valid: true, aboardBefore: [], arriving: [], carArriving: [], transferring: [], boarding: [...B], occupantsAfter: [] }
        stops.push(rec)

        if (!O) { incomplete.push(k); carOfAfter.push({ ...carOf }); return }

        // règle 1 : sa voiture doit encore être là
        if (before[O] !== O) {
            issues.push({ stop: k, code: 'car-unavailable', person: O, message: `La voiture de ${O} est restée à l'arrêt ${(parkedAt[O] ?? 0) + 1} : elle ne peut pas repartir de l'arrêt ${k + 1}.` })
            rec.valid = false
        }
        rec.aboardBefore = names.filter(n => n !== O && before[n] === O)

        // règle 2 : ceux qui montent doivent être présents à cet arrêt
        for (const p of B) {
            const c = before[p]
            if (c === p || c === O || B.has(c)) continue
            issues.push({ stop: k, code: 'not-at-stop', person: p, message: `${p} est dans la voiture de ${c}, qui ne s'arrête pas à l'arrêt ${k + 1}.` })
            rec.valid = false
        }
        // règle 3 : une voiture laissée ici emmène tous ses occupants
        for (const x of B) {
            if (before[x] !== x) continue
            const missing = names.filter(n => n !== x && before[n] === x && !B.has(n))
            if (missing.length) {
                issues.push({ stop: k, code: 'missing-occupants', person: x, message: `${x} laisse sa voiture à l'arrêt ${k + 1} : ${missing.join(', ')} ${missing.length > 1 ? 'doivent' : 'doit'} monter aussi.` })
                rec.valid = false
            }
        }

        if (rec.valid) {
            for (const p of B) {
                const c = before[p]
                if (c === O) continue                                  // déjà à bord
                if (c === p) {                                         // arrive avec sa propre voiture et la laisse ici
                    (everOwner.has(p) ? rec.carArriving : rec.arriving).push(p)
                    parkedAt[p] = k; cars[p].parkedAt = k
                } else rec.transferring.push(p)                        // descend d'une voiture qui s'arrête ici
                carOf[p] = O
            }
            everOwner.add(O)
            cars[O].stops.push(k)
        }
        rec.occupantsAfter = names.filter(n => carOf[n] === O)
        carOfAfter.push({ ...carOf })
    })
    return { issues, incomplete, stops, cars, parkedAt, carOfBefore, carOfAfter }
}

/**
 * Rend le scénario possible en retirant/complétant ce qui ne l'est pas, arrêt par arrêt.
 * @returns { cfgs, adjustments: string[] }
 */
export function repairScenario(names, cfgsIn) {
    const cfgs = cloneCfgs(cfgsIn)
    const adjustments = []
    const carOf = Object.fromEntries(names.map(n => [n, n]))
    const parkedAt = {}

    cfgs.forEach((cfg, k) => {
        if (cfg.driver && !names.includes(cfg.driver)) cfg.driver = null
        cfg.boarding = new Set([...cfg.boarding].filter(n => names.includes(n) && n !== cfg.driver))
        const before = { ...carOf }

        if (cfg.driver && before[cfg.driver] !== cfg.driver) {
            adjustments.push(`Arrêt ${k + 1} : la voiture de ${cfg.driver} est restée à l'arrêt ${(parkedAt[cfg.driver] ?? 0) + 1}, elle n'est plus choisie.`)
            cfg.driver = null
        }
        const O = cfg.driver
        if (!O) return                                                 // arrêt incomplet : rien ne bouge

        // règle 2, jusqu'à stabilité (retirer quelqu'un peut en rendre un autre absent)
        let changed = true
        while (changed) {
            changed = false
            for (const p of [...cfg.boarding]) {
                const c = before[p]
                if (c === p || c === O || cfg.boarding.has(c)) continue
                cfg.boarding.delete(p)
                adjustments.push(`Arrêt ${k + 1} : ${p} retiré(e), déjà dans la voiture de ${c}.`)
                changed = true
            }
            // règle 3 : les occupants d'une voiture laissée ici suivent
            for (const x of [...cfg.boarding]) {
                if (before[x] !== x) continue
                const missing = names.filter(n => n !== x && n !== O && before[n] === x && !cfg.boarding.has(n))
                if (missing.length) {
                    missing.forEach(n => cfg.boarding.add(n))
                    adjustments.push(`Arrêt ${k + 1} : ${missing.join(', ')} monte${missing.length > 1 ? 'nt' : ''} avec ${x}.`)
                    changed = true
                }
            }
        }
        for (const p of cfg.boarding) {
            const c = before[p]
            if (c === O) continue
            if (c === p) parkedAt[p] = k
            carOf[p] = O
        }
    })
    return { cfgs, adjustments }
}

/** Applique un choix de rôle à un arrêt, puis répare le reste du scénario. role : 'car' | 'passenger' | 'none' */
export function applyRole(names, cfgsIn, k, person, role) {
    const cfgs = cloneCfgs(cfgsIn)
    const cfg = cfgs[k]
    if (!cfg) return { cfgs, adjustments: [] }
    const extra = []
    if (role === 'car') {
        const prev = cfg.driver
        cfg.driver = person
        cfg.boarding.delete(person)
        if (prev && prev !== person) {
            cfg.boarding.add(prev)                                      // l'ancienne voiture est laissée ici
            // la voiture qui repart d'ici change : les arrêts suivants qui utilisaient l'ancienne suivent la nouvelle
            for (let j = k + 1; j < cfgs.length; j++) {
                const next = cfgs[j]
                if (next.driver !== prev) continue
                next.driver = person
                next.boarding.delete(person)
                extra.push(`Arrêt ${j + 1} : la voiture de ${person} remplace celle de ${prev}.`)
            }
        }
    } else if (role === 'passenger') {
        if (cfg.driver === person) cfg.driver = null
        cfg.boarding.add(person)
        // à bord d'une autre voiture : cette voiture doit s'arrêter ici (son propriétaire monte aussi, avec ses occupants)
        const c = simulateScenario(names, cfgsIn).carOfBefore[k]?.[person]
        if (c && c !== person && c !== cfg.driver && !cfg.boarding.has(c)) {
            cfg.boarding.add(c)
            extra.push(`Arrêt ${k + 1} : ${c} monte aussi (${person} est dans sa voiture).`)
        }
    } else {
        if (cfg.driver === person) cfg.driver = null
        cfg.boarding.delete(person)
    }
    const rep = repairScenario(names, cfgs)
    return { cfgs: rep.cfgs, adjustments: [...extra, ...rep.adjustments] }
}

/** Ce qu'on peut proposer à `person` à l'arrêt k : { car, passenger, none } -> { ok, reason?, note? } */
export function roleAvailability(names, cfgsIn, k, person) {
    const sim = simulateScenario(names, cfgsIn)
    const before = sim.carOfBefore[k]
    const cfg = cfgsIn[k]
    if (!before || !cfg) return { car: { ok: false }, passenger: { ok: false }, none: { ok: false } }
    const c = before[person]
    const O = cfg.driver || null
    const out = { car: { ok: true }, passenger: { ok: true }, none: { ok: true } }

    if (c !== person) {
        const where = sim.parkedAt[person]
        out.car = { ok: false, reason: `Sa voiture est restée à l'arrêt ${(where ?? 0) + 1}.` }
    }
    if (c !== person && c === O) {
        out.passenger = { ok: false, reason: `Déjà à bord de la voiture de ${O}.` }
        out.none = { ok: false, reason: `Déjà à bord de la voiture de ${O}.` }
    } else if (c !== person && cfg.boarding.has(c)) {
        out.none = { ok: false, reason: `Dans la voiture de ${c}, qui s'arrête ici.` }
    }
    // aperçu des conséquences (qui suit) pour les choix possibles
    for (const role of ['car', 'passenger', 'none']) {
        const key = role
        if (!out[key].ok) continue
        const roleNow = O === person ? 'car' : (cfg.boarding.has(person) ? 'passenger' : 'none')
        if (roleNow === role) continue
        const res = applyRole(names, cfgsIn, k, person, role)
        const own = `Arrêt ${k + 1} : `
        const notes = res.adjustments.map(a => a.startsWith(own) ? a.slice(own.length) : a)
        if (notes.length) out[key].note = notes.join(' ')
    }
    return out
}

/** rôle d'une personne à l'arrêt k, pour l'affichage */
export function roleAt(sim, k, name) {
    const rec = sim.stops[k]
    if (!rec) return { role: 'none' }
    if (rec.owner === name) return { role: 'car' }
    if (rec.boarding.includes(name)) return { role: 'passenger' }
    if (rec.aboardBefore.includes(name)) return { role: 'aboard' }
    const c = sim.carOfBefore[k]?.[name]
    if (c && c !== name) return { role: 'away', inCarOf: c }
    return { role: 'none' }
}