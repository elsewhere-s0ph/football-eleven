import { useState } from 'react'
import { generateUniverse } from './game/universe'
import { generateSchedule } from './game/schedule'
import { Rng, seedFromString } from './lib/rng'

const ROLE_LABELS = { GK: 'Portieri', DF: 'Difensori', MF: 'Centrocampisti', FW: 'Attaccanti' }
const ROLE_ORDER = ['GK', 'DF', 'MF', 'FW']

function fmtMoney(v) {
  if (v >= 1e6) return (v / 1e6).toFixed(1).replace('.', ',') + 'M'
  if (v >= 1e3) return Math.round(v / 1e3) + 'k'
  return String(v)
}

export default function App() {
  const [seedText, setSeedText] = useState('ELEVEN-CASA')
  const [world, setWorld] = useState(null)
  const [selectedId, setSelectedId] = useState(null)

  const universe = world && world.universe
  const schedule = world && world.schedule
  const clubById = universe ? Object.fromEntries(universe.clubs.map((c) => [c.id, c])) : {}
  const selected = selectedId ? clubById[selectedId] : null
  const squad = universe ? universe.players.filter((p) => p.clubId === selectedId) : []

  function generate() {
    const u = generateUniverse(seedText)
    const rng = new Rng((seedFromString(seedText) ^ 0x5ced) >>> 0)
    const s = generateSchedule(u.clubs.map((c) => c.id), rng)
    setWorld({ universe: u, schedule: s })
    setSelectedId(null)
  }

  return (
    <main className="min-h-screen bg-pitch-950 text-slate-100 p-4 sm:p-8 max-w-5xl mx-auto">
      <header className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-teal-400">Little Elsewhere</p>
          <h1 className="text-3xl font-bold">Football Eleven</h1>
          <p className="text-sm text-slate-400">Fase 1 — Universo fittizio: squadre, calciatori, calendario</p>
        </div>
        <div className="flex gap-2">
          <input
            value={seedText}
            onChange={(e) => setSeedText(e.target.value)}
            placeholder="Seed della carriera"
            className="w-44 rounded-lg bg-slate-900 border border-slate-700 px-3 py-2 text-sm focus:outline-none focus:border-teal-500"
          />
          <button onClick={generate} className="rounded-lg bg-teal-500 text-pitch-950 font-semibold px-4 py-2 text-sm hover:bg-teal-400">
            Genera universo
          </button>
        </div>
      </header>

      {!universe && (
        <p className="text-slate-400">Inserisci un seed e genera: stesso seed, stesso universo — sempre.</p>
      )}

      {universe && (
        <>
          <h2 className="text-lg font-semibold mb-3">Divisione d'Onore · Stagione {universe.season} · {universe.players.length} calciatori</h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {universe.clubs.map((c) => (
              <button
                key={c.id}
                onClick={() => setSelectedId(c.id === selectedId ? null : c.id)}
                className={'text-left rounded-xl border p-4 transition hover:border-teal-500 ' + (c.id === selectedId ? 'border-teal-500 bg-pitch-900' : 'border-slate-800 bg-pitch-900/40')}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-semibold">{c.name}</span>
                  <span className="flex gap-1 shrink-0">
                    <span className="h-3 w-3 rounded-full border border-slate-700" style={{ background: c.colors.primary }} />
                    <span className="h-3 w-3 rounded-full border border-slate-700" style={{ background: c.colors.secondary }} />
                  </span>
                </div>
                <p className="text-xs text-slate-400">{c.city} · fondato {c.founded} · {c.nickname}</p>
                <p className="text-xs text-slate-400">{c.stadium.name} ({c.stadium.capacity.toLocaleString('it-IT')} posti)</p>
                <div className="mt-2 flex items-center gap-2 text-xs">
                  <span className="rounded bg-slate-800 px-2 py-0.5">Rep {c.reputation}</span>
                  <span className="rounded bg-slate-800 px-2 py-0.5">Media {c.avgOvr}</span>
                  <span className="rounded bg-slate-800 px-2 py-0.5">Budget {fmtMoney(c.budget)}</span>
                </div>
              </button>
            ))}
          </div>

          {selected && (
            <section className="mt-8">
              <h2 className="text-lg font-semibold mb-3">{selected.name} — rosa</h2>
              {[false, true].map((youth) => (
                <div key={String(youth)} className="mb-6">
                  {youth && <h3 className="text-sm uppercase tracking-wider text-teal-400 mb-2">Primavera</h3>}
                  {ROLE_ORDER.map((role) => {
                    const list = squad.filter((p) => p.role === role && p.youth === youth).sort((a, b) => b.ovr - a.ovr)
                    if (!list.length) return null
                    return (
                      <div key={role + String(youth)} className="mb-3">
                        <h4 className="text-xs uppercase tracking-wider text-slate-400 mb-1">{ROLE_LABELS[role]}</h4>
                        <ul className="divide-y divide-slate-800/60 rounded-xl border border-slate-800 bg-pitch-900/40">
                          {list.map((p) => (
                            <li key={p.id} className="flex items-center gap-3 px-3 py-2 text-sm">
                              <span className="w-8 text-center font-bold text-teal-400">{p.ovr}</span>
                              <span className="flex-1">{p.name}</span>
                              <span className="text-xs text-slate-400">{p.age}a · {p.foot}</span>
                              <span className="text-xs text-slate-400">pot {p.potential}</span>
                              <span className="w-16 text-right text-xs text-slate-300">{fmtMoney(p.value)}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )
                  })}
                </div>
              ))}
            </section>
          )}

          <section className="mt-8">
            <h2 className="text-lg font-semibold mb-3">Calendario — prime 3 giornate</h2>
            <div className="grid gap-3 sm:grid-cols-3">
              {schedule.slice(0, 3).map((md) => (
                <div key={md.number} className="rounded-xl border border-slate-800 bg-pitch-900/40 p-4">
                  <h3 className="text-sm font-semibold text-teal-400 mb-2">Giornata {md.number}</h3>
                  <ul className="space-y-1 text-xs">
                    {md.matches.map((m, i) => (
                      <li key={i} className="flex justify-between gap-2">
                        <span>{clubById[m.homeId].name}</span>
                        <span className="text-slate-500">-</span>
                        <span className="text-right">{clubById[m.awayId].name}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </section>
        </>
      )}
    </main>
  )
}
