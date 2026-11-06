/**
 * Generatore dell'universo fittizio (F1).
 * Tutto deterministico dal seed: stesso seed → stesse squadre, stessi
 * calciatori, stessi potenziali. Le carriere sono condivisibili come stringa.
 */
import { Rng, seedFromString } from '../lib/rng'
import {
  IT_FIRST, IT_LAST, FOREIGN_POOLS, TOPONYMS, CLUB_PATTERNS,
  COLOR_PAIRS, TRADE_NICKS, STADIUM_NAMES, FIXED_CLUBS,
} from './names'
import { FIELD_PROFILE, GK_PROFILE, deriveOvr } from './attributes'
import { assignLeagueAbilities, abilityValueBonus } from './abilities'

export const SEASON = 2026

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v))
const roundTo = (v, step) => Math.round(v / step) * step

/** Valore di mercato: esponenziale sull'OVR, scontato con l'età, premiato dal potenziale. */
export function playerValue(ovr, age, potential) {
  const ageFactor = age <= 21 ? 1.3 : age <= 25 ? 1.15 : age <= 29 ? 1 : age <= 32 ? 0.7 : 0.45
  const rawValue = Math.pow(1.17, ovr - 50) * 120000 * ageFactor * (1 + Math.max(0, potential - ovr) * 0.03)
  return Math.max(30000, roundTo(rawValue, 10000))
}

/* ---------------- Nomi ---------------- */

function playerName(rng) {
  if (rng.chance(0.35)) {
    const pool = rng.pick(FOREIGN_POOLS)
    return rng.pick(pool.firsts) + ' ' + rng.pick(pool.lasts)
  }
  return rng.pick(IT_FIRST) + ' ' + rng.pick(IT_LAST)
}

/* ---------------- Club ---------------- */

function colorPairByName(name) {
  return COLOR_PAIRS.find((c) => c.name === name)
}

function buildGeneratedClubs(rng) {
  const tops = rng.shuffle(TOPONYMS)
  const patterns = rng.shuffle(CLUB_PATTERNS)
  const colors = rng.shuffle(COLOR_PAIRS)
  const nicks = rng.shuffle(TRADE_NICKS)

  return tops.map((top, i) => {
    const founded = rng.int(1899, 1946)
    const withYear = i % 4 === 0
    const name = patterns[i % patterns.length]
      .replace('{T}', top)
      .replace('{Y}', withYear ? ' ' + founded : '')
    const stadiumName = rng.chance(0.5)
      ? 'Stadio ' + rng.pick(STADIUM_NAMES)
      : 'Stadio Comunale di ' + top
    return {
      name,
      city: top,
      founded,
      nickname: nicks[i % nicks.length],
      colors: colors[i % colors.length],
      stadiumName,
    }
  })
}

function buildClubs(rng) {
  const fixedColors = FIXED_CLUBS.map((c) => colorPairByName(c.colorPair))
  const fixed = FIXED_CLUBS.map((c, i) => ({
    name: c.name,
    city: c.city,
    founded: c.founded,
    nickname: c.nickname,
    colors: fixedColors[i],
    stadiumName: c.stadiumName || ('Stadio ' + rng.pick(STADIUM_NAMES)),
  }))
  const raw = [...fixed, ...buildGeneratedClubs(rng)]

  return raw.map((c, i) => {
    // Tier per indice: 0-5 big, 6-11 medie, 12-19 piccole.
    const tier = i < 6 ? 'big' : i < 12 ? 'mid' : 'small'
    const reputation = tier === 'big' ? rng.int(88, 95) : tier === 'mid' ? rng.int(74, 83) : rng.int(62, 73)
    const capacity = tier === 'big' ? rng.int(40000, 68000) : tier === 'mid' ? rng.int(22000, 38000) : rng.int(11000, 24000)
    const budget = tier === 'big' ? rng.int(40, 90) * 1e6 : tier === 'mid' ? rng.int(15, 40) * 1e6 : rng.int(4, 15) * 1e6
    return {
      id: 'c' + String(i + 1).padStart(2, '0'),
      ...c,
      reputation,
      stadium: { name: c.stadiumName, capacity: roundTo(capacity, 500) },
      budget,
      facilities: {
        stadiumLevel: tier === 'big' ? rng.int(3, 5) : rng.int(2, 4),
        youthLevel: tier === 'big' ? rng.int(3, 5) : rng.int(1, 4),
        staffLevel: tier === 'big' ? rng.int(3, 5) : rng.int(1, 4),
      },
      tier,
    }
  })
}

/* ---------------- Calciatori ---------------- */

/**
 * Potenziale dei giovani: non tutti diventano campioni.
 * 15% gemme (+16-26), 30% buoni (+9-15), 35% medi (+3-8),
 * 20% che non sboccia (+0-2). In media una gemma ogni 6-7 giovani.
 */
function youthGrowth(rng) {
  const roll = rng.float()
  if (roll < 0.15) return rng.int(16, 26)
  if (roll < 0.45) return rng.int(9, 15)
  if (roll < 0.80) return rng.int(3, 8)
  return rng.int(0, 2)
}

/** Potenziale residuo dei senior: più giovani sono, più margine hanno. */
function seniorGrowth(rng, age) {
  if (age <= 19) return rng.int(6, 24)
  if (age <= 23) return rng.int(4, 16)
  if (age <= 27) return rng.int(1, 8)
  return rng.int(0, 3)
}

function buildPlayer(club, rng, role, index) {
  const youth = index.youth
  const tierBonus = youth
    ? (rng.int(52, 64) - 68) / 5
    : (44 + club.reputation * 0.4 + rng.int(-5, 5) - 68) / 5

  let attributes = {}
  if (role === 'GK') {
    for (const [k, [m, s]] of Object.entries(GK_PROFILE)) {
      attributes[k] = Math.round(clamp(rng.gauss(m + tierBonus, s), 1, 20))
    }
  } else {
    for (const [k, [m, s]] of Object.entries(FIELD_PROFILE[role])) {
      attributes[k] = Math.round(clamp(rng.gauss(m + tierBonus, s), 1, 20))
    }
  }

  // L'OVR è derivato: media pesata per ruolo sugli attributi, mai un numero a sé.
  const ovr = deriveOvr(attributes, role)

  const age = youth ? rng.int(16, 18) : Math.round(clamp(rng.gauss(25.5, 4.5), 17, 38))

  const growth = youth ? youthGrowth(rng) : seniorGrowth(rng, age)
  const potential = clamp(ovr + growth, ovr, 95)

  const value = playerValue(ovr, age, potential)
  const wage = Math.max(20000, roundTo(value / 80, 1000))

  return {
    id: 'p_' + club.id + '_' + index.n,
    clubId: club.id,
    name: playerName(rng),
    role,
    age,
    foot: rng.chance(0.75) ? 'Destro' : 'Sinistro',
    attributes,
    ovr,
    potential,
    value,
    wage,
    contractUntil: SEASON + (age >= 33 ? rng.int(1, 2) : rng.int(1, 5)),
    youth,
  }
}

function buildSquad(club, rng, start) {
  const composition = [
    ['GK', 2], ['DF', 7], ['MF', 8], ['FW', 5],
    ['GK', 1, true], ['DF', 2, true], ['MF', 2, true], ['FW', 1, true],
  ]
  const players = []
  let n = 0
  for (const [role, count, youth] of composition) {
    for (let i = 0; i < count; i++) {
      players.push(buildPlayer(club, rng, role, { n: start + n, youth: !!youth }))
      n++
    }
  }
  return players
}

/* ---------------- Punto d'ingresso ---------------- */

export function generateUniverse(seedInput) {
  const seed = typeof seedInput === 'string' ? seedFromString(seedInput) : seedInput >>> 0
  const rng = new Rng(seed)

  const clubs = buildClubs(rng)
  const players = []
  clubs.forEach((club, ci) => {
    const squad = buildSquad(club, rng, ci * 40)
    players.push(...squad)
    const seniors = squad.filter((p) => !p.youth)
    club.avgOvr = Math.round(seniors.reduce((s, p) => s + p.ovr, 0) / seniors.length)
  })

  // Abilità speciali (F5): assegnate a tutta la lega dal seed, Fuoriclasse
  // col tappo. E le abilità si pagano: valore e stipendio si aggiustano.
  const abilityMap = assignLeagueAbilities(seed, players)
  for (const p of players) {
    p.abilities = abilityMap[p.id] || []
    p.value = Math.max(30000, roundTo(p.value * (1 + abilityValueBonus(p.abilities)), 10000))
    p.wage = Math.max(20000, roundTo(p.value / 80, 1000))
  }

  return {
    seed,
    season: SEASON,
    competition: 'Divisione d\'Onore',
    clubs,
    players,
  }
}
