/**
 * Motore partita (F3). I gol seguono una distribuzione di Poisson guidata
 * dalla differenza di forza tra le squadre (miglior XI + morale + fattore casa).
 * Deterministico dal seed della partita. Le "occasioni" e i cartellini
 * riempiono la cronaca: i momenti chiave per i QTE arrivano nello step 2.
 */
import { Rng } from '../lib/rng'

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v))

/** Forza squadra: media OVR della miglior XI (senior) corretta dal morale. */
export function teamStrength(club, squad) {
  const seniors = squad.filter((p) => !p.youth).sort((a, b) => b.ovr - a.ovr).slice(0, 11)
  if (!seniors.length) return 40
  const base = seniors.reduce((s, p) => s + p.ovr, 0) / seniors.length
  const morale = seniors.reduce((s, p) => s + p.morale, 0) / seniors.length
  return base * (0.92 + 0.08 * (morale / 100))
}

/** Poisson (Knuth): gol attesi → gol segnati. */
function poisson(rng, lambda) {
  const L = Math.exp(-lambda)
  let k = 0
  let p = 1
  do {
    k++
    p *= rng.float()
  } while (p > L)
  return k - 1
}

function weightedPick(rng, items, weightFn) {
  const weights = items.map(weightFn)
  const total = weights.reduce((a, b) => a + b, 0) || 1
  let roll = rng.float() * total
  for (let i = 0; i < items.length; i++) {
    roll -= weights[i]
    if (roll <= 0) return items[i]
  }
  return items[items.length - 1]
}

const ROLE_GOAL_WEIGHT = { GK: 0.03, DF: 1, MF: 4, FW: 10 }

function pickScorer(rng, squad) {
  return weightedPick(rng, squad, (p) => ROLE_GOAL_WEIGHT[p.role] * (p.ovr / 70))
}

/**
 * Simula una partita completa.
 * Ritorna { homeGoals, awayGoals, events[] }, con eventi in ordine di minuto:
 * goal (con marcatore e assist), occasioni mancate, ammonizioni ed espulsioni.
 */
export function simulateMatch(homeClub, awayClub, playersByClubId, rng) {
  const homeSquad = (playersByClubId[homeClub.id] || []).filter((p) => !p.youth)
  const awaySquad = (playersByClubId[awayClub.id] || []).filter((p) => !p.youth)

  const sh = teamStrength(homeClub, homeSquad) + 2.5 // vantaggio campo
  const sa = teamStrength(awayClub, awaySquad)
  const xgH = clamp(1.3 + (sh - sa) * 0.05, 0.15, 4.5)
  const xgA = clamp(1.05 + (sa - sh) * 0.05, 0.12, 4.5)
  const goalsH = Math.min(poisson(rng, xgH), 7)
  const goalsA = Math.min(poisson(rng, xgA), 7)

  const events = []

  const addGoal = (side, club, squad) => {
    const scorer = pickScorer(rng, squad)
    const assist = rng.chance(0.45) ? pickScorer(rng, squad) : null
    const assistTxt = assist && assist.id !== scorer.id ? ' su assist di ' + assist.name : ''
    events.push({
      minute: rng.int(2, 92),
      side,
      type: 'goal',
      playerId: scorer.id,
      text: 'GOL! ' + scorer.name + assistTxt + ' (' + club.name + ')',
    })
  }
  for (let i = 0; i < goalsH; i++) addGoal('home', homeClub, homeSquad)
  for (let i = 0; i < goalsA; i++) addGoal('away', awayClub, awaySquad)

  const missCount = rng.int(2, 5)
  for (let i = 0; i < missCount; i++) {
    const side = rng.chance(0.5) ? 'home' : 'away'
    const club = side === 'home' ? homeClub : awayClub
    const squad = side === 'home' ? homeSquad : awaySquad
    const attacker = pickScorer(rng, squad)
    const variant = rng.int(0, 2)
    const text =
      variant === 0
        ? attacker.name + ' colpisce il palo!'
        : variant === 1
          ? 'Gran parata del portiere su ' + attacker.name
          : attacker.name + ' calcia alto da posizione invitante'
    events.push({ minute: rng.int(2, 92), side, type: 'chance', playerId: attacker.id, text })
  }

  const cardCount = rng.int(1, 5)
  for (let i = 0; i < cardCount; i++) {
    const side = rng.chance(0.5) ? 'home' : 'away'
    const squad = side === 'home' ? homeSquad : awaySquad
    const player = rng.pick(squad)
    events.push({ minute: rng.int(10, 92), side, type: 'card', playerId: player.id, text: player.name + ' ammonito' })
  }
  if (rng.chance(0.06)) {
    const side = rng.chance(0.5) ? 'home' : 'away'
    const squad = side === 'home' ? homeSquad : awaySquad
    const player = rng.pick(squad)
    events.push({ minute: rng.int(25, 90), side, type: 'red', playerId: player.id, text: 'ESPULSO: ' + player.name + '!' })
  }

  events.sort((a, b) => a.minute - b.minute)
  return { homeGoals: goalsH, awayGoals: goalsA, events }
}

/** Seed deterministico per una partita specifica. */
export function matchSeed(careerSeed, fixtureKey) {
  return new Rng((careerSeed ^ hashString(fixtureKey)) >>> 0)
}

function hashString(str) {
  let h = 2166136261
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}
