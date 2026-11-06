import { useState } from 'react'
import { generateUniverse } from '../game/universe'
import { createCareer } from '../db'
import { newSeed, seedFromString } from '../lib/rng'

const DURATIONS = {
  short: 'Compressa (1-2 min)',
  normal: 'Rilassata (5-6 min)',
  long: 'Cronaca estesa (7-8 min)',
}

export default function SetupScreen({ onStart }) {
  const [coachName, setCoachName] = useState('')
  const [seedText, setSeedText] = useState('ELEVEN-CASA')
  const [duration, setDuration] = useState('normal')
  const [seed, setSeed] = useState(null)
  const [universe, setUniverse] = useState(null)
  const [selectedId, setSelectedId] = useState(null)
  const [saving, setSaving] = useState(false)

  function generate() {
    const s = seedText.trim() ? seedFromString(seedText.trim()) : newSeed()
    setSeed(s)
    setUniverse(generateUniverse(s))
    setSelectedId(null)
  }

  async function start() {
    if (!selectedId || saving) return
    setSaving(true)
    const id = await createCareer({
      seed,
      seedText: seedText.trim() || null,
      coachName: coachName.trim() || 'Mister',
      clubId: selectedId,
      matchDuration: duration,
    })
    onStart(id)
  }

  return (
    <main className="min-h-screen bg-pitch-950 text-slate-100 p-4 sm:p-8 max-w-5xl mx-auto">
      <header className="mb-8">
        <p className="text-xs uppercase tracking-[0.3em] text-teal-400">Little Elsewhere</p>
        <h1 className="text-3xl font-bold">Pitchtory</h1>
        <p className="text-sm text-slate-400">Build your own legacy — nuova carriera</p>
      </header>

      {!universe ? (
        <div className="max-w-md space-y-4 rounded-xl border border-slate-800 bg-pitch-900/40 p-6">
          <div>
            <label className="mb-1 block text-xs text-slate-400">Nome dell'allenatore</label>
            <input
              value={coachName}
              onChange={(e) => setCoachName(e.target.value)}
              placeholder="Mister"
              className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm focus:border-teal-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-slate-400">Seed — condividilo per far giocare lo stesso universo</label>
            <input
              value={seedText}
              onChange={(e) => setSeedText(e.target.value)}
              placeholder="es. ELEVEN-CASA"
              className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm focus:border-teal-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-slate-400">Durata partita (cambiabile dopo nelle opzioni)</label>
            <select
              value={duration}
              onChange={(e) => setDuration(e.target.value)}
              className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm focus:border-teal-500 focus:outline-none"
            >
              {Object.entries(DURATIONS).map(([v, l]) => (
                <option key={v} value={v}>{l}</option>
              ))}
            </select>
          </div>
          <button
            onClick={generate}
            className="w-full rounded-lg bg-teal-500 py-2.5 text-sm font-semibold text-pitch-950 hover:bg-teal-400"
          >
            Genera universo
          </button>
        </div>
      ) : (
        <>
          <div className="mb-4 flex items-center justify-between gap-2">
            <h2 className="text-lg font-semibold">Scegli il tuo club · Divisione d'Onore {universe.season}</h2>
            <button onClick={() => setUniverse(null)} className="text-xs text-slate-400 hover:text-slate-200">
              Cambia seed
            </button>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {universe.clubs.map((c) => (
              <button
                key={c.id}
                onClick={() => setSelectedId(c.id)}
                className={'text-left rounded-xl border p-4 transition hover:border-teal-500 ' + (c.id === selectedId ? 'border-teal-500 bg-pitch-900' : 'border-slate-800 bg-pitch-900/40')}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-semibold">{c.name}</span>
                  <span className="flex shrink-0 gap-1">
                    <span className="h-3 w-3 rounded-full border border-slate-700" style={{ background: c.colors.primary }} />
                    <span className="h-3 w-3 rounded-full border border-slate-700" style={{ background: c.colors.secondary }} />
                  </span>
                </div>
                <p className="text-xs text-slate-400">{c.city} · fondato {c.founded} · {c.nickname}</p>
                <p className="text-xs text-slate-400">{c.stadium.name}</p>
                <div className="mt-2 flex items-center gap-2 text-xs">
                  <span className="rounded bg-slate-800 px-2 py-0.5">Rep {c.reputation}</span>
                  <span className="rounded bg-slate-800 px-2 py-0.5">Media {c.avgOvr}</span>
                  <span className="rounded bg-slate-800 px-2 py-0.5">Budget {(c.budget / 1e6)}M</span>
                </div>
              </button>
            ))}
          </div>
          <div className="sticky bottom-4 mt-6 flex items-center justify-between gap-3 rounded-xl border border-teal-500/40 bg-pitch-900 p-4">
            <p className="text-sm text-slate-300">
              {selectedId ? 'Hai scelto: ' + universe.clubs.find((c) => c.id === selectedId).name : 'Seleziona un club per iniziare'}
            </p>
            <button
              onClick={start}
              disabled={!selectedId || saving}
              className="rounded-lg bg-teal-500 px-5 py-2 text-sm font-semibold text-pitch-950 hover:bg-teal-400 disabled:opacity-40"
            >
              {saving ? 'Creo la carriera…' : 'Inizia carriera'}
            </button>
          </div>
        </>
      )}
    </main>
  )
}
