/**
 * Calendario round-robin (metodo del cerchio), andata e ritorno.
 * 20 squadre → 19 giornate per girone, 38 totali.
 * Deterministico: usa lo stesso Rng con seed della carriera.
 */
export function generateSchedule(clubIds, rng) {
  const n = clubIds.length
  if (n % 2 !== 0) throw new Error('Il calendario richiede un numero pari di squadre')

  const arr = rng.shuffle(clubIds)
  const fixed = arr[0]
  const rot = arr.slice(1)
  const half = n / 2

  const firstLeg = []
  for (let round = 0; round < n - 1; round++) {
    const lineup = [fixed, ...rot]
    const matches = []
    for (let i = 0; i < half; i++) {
      const a = lineup[i]
      const b = lineup[n - 1 - i]
      matches.push(round % 2 === 0 ? { homeId: a, awayId: b } : { homeId: b, awayId: a })
    }
    firstLeg.push(matches)
    rot.unshift(rot.pop())
  }

  const matchdays = []
  firstLeg.forEach((matches, i) => matchdays.push({ number: i + 1, leg: 1, matches }))
  firstLeg.forEach((matches, i) =>
    matchdays.push({
      number: n - 1 + i + 1,
      leg: 2,
      matches: matches.map((m) => ({ homeId: m.awayId, awayId: m.homeId })),
    }),
  )
  return matchdays
}
