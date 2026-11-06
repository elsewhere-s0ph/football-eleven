/**
 * Motore partita (F3). I gol seguono una distribuzione di Poisson guidata
 * dalla differenza di forza tra le squadre (miglior XI + morale + fattore casa).
 * Deterministico dal seed della partita.
 *
 * Momenti chiave (QTE): nelle partite dell'utente si generano 1-2 momenti
 * decisivi (rigore, contropiede subito, corner finale) con 3 opzioni ciascuno.
 * L'esito di OGNI opzione è precomputato deterministicamente da
 * (seed partita, momento, scelta): lo stesso QTE dà sempre lo stesso esito,
 * quindi non si può "ritirare il dado" ricaricando.
 */
import { Rng } from '../lib/rng'

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v))

function hashString(str) {
  let h = 2166136261
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

/** Seed numerico deterministico di una partita. */
export function matchSeedNumber(careerSeed, fixtureKey) {
  return (((careerSeed >>> 0) ^ hashString(fixtureKey)) >>> 0)
}

/** RNG deterministico per una partita (partite simulate in background). */
export function matchSeed(careerSeed, fixtureKey) {
  return new Rng(matchSeedNumber(careerSeed, fixtureKey))
}

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

function pickByRole(rng, squad, role) {
  const pool = squad.filter((p) => p.role === role)
  return pool.length ? rng.pick(pool) : rng.pick(squad)
}

/** RNG dell'esito di una singola scelta di QTE. */
function outcomeRng(seedNumber, momentId, choiceId) {
  return new Rng((seedNumber ^ hashString(momentId + ':' + choiceId)) >>> 0)
}

/**
 * Costruisce una partita. Con keyMoments attivo genera anche i momenti QTE
 * per la squadra dell'utente (1-2 per partita). La cronaca base è identica
 * a prescindere: i momenti chiave aggiungono gol ed eventi sopra di essa.
 */
export function buildMatch(homeClub, awayClub, playersByClubId, rng, { keyMoments = false, seedNumber = 0, userClubId = null } = {}) {
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

  const moments = []
  if (keyMoments && userClubId) {
    const userIsHome = homeClub.id === userClubId
    const userClub = userIsHome ? homeClub : awayClub
    const oppClub = userIsHome ? awayClub : homeClub
    const userSquad = userIsHome ? homeSquad : awaySquad
    const oppSquad = userIsHome ? awaySquad : homeSquad
    const count = rng.int(1, 2)
    const kinds = rng.shuffle(['penalty', 'counter', 'corner']).slice(0, count)
    kinds.forEach((kind, i) => {
      const minute =
        kind === 'corner' ? rng.int(78, 92) : kind === 'penalty' ? rng.int(12, 85) : rng.int(18, 88)
      moments.push(makeMoment(rng, kind, minute, i, seedNumber, userClub, oppClub, userSquad, oppSquad))
    })
  }

  events.sort((a, b) => a.minute - b.minute)
  return { baseEvents: events, keyMoments: moments }
}

/** Simulazione completa senza interazione (partite AI e "salta al risultato"). */
export function simulateMatch(homeClub, awayClub, playersByClubId, rng) {
  const { baseEvents } = buildMatch(homeClub, awayClub, playersByClubId, rng)
  return {
    homeGoals: baseEvents.filter((e) => e.type === 'goal' && e.side === 'home').length,
    awayGoals: baseEvents.filter((e) => e.type === 'goal' && e.side === 'away').length,
    events: baseEvents,
  }
}

/* ---------------- Momenti chiave (QTE) ---------------- */

function makeMoment(rng, kind, minute, idx, seedNumber, userClub, oppClub, userSquad, oppSquad) {
  const id = 'm' + idx
  const rollOutcome = (choiceId, fn) => {
    const orng = outcomeRng(seedNumber, id, choiceId)
    return fn(orng)
  }

  if (kind === 'penalty') {
    const shooter = pickScorer(rng, userSquad)
    const defs = [
      { id: 'incrocio', label: "Secco all'incrocio", hint: 'Freddo e cattivo', prudent: false, goalP: 0.72, postP: 0.1 },
      { id: 'cucchiaio', label: 'Cucchiaio', hint: 'Fegato… o umiliazione', prudent: false, goalP: 0.76, postP: 0.02 },
      { id: 'tiratore', label: 'Lascia decidere a lui', hint: 'La scelta prudente', prudent: true, goalP: 0.68, postP: 0.06 },
    ]
    const options = defs.map((d) =>
      rollOutcome(d.id, (orng) => {
        const roll = orng.float()
        if (roll < d.goalP) {
          return { ...d, outcome: { goal: 1, goalAgainst: 0, card: false, playerId: shooter.id, text: 'GOL! ' + shooter.name + ' trasforma il rigore (' + d.label + ')' } }
        }
        if (roll < d.goalP + d.postP) {
          return { ...d, outcome: { goal: 0, goalAgainst: 0, card: false, text: 'Rigore: PALO! ' + shooter.name + ' prova il colpo ' + d.label + ' ma la sfera sfiora lo specchio' } }
        }
        return { ...d, outcome: { goal: 0, goalAgainst: 0, card: false, text: 'Parato! Il portiere vola sul rigore di ' + shooter.name + ' (' + d.label + ')' } }
      }),
    )
    return {
      id,
      kind,
      side: 'for',
      minute,
      prompt: 'RIGORE per il ' + userClub.name + '! Sul dischetto va ' + shooter.name + '. Come lo vuoi?',
      options,
    }
  }

  if (kind === 'counter') {
    const defender = pickByRole(rng, userSquad, 'DF')
    const mid = pickByRole(rng, userSquad, 'MF')
    const oppScorer = pickScorer(rng, oppSquad)
    const defs = [
      { id: 'fallo', label: 'Fallo tattico', hint: 'Fermalo, accetta il rischio cartellino', prudent: true },
      { id: 'tutti', label: 'Tutti dietro', hint: 'Difendere in inferiorità numerica', prudent: false },
      { id: 'pressing', label: 'Pressing per recuperare', hint: 'Rischio tutto', prudent: false },
    ]
    const options = defs.map((d) =>
      rollOutcome(d.id, (orng) => {
        const roll = orng.float()
        if (d.id === 'fallo') {
          const card = roll < 0.45
          return {
            ...d,
            outcome: {
              goal: 0,
              goalAgainst: 0,
              card,
              text: card
                ? 'Fallo tattico di ' + defender.name + ': ammonito! Ma il contropiede muore lì'
                : 'Fallo tattico di ' + defender.name + ': contropiede annientato, solo un colpo di fischietto',
            },
          }
        }
        if (d.id === 'tutti') {
          const concede = roll < 0.36
          return {
            ...d,
            outcome: concede
              ? { goal: 0, goalAgainst: 1, card: false, playerId: oppScorer.id, text: 'Il 3 contro 2 diventa 3 contro 1: ' + oppScorer.name + ' non sbaglia. Dolissimo' }
              : { goal: 0, goalAgainst: 0, card: false, text: 'Difesa compatta: il contropiede muore tra le linee' },
          }
        }
        if (roll < 0.32) {
          return { ...d, outcome: { goal: 0, goalAgainst: 0, card: false, text: mid.name + ' intercetta con piglio da mastino: che cuore, ripartenza!' } }
        }
        if (roll < 0.87) {
          return { ...d, outcome: { goal: 0, goalAgainst: 1, card: false, playerId: oppScorer.id, text: 'Il pressing fallisce: passaggio filtrante e ' + oppScorer.name + ' insacchina. Beffa' } }
        }
        return { ...d, outcome: { goal: 0, goalAgainst: 0, card: false, text: 'Contrasto roccioso di ' + mid.name + ': rimessa laterale, si respira' } }
      }),
    )
    return {
      id,
      kind,
      side: 'against',
      minute,
      prompt: 'Palla persa a centrocampo: CONTROPIDEDE avversario, 3 contro 2. Che fai?',
      options,
    }
  }

  // corner
  const header = pickByRole(rng, userSquad, 'DF')
  const oppScorer = pickScorer(rng, oppSquad)
  const defs = [
    { id: 'tutti', label: 'Tutti in area, anche il portiere', hint: 'Il tutto per tutto', prudent: false, goalP: 0.32, counterP: 0.12 },
    { id: 'mastini', label: 'Solo i mastini', hint: 'Equilibrio', prudent: true, goalP: 0.24, counterP: 0.06 },
    { id: 'corto', label: 'Riparto corto', hint: 'Minimizza il rischio', prudent: false, goalP: 0.15, counterP: 0.02 },
  ]
  const options = defs.map((d) =>
    rollOutcome(d.id, (orng) => {
      const roll = orng.float()
      if (roll < d.goalP) {
        return { ...d, outcome: { goal: 1, goalAgainst: 0, card: false, playerId: header.id, text: 'GOL! Cross teso e incornata perfetta di ' + header.name + ": l'area esplode!" } }
      }
      if (roll < d.goalP + d.counterP) {
        return { ...d, outcome: { goal: 0, goalAgainst: 1, card: false, playerId: oppScorer.id, text: 'Corner respinto lungo e contropiede a rete: ' + oppScorer.name + ' insacchina nel silenzio più totale' } }
      }
      return { ...d, outcome: { goal: 0, goalAgainst: 0, card: false, text: 'Corner battuto e respinto: nessun danno, si riparte' } }
    }),
  )
  return {
    id,
    kind: 'corner',
    side: 'for',
    minute,
    prompt: 'Ultima occasione: corner per il ' + userClub.name + ' al ' + minute + "'°. Come lo approcci?",
    options,
  }
}
