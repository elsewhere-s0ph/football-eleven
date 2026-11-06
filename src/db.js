import Dexie from 'dexie'
import { generateUniverse, playerValue } from './game/universe'
import { generateSchedule } from './game/schedule'
import { computeStandings } from './game/standings'
import { seasonGrowth } from './game/progression'
import { deriveOvr, migrateAttrs, rollAttrsForOvr, growAttrs, declineAttrs } from './game/attributes'
import { Rng, seedFromString } from './lib/rng'

const PERSONALITIES = ['Leader', 'Professionista', 'Temperamentale', 'Sognatore', 'Grintoso', 'Pacato']
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v))

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
    trophies: [],
    createdAt: new Date().toISOString(),
  })

  await db.transaction('rw', db.clubs, db.players, db.fixtures, async () => {
    await db.clubs.bulkAdd(universe.clubs.map((c) => ({ key: careerId + ':' + c.id, careerId, ...c })))
    await db.players.bulkAdd(universe.players.map((p) => ({
      key: careerId + ':' + p.id,
      careerId,
      morale: moraleRng.int(62, 82),
      personality: moraleRng.pick(PERSONALITIES),
      apps: 0,
      minutes: 0,
      goals: 0,
      injuredUntil: null,
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

/**
 * Carica una carriera completa. Le righe conservano key e careerId.
 * Migrazione lazy (v0.9): chi non ha gli attributi in scala 1-20 li riceve
 * qui, deterministi dal seed e centrati sull'OVR attuale — la carriera
 * continua identica a come l'hai lasciata.
 */
export async function loadCareer(id) {
  const career = await db.careers.get(id)
  const [clubs, players, fixtures] = await Promise.all([
    db.clubs.where('careerId').equals(id).toArray(),
    db.players.where('careerId').equals(id).toArray(),
    db.fixtures.where('careerId').equals(id).toArray(),
  ])

  const stale = (p) => !p.attributes || Object.values(p.attributes).some((v) => v > 20)
  const toMigrate = players.filter(stale)
  if (toMigrate.length) {
    await db.transaction('rw', db.players, async () => {
      for (const p of toMigrate) {
        const rng = new Rng(seedFromString(career.seed + ':' + p.id + ':attrs'))
        p.attributes = p.attributes
          ? migrateAttrs(p.attributes, p.role, p.ovr)
          : rollAttrsForOvr(rng, p.ovr, p.role)
        if (p.key) await db.players.update(p.key, { attributes: p.attributes })
      }
    })
  }

  return { career, clubs, players, fixtures }
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

/** Scrive i risultati di una o più partite giocate. */
export async function saveFixtureResults(results) {
  await db.transaction('rw', db.fixtures, async () => {
    for (const r of results) {
      await db.fixtures.update(r.key, { played: true, homeGoals: r.homeGoals, awayGoals: r.awayGoals })
    }
  })
}

/**
 * Post-partita della squadra dell'utente: morale (+5/-5/+1, +2 ai marcatori),
 * statistiche stagionali (presenze, minuti, gol) e infortuni di entrambe
 * le squadre (injuredUntil = giornate di stop, inclusa quella corrente).
 */
export async function applyPostMatch(careerId, fixture, result, userClubId, userPlayers, allPlayers) {
  const isHome = fixture.homeId === userClubId
  const userSide = isHome ? 'home' : 'away'
  const userGoals = isHome ? result.homeGoals : result.awayGoals
  const oppGoals = isHome ? result.awayGoals : result.homeGoals
  const delta = userGoals > oppGoals ? 5 : userGoals < oppGoals ? -5 : 1

  const goalCounts = {}
  for (const e of result.events) {
    if (e.type === 'goal' && e.side === userSide && e.playerId) {
      goalCounts[e.playerId] = (goalCounts[e.playerId] || 0) + 1
    }
  }
  const minutes = result.minutesPlayed || {}
  const byId = new Map((allPlayers || []).map((p) => [p.id, p]))
  const injuries = result.events.filter((e) => e.type === 'injury' && e.playerId && e.weeks)

  await db.transaction('rw', db.players, async () => {
    for (const p of userPlayers) {
      const min = minutes[p.id] || 0
      let morale = clamp(p.morale + delta, 20, 99)
      if (goalCounts[p.id]) morale = clamp(morale + 2 * goalCounts[p.id], 20, 99)
      const updates = { morale }
      if (min > 0) {
        updates.apps = (p.apps || 0) + 1
        updates.minutes = (p.minutes || 0) + min
        updates.goals = (p.goals || 0) + (goalCounts[p.id] || 0)
      }
      if (p.key) await db.players.update(p.key, updates)
    }
    for (const e of injuries) {
      const p = byId.get(e.playerId)
      if (p && p.key) await db.players.update(p.key, { injuredUntil: fixture.number + e.weeks })
    }
  })
}

/** Infortuni delle partite simulate in background: la lega soffrice quanto te. */
export async function applyAiMatchday(fixture, events, allPlayers) {
  const byId = new Map((allPlayers || []).map((p) => [p.id, p]))
  const injuries = events.filter((e) => e.type === 'injury' && e.playerId && e.weeks)
  if (!injuries.length) return
  await db.transaction('rw', db.players, async () => {
    for (const e of injuries) {
      const p = byId.get(e.playerId)
      if (p && p.key) await db.players.update(p.key, { injuredUntil: fixture.number + e.weeks })
    }
  })
}

/**
 * Chiude la stagione: assegna il titolo, fa crescere (o invecchiare) i
 * giocatori attributo per attributo, promuove i Primavera che compiono
 * 19 anni, azzera le statistiche, guarisce gli infortuni e genera il
 * calendario nuovo. Deterministica dal seed: stessa carriera, stesso futuro.
 * Ritorna il riepilogo per la schermata di fine stagione.
 */
export async function endSeason(careerId) {
  const { career, clubs, players, fixtures } = await loadCareer(careerId)
  const standings = computeStandings(clubs, fixtures)
  const champion = standings[0]
  const clubById = Object.fromEntries(clubs.map((c) => [c.id, c]))

  const summary = {
    season: career.season,
    champion: champion.name,
    userPosition: standings.findIndex((r) => r.clubId === career.clubId) + 1,
    userChampion: champion.clubId === career.clubId,
    progressed: [],
    declined: [],
  }

  const baseSeed = career.seed + ':' + career.season + ':'

  // Statistiche sintetiche per i club AI, così anche la lega evolves:
  // i titolari giocano, le riserve rosicchiano, gli altri guardano.
  for (const c of clubs) {
    if (c.id === career.clubId) continue
    const rng = new Rng(seedFromString(baseSeed + 'ai:' + c.id))
    const seniors = players
      .filter((p) => p.clubId === c.id && !p.youth)
      .sort((a, b) => b.ovr - a.ovr)
    seniors.forEach((p, i) => {
      const minutes = i < 11 ? rng.int(1800, 2700) : i < 16 ? rng.int(300, 1200) : rng.int(0, 300)
      p.minutes = minutes
      p.apps = Math.round(minutes / 85)
    })
  }

  // NB: clubs serve dentro la transazione (media OVR): ometterlo dallo
  // scope fa fallire tutta la transazione su Dexie.
  await db.transaction('rw', db.careers, db.clubs, db.players, db.fixtures, async () => {
    for (const p of players) {
      const club = clubById[p.clubId]
      const youthLevel = (club && club.facilities && club.facilities.youthLevel) || 1
      const rng = new Rng(seedFromString(baseSeed + p.id))
      const growth = seasonGrowth(rng, p, youthLevel)
      const age = p.age + 1
      const target = growth > 0 ? Math.min(p.ovr + growth, p.potential) : p.ovr + growth
      let ovr = target
      let attributes = p.attributes
      if (attributes) {
        attributes = growth > 0
          ? growAttrs(attributes, p.role, target, rng)
          : growth < 0
            ? declineAttrs(attributes, p.role, target, rng)
            : attributes
        ovr = deriveOvr(attributes, p.role)
      }
      const updates = {
        ovr,
        age,
        attributes,
        youth: p.youth && age < 19,
        value: playerValue(ovr, age, p.potential),
        apps: 0,
        minutes: 0,
        goals: 0,
        injuredUntil: null,
      }
      if (p.clubId === career.clubId && growth !== 0) {
        const entry = { name: p.name, from: p.ovr, to: ovr, youth: p.youth }
        if (growth > 0) summary.progressed.push(entry)
        else summary.declined.push(entry)
      }
      p.ovr = ovr
      p.attributes = attributes
      if (p.key) await db.players.update(p.key, updates)
    }

    // Media OVR aggiornata per ogni club (i Primavera promossi a 19 anni
    // contano già come senior).
    for (const c of clubs) {
      const list = players.filter((p) => p.clubId === c.id && !(p.youth && p.age + 1 < 19))
      const avg = list.length ? Math.round(list.reduce((s, p) => s + p.ovr, 0) / list.length) : c.avgOvr
      if (c.key) await db.clubs.update(c.key, { avgOvr: avg })
    }

    await db.careers.update(careerId, {
      season: career.season + 1,
      trophies: [
        ...(career.trophies || []),
        { season: career.season, competition: "Divisione d'Onore", championId: champion.clubId, championName: champion.name },
      ],
    })

    await db.fixtures.where('careerId').equals(careerId).delete()
    const schedule = generateSchedule(clubs.map((c) => c.id), new Rng((career.seed ^ (0x5ced + career.season)) >>> 0))
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

  const weight = (x) => Math.abs(x.to - x.from)
  summary.progressed.sort((a, b) => weight(b) - weight(a))
  summary.declined.sort((a, b) => weight(b) - weight(a))
  return summary
}

const stripKeys = ({ key, careerId, ...rest }) => rest

/** Esporta la carriera in JSON (condivisibile, riportabile su un altro device). */
export async function exportCareer(id) {
  const { career, clubs, players, fixtures } = await loadCareer(id)
  const meta = { ...career }
  delete meta.id
  return JSON.stringify({
    app: 'pitchtory',
    format: 1,
    career: meta,
    clubs: clubs.map(stripKeys),
    players: players.map(stripKeys),
    fixtures: fixtures.map(stripKeys),
  })
}

/** Importa una carriera esportata. Ritorna l'id della nuova carriera. */
export async function importCareer(json) {
  const data = JSON.parse(json)
  if (data.app !== 'pitchtory' || data.format !== 1) throw new Error('File di carriera non riconosciuto')
  const careerId = await db.careers.add({ ...data.career, imported: true })
  await db.transaction('rw', db.clubs, db.players, db.fixtures, async () => {
    await db.clubs.bulkAdd(data.clubs.map((c) => ({ ...c, key: careerId + ':' + c.id, careerId })))
    await db.players.bulkAdd(data.players.map((p) => ({ ...p, key: careerId + ':' + p.id, careerId })))
    await db.fixtures.bulkAdd(data.fixtures.map((f, i) => ({ ...f, key: careerId + ':i' + i, careerId })))
  })
  return careerId
}
