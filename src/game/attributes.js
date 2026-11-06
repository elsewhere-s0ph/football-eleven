/**
 * Attributi in scala 1-20 (F3.5): la fonte di verità del giocatore.
 * L'OVR non vive più per conto suo: è derivato (media pesata per ruolo) e
 * viene ricalcolato ogni volta che gli attributi cambiano. Crescita e
 * declino muovono gli attributi — e la velocità, col tempo, crolla per prima.
 */

/** Etichette in italiano per la scheda giocatore. */
export const ATTR_LABELS = {
  pace: 'Velocità',
  shooting: 'Tiro',
  passing: 'Passaggio',
  dribbling: 'Dribbling',
  defending: 'Contrasto',
  physical: 'Fisico',
  reflexes: 'Riflessi',
  diving: 'Tuffi',
  handling: 'Presa',
  positioning: 'Posizione',
  kicking: 'Rinvii',
  speed: 'Velocità',
}

/** Pesi dell'OVR per ruolo (sommano 1). Per i GK lo scatto puro non pesa. */
export const OVR_WEIGHTS = {
  GK: { reflexes: 0.3, diving: 0.25, handling: 0.2, positioning: 0.15, kicking: 0.1 },
  DF: { defending: 0.3, physical: 0.2, pace: 0.15, passing: 0.15, dribbling: 0.1, shooting: 0.1 },
  MF: { passing: 0.3, dribbling: 0.2, defending: 0.15, pace: 0.15, shooting: 0.1, physical: 0.1 },
  FW: { shooting: 0.3, dribbling: 0.25, pace: 0.2, passing: 0.1, physical: 0.1, defending: 0.05 },
}

/** Profili per ruolo (media e deviazione, scala 1-20). */
export const FIELD_PROFILE = {
  DF: { pace: [13.2, 1.6], shooting: [9, 1.6], passing: [12.4, 1.4], dribbling: [11, 1.4], defending: [14.8, 1.4], physical: [14.4, 1.4] },
  MF: { pace: [13.6, 1.6], shooting: [12.4, 1.6], passing: [15, 1.4], dribbling: [14.4, 1.4], defending: [11.6, 1.6], physical: [13.2, 1.4] },
  FW: { pace: [15.2, 1.6], shooting: [14.8, 1.4], passing: [12.8, 1.4], dribbling: [15.2, 1.4], defending: [7.6, 1.2], physical: [12.8, 1.4] },
}
export const GK_PROFILE = {
  reflexes: [14.8, 1.2],
  diving: [14.6, 1.2],
  handling: [14, 1.2],
  positioning: [14.2, 1.2],
  kicking: [13.2, 1.4],
  speed: [12, 1.4],
}

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v))
const profileFor = (role) => (role === 'GK' ? GK_PROFILE : FIELD_PROFILE[role] || FIELD_PROFILE.MF)

/** OVR derivato: media pesata per ruolo, proiettata sulla scala 30-95. */
export function deriveOvr(attrs, role) {
  const w = OVR_WEIGHTS[role] || OVR_WEIGHTS.MF
  let sum = 0
  for (const k of Object.keys(w)) sum += (attrs[k] || 10) * w[k]
  return Math.round(clamp(sum * 5, 30, 95))
}

/** Sceglie una chiave con probabilità proporzionale al peso. */
function weightedPick(keys, weightOf, rng) {
  const total = keys.reduce((s, k) => s + weightOf(k), 0)
  let r = rng.float() * total
  for (const k of keys) {
    r -= weightOf(k)
    if (r <= 0) return k
  }
  return keys[keys.length - 1]
}

/** Avvicina gli attributi all'OVR richiesto, un punto per volta, senza sforare. */
function fitToOvr(attrs, role, targetOvr) {
  const w = OVR_WEIGHTS[role] || OVR_WEIGHTS.MF
  let guard = 60
  while (guard-- > 0) {
    const ovr = deriveOvr(attrs, role)
    if (ovr === targetOvr) return
    const dir = ovr < targetOvr ? 1 : -1
    let best = null
    let bestDist = Infinity
    for (const k of Object.keys(w)) {
      const v = (attrs[k] || 10) + dir
      if (v < 1 || v > 20) continue
      const candidate = deriveOvr({ ...attrs, [k]: v }, role)
      if (dir > 0 ? candidate > targetOvr : candidate < targetOvr) continue
      const dist = Math.abs(candidate - targetOvr)
      if (dist < bestDist) {
        bestDist = dist
        best = k
      }
    }
    if (!best) return
    attrs[best] = (attrs[best] || 10) + dir
  }
}

/** Migrazione deterministica dalla vecchia scala 20-99, centrando l'OVR attuale. */
export function migrateAttrs(oldAttrs, role, targetOvr) {
  const attrs = {}
  for (const [k, v] of Object.entries(oldAttrs)) attrs[k] = clamp(Math.round(v / 5), 1, 20)
  fitToOvr(attrs, role, targetOvr)
  return attrs
}

/** Attributi per le carriere nate prima degli attributi: forma da profilo,
 * tarata sull'OVR, con un punto di forza. Deterministica dal rng passato. */
export function rollAttrsForOvr(rng, targetOvr, role) {
  const profile = profileFor(role)
  const keys = Object.keys(profile)
  const base = {}
  for (const k of keys) base[k] = profile[k][0]
  const f = Math.max(0.4, targetOvr / Math.max(30, deriveOvr(base, role)))
  const attrs = {}
  for (const k of keys) attrs[k] = clamp(Math.round(base[k] * f + rng.int(-1, 1)), 1, 20)
  const forte = keys[rng.int(0, keys.length - 1)]
  attrs[forte] = clamp(attrs[forte] + rng.int(1, 2), 1, 20)
  fitToOvr(attrs, role, targetOvr)
  return attrs
}

/** Crescita: +1 per volta sugli attributi rilevanti per il ruolo, fino al
 * target (mai oltre il potenziale). Tra i punti equivalenti sceglie il rng. */
export function growAttrs(attrs, role, targetOvr, rng) {
  const w = OVR_WEIGHTS[role] || OVR_WEIGHTS.MF
  const next = { ...attrs }
  let guard = 60
  while (guard-- > 0) {
    if (deriveOvr(next, role) >= targetOvr) break
    const ties = []
    let bestDist = Infinity
    for (const k of Object.keys(w)) {
      if ((next[k] || 10) >= 20) continue
      const candidate = deriveOvr({ ...next, [k]: (next[k] || 10) + 1 }, role)
      if (candidate > targetOvr) continue
      const dist = targetOvr - candidate
      if (dist > bestDist) continue
      if (dist < bestDist) {
        bestDist = dist
        ties.length = 0
      }
      ties.push(k)
    }
    if (!ties.length) break
    const k = rng.pick(ties)
    next[k] = (next[k] || 10) + 1
  }
  return next
}

/** Declino: prima crollano Velocità e Fisico, poi il resto. Padre tempo. */
export function declineAttrs(attrs, role, targetOvr, rng) {
  const bias = (k) => (k === 'pace' || k === 'speed' ? 4 : k === 'physical' || k === 'kicking' ? 2 : 1)
  const next = { ...attrs }
  const keys = Object.keys(next)
  let guard = 60
  while (guard-- > 0) {
    if (deriveOvr(next, role) <= targetOvr) break
    const ties = []
    let bestDist = Infinity
    for (const k of keys) {
      if ((next[k] || 10) <= 1) continue
      const candidate = deriveOvr({ ...next, [k]: (next[k] || 10) - 1 }, role)
      if (candidate < targetOvr) continue
      const dist = candidate - targetOvr
      if (dist > bestDist) continue
      if (dist < bestDist) {
        bestDist = dist
        ties.length = 0
      }
      ties.push(k)
    }
    if (!ties.length) break
    const k = weightedPick(ties, bias, rng)
    next[k] = (next[k] || 10) - 1
  }
  return next
}
