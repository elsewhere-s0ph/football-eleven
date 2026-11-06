/**
 * Evoluzione stagionale dei giocatori (F3 bonus).
 * Come nel calcio vero: chi gioca migliora di più. I minuti pesano quanto
 * l'età e il potenziale nascosto decide il soffitto. I giovani della
 * Primavera non vedono il campo: crescono in base al settore giovanile.
 * Deterministico da (seed carriera, stagione, giocatore).
 */
import { Rng } from '../lib/rng'

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v))

/** Fattore età per la crescita: i giovani assorbono tutto, dopo i 27 poco. */
function ageFactor(age) {
  if (age <= 20) return 1
  if (age <= 23) return 0.75
  if (age <= 26) return 0.4
  if (age <= 29) return 0.15
  return 0
}

/**
 * Fattore minuti: 2700 minuti (30 partite intere) = crescita piena.
 * Chi gioca poco cresce comunque, ma lentissimo; chi non scende mai
 * in campo rosicchia appena qualcosa.
 */
function minutesFactor(minutes, apps) {
  if (!apps) return 0.06
  return clamp(minutes / 2700, 0.12, 1)
}

/**
 * Crescita di fine stagione per un giocatore. Ritorna il delta OVR
 * (negativo = declino).
 *
 * Senior: margine sul potenziale × età × minuti × 0,25 (più il carattere
 * del rng). Esempi con margine 15: 19enne titolare ≈ +4, 22enne con mezza
 * stagione ≈ +1, riserva da 400 minuti ≈ +0.
 *
 * Over 30: il declino è dietro l'angolo (30-31: 30%, 32: 50%, 33-34: 70%,
 * 35+: 90%, con rischio -2). Se il corpo regge e gioca, rosicchia appena.
 *
 * Primavera: cresce guidata dal settore giovanile del club
 * (livello 1 = +7% del margine a stagione, livello 5 = +19%).
 */
export function seasonGrowth(rng, player, youthLevel) {
  const headroom = Math.max(0, (player.potential || player.ovr) - player.ovr)

  if (player.youth) {
    const coach = 0.04 + (youthLevel || 1) * 0.03
    return Math.round(headroom * coach * (0.7 + rng.float() * 0.9))
  }

  if (player.age >= 30) {
    const declineChance = player.age >= 35 ? 0.9 : player.age >= 33 ? 0.7 : player.age >= 32 ? 0.5 : 0.3
    if (rng.chance(declineChance)) {
      const heavy = player.age >= 35 && rng.chance(0.5)
      return heavy ? -2 : -1
    }
    return Math.round(headroom * 0.05 * minutesFactor(player.minutes || 0, player.apps || 0) * rng.float())
  }

  const af = ageFactor(player.age)
  const mf = minutesFactor(player.minutes || 0, player.apps || 0)
  return Math.round(headroom * af * mf * 0.25 * (0.6 + rng.float() * 0.8))
}
