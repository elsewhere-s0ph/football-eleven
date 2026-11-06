import { Rng, seedFromString } from '../lib/rng'

/**
 * Osservatori (F5): il potenziale vero non si vede mai, si vede la stima
 * della tua rete. Più l'osservatorio è alto, più la lettura è precisa; il
 * focus su un ruolo toglie altri due punti di errore. Deterministica per
 * (giocatore, livello, focus): la stima non "balla" a ogni schermata, ma
 * ogni potenziamento rilegge tutta la Primavera.
 */

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v))

/** Livello valido dalla config osservatori (o numero legacy). */
function scoutLevel(scouts) {
  if (typeof scouts === 'number') return clamp(Math.round(scouts), 1, 5)
  return clamp(Math.round(scouts && scouts.level ? scouts.level : 1), 1, 5)
}

/** Errore di lettura: livello 1 → ±10, livello 5 → ±2; il focus toglie 2. */
export function scoutError(scouts) {
  const err = [10, 8, 6, 4, 2][scoutLevel(scouts) - 1]
  const focus = scouts && typeof scouts === 'object' ? scouts.focus : null
  return focus ? Math.max(1, err - 2) : err
}

/** Potenziale stimato: sempre plausibile (mai sotto l'ovr attuale). */
export function scoutedPotential(player, scouts) {
  const level = scoutLevel(scouts)
  const focus = (scouts && typeof scouts === 'object' && scouts.focus) || 'no'
  const rng = new Rng(seedFromString(String(player.id) + ':s' + level + ':' + focus))
  const err = scoutError(scouts)
  return clamp(player.potential + rng.int(-err, err), player.ovr, 99)
}
