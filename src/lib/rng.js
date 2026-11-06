/**
 * PRNG deterministico (mulberry32).
 *
 * Ogni carriera ha un seed: stesso seed → stesso universo, stesso mercato,
 * stessi rimbalzi. Serve per carriere condivisibili (es. seed "ELEVEN-CASA")
 * e per bug riproducibili in fase di sviluppo.
 */

export function mulberry32(seed) {
  let a = seed >>> 0
  return function () {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export class Rng {
  constructor(seed) {
    this.seed = seed >>> 0
    this._rand = mulberry32(this.seed)
  }

  /** Float in [0, 1). */
  float() {
    return this._rand()
  }

  /** Intero in [min, max], estremi inclusi. */
  int(min, max) {
    return min + Math.floor(this.float() * (max - min + 1))
  }

  /** true con probabilità p (0..1). */
  chance(p) {
    return this.float() < p
  }

  /** Elemento casuale da un array. */
  pick(arr) {
    return arr[this.int(0, arr.length - 1)]
  }

  /** Gaussiana (Box-Muller): per OVR, attributi, età dei giovani ecc. */
  gauss(mean = 0, sd = 1) {
    const u = Math.max(this.float(), 1e-9)
    const v = this.float()
    return mean + sd * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v)
  }

  /** Fisher-Yates su una copia (non muta l'originale). */
  shuffle(arr) {
    const a = arr.slice()
    for (let i = a.length - 1; i > 0; i--) {
      const j = this.int(0, i)
      const tmp = a[i]
      a[i] = a[j]
      a[j] = tmp
    }
    return a
  }
}

/** Seed casuale a 32 bit per una nuova carriera. */
export function newSeed() {
  const buf = new Uint32Array(1)
  crypto.getRandomValues(buf)
  return buf[0]
}

/** Seed derivato da una stringa, per condividere le carriere. */
export function seedFromString(str) {
  let h = 2166136261
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}
