import Dexie from 'dexie'
import { generateUniverse } from './game/universe'
import { generateSchedule } from './game/schedule'
import { Rng } from './lib/rng'

const PERSONALITIES = ['Leader', 'Professionista', 'Temperamentale', 'Sognatore', 'Grintoso', 'Pacato']

/**
 * Database locale (IndexedDB via Dexie). Tutto client-side.
 * Una riga per club/calciatore/partita, indicizzata per careerId:
 * il mercato (F4) potrà interrogare l'intera lega senza caricare tutto.
 */
export const db = new Dexie('pitchtory')

db.version(1).stores({
  careers: '++id, createdAt',
  clubs: 'key, careerId',
  players: 'key, careerId, clubId',
  fixtures: 'key, careerId',
})

/** Crea una carriera: universo + calendario + morale, tutto deterministico dal seed. */
export async function createCareer({ seed, seedText, coachName, clubId, matchDuration = 'normal' }) {
  const universe = generateUniverse(seed)
  const schedule = generateSchedule(universe.clubs.map((c) => c.id), new Rng((seed ^ 0x5ced) >>> 0))
  const moraleRng = new Rng((seed ^ 0x4b1d) >>> 0)

  const careerId = await db.careers.add({
    seed,
    seedText: seedText || null,
    coachName: coachName || 'Mister',
    clubId,
    season: universe.season,
    settings: { matchDuration },
    createdAt: new Date().toISOString(),
  })

  await db.transaction('rw', db.clubs, db.players, db.fixtures, async () => {
    await db.clubs.bulkAdd(universe.clubs.map((c) => ({ key: careerId + ':' + c.id, careerId, ...c })))
    await db.players.bulkAdd(universe.players.map((p) => ({
      key: careerId + ':' + p.id,
      careerId,
      morale: moraleRng.int(62, 82),
      personality: moraleRng.pick(PERSONALITIES),
      ...p,
    })))
    await db.fixtures.bulkAdd(schedule.flatMap((md) =>
      md.matches.map((m, i) => ({
        key: careerId + ':g' + md.number + 'm' + i,
        careerId,
        number: md.number,
        leg: md.leg,
        homeId: m.homeId,
        awayId: m.awayId,
        played: false,
        homeGoals: null,
        awayGoals: null,
      })),
    ))
  })

  return careerId
}

const stripKeys = ({ key, careerId, ...rest }) => rest

/** Carica una carriera completa (metadati + club + calciatori + calendario). */
export async function loadCareer(id) {
  const career = await db.careers.get(id)
  const [clubs, players, fixtures] = await Promise.all([
    db.clubs.where('careerId').equals(id).toArray(),
    db.players.where('careerId').equals(id).toArray(),
    db.fixtures.where('careerId').equals(id).toArray(),
  ])
  return {
    career,
    clubs: clubs.map(stripKeys),
    players: players.map(stripKeys),
    fixtures: fixtures.map(stripKeys),
  }
}

export async function listCareers() {
  return db.careers.orderBy('createdAt').reverse().toArray()
}

export async function updateCareerSettings(id, settings) {
  await db.careers.update(id, { settings })
}

export async function deleteCareer(id) {
  await db.transaction('rw', db.careers, db.clubs, db.players, db.fixtures, async () => {
    await db.careers.delete(id)
    await Promise.all([db.clubs, db.players, db.fixtures].map((t) => t.where('careerId').equals(id).delete()))
  })
}

/** Esporta la carriera in JSON (condivisibile, riportabile su un altro device). */
export async function exportCareer(id) {
  const { career, clubs, players, fixtures } = await loadCareer(id)
  const meta = { ...career }
  delete meta.id
  return JSON.stringify({ app: 'pitchtory', format: 1, career: meta, clubs, players, fixtures })
}

/** Importa una carriera esportata. Ritorna l'id della nuova carriera. */
export async function importCareer(json) {
  const data = JSON.parse(json)
  if (data.app !== 'pitchtory' || data.format !== 1) throw new Error('File di carriera non riconosciuto')
  const careerId = await db.careers.add({ ...data.career, imported: true })
  await db.transaction('rw', db.clubs, db.players, db.fixtures, async () => {
    await db.clubs.bulkAdd(data.clubs.map((c) => ({ key: careerId + ':' + c.id, careerId, ...c })))
    await db.players.bulkAdd(data.players.map((p) => ({ key: careerId + ':' + p.id, careerId, ...p })))
    await db.fixtures.bulkAdd(data.fixtures.map((f, i) => ({ key: careerId + ':i' + i, careerId, ...f })))
  })
  return careerId
}
