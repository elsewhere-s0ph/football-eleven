/**
 * Abilità speciali (F5). Ogni giocatore può averne zero, una o due:
 * una comune, una rara e con molta fortuna la leggendaria Fuoriclasse
 * (tappo di 3 per lega). Tutto deterministico dal seed della carriera:
 * stessa lega, stessi campioni — niente reroll.
 *
 * Gli effetti vivono dove si decide le partite: il motore (engine.js)
 * pesa i marcatori, sposta le probabilità dei momenti chiave e la forza
 * squadra; MatchScreen fa stancare meno i Maratoneta. Le abilità si
 * pagano anche sul valore di mercato (abilityValueBonus).
 */
import { Rng, seedFromString } from '../lib/rng'

/** Catalogo: id → definizione. Nomi validati a novembre 2026. */
export const ABILITIES = {
  bomber: { name: "Bomber d'area", rarity: 'comune', roles: ['FW'], desc: "Nell'area piccola è casa sua: la festa passa da lui." },
  falcata: { name: 'Falcata', rarity: 'comune', roles: ['FW', 'MF'], desc: 'Lo scatto che buca la linea: le ripartenze convertono più spesso.' },
  muro: { name: 'Muro di Gomma', rarity: 'comune', roles: ['DF', 'GK'], desc: 'I contropiedi avversari muoiono su di lui.' },
  maratoneta: { name: 'Maratoneta', rarity: 'comune', roles: ['DF', 'MF', 'FW'], desc: 'Cala meno di tutti nel finale: i minuti non lo mordono.' },
  ghiaccio: { name: 'Ghiaccio nelle vene', rarity: 'rara', roles: ['FW', 'MF'], desc: 'Dal dischetto è una formalità.' },
  regista: { name: 'Regista', rarity: 'rara', roles: ['MF'], desc: 'Il gol passa quasi sempre dai suoi piedi.' },
  capitano: { name: 'Capitano', rarity: 'rara', roles: ['DF', 'MF', 'FW', 'GK'], desc: 'Trascina: la squadra non molla mai.' },
  specialista: { name: 'Specialista di punizioni', rarity: 'rara', roles: ['MF', 'FW'], desc: 'La punizione dal limite è il suo ufficio.' },
  falco: { name: 'Falco aereo', rarity: 'rara', roles: ['DF', 'FW'], desc: 'I corner sono la sua specialità: salta più in alto di tutti.' },
  fuoriclasse: { name: 'Fuoriclasse', rarity: 'leggendaria', roles: ['GK', 'DF', 'MF', 'FW'], desc: 'Fa sembrare facile quello che non lo è.' },
}

export const COMMON_IDS = ['bomber', 'falcata', 'muro', 'maratoneta']
export const RARE_IDS = ['ghiaccio', 'regista', 'capitano', 'specialista', 'falco']

/** Tappo di Fuoriclasse per lega: 2-3, mai di più. */
export const LEGENDARY_CAP = 3

export const RARITY_LABEL = { comune: 'Comune', rara: 'Rara', leggendaria: 'Leggendaria' }

/** Il giocatore ha questa abilità? (Robusto anche senza il campo.) */
export function hasAbility(player, id) {
  return !!(player && Array.isArray(player.abilities) && player.abilities.includes(id))
}

/** Bonus sul valore di mercato: le abilità si pagano. */
export function abilityValueBonus(abilities) {
  if (!Array.isArray(abilities)) return 0
  let bonus = 0
  for (const id of abilities) {
    if (id === 'fuoriclasse') bonus += 0.8
    else if (RARE_IDS.includes(id)) bonus += 0.3
    else bonus += 0.15
  }
  return Math.min(bonus, 1)
}

/**
 * Assegna le abilità a tutta la lega. Un solo rng dal seed, giocatori in
 * ordine di id (stabile tra sessioni): stesso seed → stessi campioni.
 * Chiamata sia alla generazione dell'universo sia alla migrazione lazy
 * delle carriere esistenti: stesso input, stesso output.
 * ~9% una comune, ~3% una rara, 0,8% la leggendaria (tappo 3 per lega).
 */
export function assignLeagueAbilities(seed, players) {
  const rng = new Rng(seedFromString(String(seed) + ':abilities'))
  const sorted = players.slice().sort((a, b) => (a.id < b.id ? -1 : 1))
  const map = {}
  let legendary = 0
  for (const p of sorted) {
    const owned = []
    if (rng.chance(0.09)) {
      const pool = COMMON_IDS.filter((id) => ABILITIES[id].roles.includes(p.role))
      if (pool.length) owned.push(rng.pick(pool))
    }
    if (rng.chance(0.03)) {
      const pool = RARE_IDS.filter((id) => ABILITIES[id].roles.includes(p.role))
      if (pool.length) owned.push(rng.pick(pool))
    }
    if (legendary < LEGENDARY_CAP && rng.chance(0.008)) {
      owned.push('fuoriclasse')
      legendary++
    }
    map[p.id] = owned
  }
  return map
}
