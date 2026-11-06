import { useEffect, useMemo, useState } from 'react'
import { useCareer } from '../store'
import { simulateMatch, matchSeed } from '../game/engine'

/** Millisecondi per minuto simulato, per durata partita configurata. */
const MS_PER_MINUTE = { short: 800, normal: 3500, long: 4700 }
const FULL_TIME = 93

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

  const clubById = useMemo(() => Object.fromEntries(clubs.map((c) => [c.id, c])), [clubs])
  const playersByClub = useMemo(() => {
    const m = {}
    for (const p of players) (m[p.clubId] = m[p.clubId] || []).push(p)
    return m
  }, [players])

  const result = useMemo(() => {
    const rng = matchSeed(career.seed, fixture.key)
    return simulateMatch(clubById[fixture.homeId], clubById[fixture.awayId], playersByClub, rng)
  }, [career, clubById, playersByClub, fixture])

  useEffect(() => {
    if (phase !== 'live') return
    if (minute >= FULL_TIME) {
      setPhase('end')
      return
    }
    const id = setTimeout(() => setMinute((m) => m + 1), MS_PER_MINUTE[career.settings.matchDuration] || 3500)
    return () => clearTimeout(id)
  }, [phase, minute, career])

  const shownEvents = phase === 'pre' ? [] : result.events.filter((e) => e.minute <= minute)
  const hg = shownEvents.filter((e) => e.type === 'goal' && e.side === 'home').length
  const ag = shownEvents.filter((e) => e.type === 'goal' && e.side === 'away').length
  const home = clubById[fixture.homeId]
  const away = clubById[fixture.awayId]

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
            <div className="mx-auto flex max-w-xs flex-col gap-2">
              <button
                onClick={() => setPhase('live')}
                className="rounded-lg bg-teal-500 py-3 text-sm font-semibold text-pitch-950 hover:bg-teal-400"
              >
                Fischio d'inizio
              </button>
              <button
                onClick={() => { setMinute(FULL_TIME); setPhase('end') }}
                className="rounded-lg border border-slate-700 px-4 py-2 text-sm text-slate-300 hover:border-teal-500"
              >
                Salta al risultato
              </button>
            </div>
          </div>
        )}

        {phase === 'live' && (
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
            <ul className="mt-6 space-y-2">
              {shownEvents.slice().reverse().map((e, i) => (
                <li key={i} className={'rounded-lg border px-3 py-2 text-sm ' + eventClass(e)}>
                  <span className="mr-2 text-xs text-slate-500">{e.minute}'</span>
                  {e.text}
                </li>
              ))}
            </ul>
          </div>
        )}

        {phase === 'end' && (
          <div className="mt-8 space-y-6 text-center">
            <p className="text-4xl font-bold tabular-nums">{result.homeGoals}-{result.awayGoals}</p>
            <p className="text-sm text-slate-400">{home.name} — {away.name}</p>
            <ul className="mx-auto max-w-sm space-y-2 text-left">
              {result.events.map((e, i) => (
                <li key={i} className="text-sm">
                  <span className="mr-2 text-xs text-slate-500">{e.minute}'</span>
                  {e.text}
                </li>
              ))}
            </ul>
            <button
              onClick={() => onDone(result)}
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
