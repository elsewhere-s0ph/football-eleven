import { useEffect, useMemo, useState } from 'react'
import { useCareer } from '../store'
import { buildMatch, matchSeedNumber } from '../game/engine'
import { Rng } from '../lib/rng'

/** Millisecondi per minuto simulato, per durata partita configurata. */
const MS_PER_MINUTE = { short: 800, normal: 3500, long: 4700 }
const FULL_TIME = 93
const QTE_SECONDS = 10

function eventClass(e) {
  if (e.type === 'goal') return 'border-teal-500/40 bg-teal-500/10 font-semibold text-teal-200'
  if (e.type === 'red') return 'border-red-500/40 bg-red-500/10 text-red-300'
  if (e.type === 'card') return 'border-amber-500/30 bg-amber-500/5 text-amber-200/80'
  return 'border-slate-800 bg-pitch-900/40 text-slate-300'
}

function TeamBadge({ club }) {
  return (
    <div className="max-w-[45%]">
      <span
        className="mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-full border border-slate-700"
        style={{ background: club.colors.primary }}
      />
      <p className="truncate text-sm font-semibold">{club.name}</p>
    </div>
  )
}

export default function MatchScreen({ fixture, onDone }) {
  const { career, clubs, players } = useCareer()
  const [phase, setPhase] = useState('pre')
  const [minute, setMinute] = useState(0)
  const [resolved, setResolved] = useState({})
  const [qteSeconds, setQteSeconds] = useState(QTE_SECONDS)

  const clubById = useMemo(() => Object.fromEntries(clubs.map((c) => [c.id, c])), [clubs])
  const playersByClub = useMemo(() => {
    const m = {}
    for (const p of players) (m[p.clubId] = m[p.clubId] || []).push(p)
    return m
  }, [players])

  const match = useMemo(() => {
    const seedNumber = matchSeedNumber(career.seed, fixture.key)
    const rng = new Rng(seedNumber)
    const built = buildMatch(clubById[fixture.homeId], clubById[fixture.awayId], playersByClub, rng, {
      keyMoments: true,
      seedNumber,
      userClubId: career.clubId,
    })
    return { ...built, userIsHome: fixture.homeId === career.clubId }
  }, [career, clubById, playersByClub, fixture])

  /** Eventi generati dalle scelte QTE risolte. */
  const momentEvents = useMemo(() => {
    const userSide = match.userIsHome ? 'home' : 'away'
    const oppSide = match.userIsHome ? 'away' : 'home'
    return match.keyMoments
      .filter((m) => resolved[m.id] !== undefined)
      .map((m) => {
        const outcome = m.options[resolved[m.id]].outcome
        const ev = { minute: m.minute, text: outcome.text, qte: true }
        if (outcome.goal) return { ...ev, side: userSide, type: 'goal', playerId: outcome.playerId }
        if (outcome.goalAgainst) return { ...ev, side: oppSide, type: 'goal', playerId: outcome.playerId }
        if (outcome.card) return { ...ev, side: userSide, type: 'card' }
        return { ...ev, side: userSide, type: 'chance' }
      })
  }, [match, resolved])

  const allEvents = useMemo(
    () => [...match.baseEvents, ...momentEvents].sort((a, b) => a.minute - b.minute),
    [match, momentEvents],
  )

  const pendingMoment = match.keyMoments.find((m) => m.minute <= minute && resolved[m.id] === undefined)

  // Avanzamento minuto per minuto, con pausa QTE sui momenti chiave.
  useEffect(() => {
    if (phase !== 'live') return
    if (pendingMoment) {
      setPhase('qte')
      setQteSeconds(QTE_SECONDS)
      return
    }
    if (minute >= FULL_TIME) {
      setPhase('end')
      return
    }
    const id = setTimeout(() => setMinute((m) => m + 1), MS_PER_MINUTE[career.settings.matchDuration] || 3500)
    return () => clearTimeout(id)
  }, [phase, minute, career, pendingMoment])

  // Countdown del QTE: allo scadere vince la prudenza.
  useEffect(() => {
    if (phase !== 'qte') return
    if (qteSeconds <= 0) {
      resolvePrudent()
      return
    }
    const id = setTimeout(() => setQteSeconds((s) => s - 1), 1000)
    return () => clearTimeout(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, qteSeconds])

  function chooseOption(moment, index) {
    setResolved((r) => ({ ...r, [moment.id]: index }))
    setPhase('live')
  }

  function resolvePrudent() {
    const m = match.keyMoments.find((x) => x.minute <= minute && resolved[x.id] === undefined)
    if (!m) {
      setPhase('live')
      return
    }
    const idx = Math.max(0, m.options.findIndex((o) => o.prudent))
    chooseOption(m, idx)
  }

  function skipToEnd() {
    const prudentAll = {}
    for (const m of match.keyMoments) prudentAll[m.id] = Math.max(0, m.options.findIndex((o) => o.prudent))
    setResolved(prudentAll)
    setMinute(FULL_TIME)
    setPhase('end')
  }

  const eventsVisible = phase === 'pre' ? [] : allEvents.filter((e) => e.minute <= minute)
  const hg = eventsVisible.filter((e) => e.type === 'goal' && e.side === 'home').length
  const ag = eventsVisible.filter((e) => e.type === 'goal' && e.side === 'away').length
  const home = clubById[fixture.homeId]
  const away = clubById[fixture.awayId]

  const finalResult = {
    homeGoals: allEvents.filter((e) => e.type === 'goal' && e.side === 'home').length,
    awayGoals: allEvents.filter((e) => e.type === 'goal' && e.side === 'away').length,
    events: allEvents,
  }

  return (
    <div className="fixed inset-0 z-10 overflow-y-auto bg-pitch-950">
      <div className="mx-auto max-w-2xl p-4 pb-10 sm:p-8">
        <p className="text-center text-xs uppercase tracking-[0.3em] text-teal-400">
          Divisione d'Onore · Giornata {fixture.number}
        </p>

        {phase === 'pre' && (
          <div className="mt-8 space-y-6 text-center">
            <div className="flex items-center justify-center gap-4">
              <TeamBadge club={home} />
              <span className="text-slate-500">vs</span>
              <TeamBadge club={away} />
            </div>
            <p className="text-xs text-slate-500">
              Durante la partita potrebbero arrivare momenti chiave: 3 opzioni, {QTE_SECONDS} secondi per decidere.
            </p>
            <div className="mx-auto flex max-w-xs flex-col gap-2">
              <button
                onClick={() => setPhase('live')}
                className="rounded-lg bg-teal-500 py-3 text-sm font-semibold text-pitch-950 hover:bg-teal-400"
              >
                Fischio d'inizio
              </button>
              <button
                onClick={skipToEnd}
                className="rounded-lg border border-slate-700 px-4 py-2 text-sm text-slate-300 hover:border-teal-500"
              >
                Salta al risultato
              </button>
            </div>
          </div>
        )}

        {(phase === 'live' || phase === 'qte') && (
          <div className="mt-6">
            <div className="flex items-center justify-between gap-2 text-lg font-bold">
              <span className="min-w-0 flex-1 truncate text-right">{home.name}</span>
              <span className="shrink-0 rounded-lg bg-slate-800 px-3 py-1 tabular-nums">{hg}-{ag}</span>
              <span className="min-w-0 flex-1 truncate">{away.name}</span>
            </div>
            <p className="mt-1 text-center text-xs text-slate-400">{minute} minuti · recupero incluso</p>
            <div className="mt-2 h-1 rounded bg-slate-800">
              <div
                className="h-1 rounded bg-teal-500 transition-all"
                style={{ width: (minute / FULL_TIME) * 100 + '%' }}
              />
            </div>

            {phase === 'qte' && pendingMoment && (
              <div className="mt-4 rounded-xl border-2 border-amber-500/60 bg-pitch-900 p-4">
                <p className="text-sm font-semibold text-amber-400">
                  {pendingMoment.minute}' — {pendingMoment.prompt}
                </p>
                <div className="mt-2 h-1 rounded bg-slate-800">
                  <div
                    className="h-1 rounded bg-amber-500 transition-all"
                    style={{ width: (qteSeconds / QTE_SECONDS) * 100 + '%' }}
                  />
                </div>
                <p className="mt-1 text-right text-xs text-amber-300">{qteSeconds}s</p>
                <div className="mt-2 space-y-2">
                  {pendingMoment.options.map((o, i) => (
                    <button
                      key={o.id}
                      onClick={() => chooseOption(pendingMoment, i)}
                      className="w-full rounded-lg border border-slate-700 px-3 py-2.5 text-left transition hover:border-amber-500"
                    >
                      <span className="text-sm font-semibold">{o.label}</span>
                      <span className="ml-2 text-xs text-slate-400">{o.hint}</span>
                    </button>
                  ))}
                </div>
                <p className="mt-2 text-xs text-slate-500">Allo scadere sceglie la prudenza per te.</p>
              </div>
            )}

            <ul className="mt-6 space-y-2">
              {eventsVisible.slice().reverse().map((e, i) => (
                <li key={i} className={'rounded-lg border px-3 py-2 text-sm ' + eventClass(e)}>
                  <span className="mr-2 text-xs text-slate-500">{e.minute}'</span>
                  {e.qte && <span className="mr-1 rounded bg-amber-500/20 px-1 text-[10px] text-amber-300">QTE</span>}
                  {e.text}
                </li>
              ))}
            </ul>
          </div>
        )}

        {phase === 'end' && (
          <div className="mt-8 space-y-6 text-center">
            <p className="text-4xl font-bold tabular-nums">{finalResult.homeGoals}-{finalResult.awayGoals}</p>
            <p className="text-sm text-slate-400">{home.name} — {away.name}</p>
            <ul className="mx-auto max-w-sm space-y-2 text-left">
              {allEvents.map((e, i) => (
                <li key={i} className="text-sm">
                  <span className="mr-2 text-xs text-slate-500">{e.minute}'</span>
                  {e.qte && <span className="mr-1 rounded bg-amber-500/20 px-1 text-[10px] text-amber-300">QTE</span>}
                  {e.text}
                </li>
              ))}
            </ul>
            <button
              onClick={() => onDone(finalResult)}
              className="rounded-lg bg-teal-500 px-6 py-2.5 text-sm font-semibold text-pitch-950 hover:bg-teal-400"
            >
              Continua
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
