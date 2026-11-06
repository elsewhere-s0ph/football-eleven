import Dexie from 'dexie'

/**
 * Database locale (IndexedDB via Dexie). Tutto client-side.
 *
 * F0: schema minimo. La struttura completa arriva in F2 e deve nascere
 * già multi-lega: in futuro più campionati con promosse e retrocesse,
 * più contratti, giovanili, morale e rapporti.
 */
export const db = new Dexie('football-eleven')

db.version(1).stores({
  careers: '++id, seed, createdAt',
})

/** Crea una nuova carriera con il suo seed. */
export async function createCareer({ seed, coachName = '' } = {}) {
  const id = await db.careers.add({
    seed,
    coachName,
    createdAt: new Date().toISOString(),
  })
  return db.careers.get(id)
}

/** Tutte le carriere, dalla più recente. */
export async function listCareers() {
  return db.careers.orderBy('createdAt').reverse().toArray()
}
