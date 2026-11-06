import { Rng, seedFromString } from '../lib/rng'

/**
 * Base del futuro sistema osservatori (F4/F5): il potenziale vero non si
 * vede mai, si vede la stima del proprio staff. Più staff è bravo, più la
 * lettura è precisa. Deterministica per giocatore: la stima non "balla"
 * a ogni schermata.
 */

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v))

/** Errore di lettura per livello staff: 1 → ±10, 5 → ±2. */
export function scoutError(staffLevel) {
  const lvl = clamp(Math.round(staffLevel), 1, 5)
  return [10, 8, 6, 4, 2][lvl - 1]
}

/** Potenziale stimato: sempre plausibile (mai sotto l'ovr attuale). */
export function scoutedPotential(player, staffLevel) {
  const rng = new Rng(seedFromString(player.id))
  const err = scoutError(staffLevel)
  return clamp(player.potential + rng.int(-err, err), player.ovr, 99)
}
