import { Rng, seedFromString } from '../lib/rng'

const roundFee = (v) => Math.max(10000, Math.round(v / 10000) * 10000)

/**
 * Prezzo richiesto da un club per un suo giocatore: il valore di mercato,
 * più la riluttanza. I top del club costano; i contratti in scadenza si svenano;
 * i prospetti si pagano sopra prezzo. Tutto leggibile, niente foglietti.
 */
export function askingPrice(player, sellerSquad, season) {
  let mult = 1.15
  if ((player.potential || player.ovr) - player.ovr >= 8) mult += 0.15
  if (player.age <= 21) mult += 0.1
  if (player.contractUntil <= season + 1) mult -= 0.25
  const keyIds = sellerSquad
    .filter((p) => !p.youth)
    .sort((a, b) => b.ovr - a.ovr)
    .slice(0, 3)
    .map((p) => p.id)
  if (keyIds.includes(player.id)) mult += 0.35
  return roundFee(player.value * Math.max(0.9, mult))
}

/**
 * Risposta del club venditore a un'offerta. Pura, senza rng: sotto l'80%
 * del prezzo chiesto nemmeno rispondono; tra l'80% e il prezzo pieno
 * contano il prezzo pieno. Una trattativa, non un'asta.
 */
export function respondToOffer(offer, asking, sellerSeniors) {
  if (offer <= 0) return { status: 'rejected', message: "Un'offerta seria, grazie." }
  if (sellerSeniors <= 16) return { status: 'rejected', message: 'La rosa è al limite: non possono vendere.' }
  if (offer >= asking) return { status: 'accepted', fee: offer }
  if (offer >= asking * 0.8) return { status: 'counter', counter: asking }
  return { status: 'rejected', message: 'Troppo poco: neanche si abbassano a rispondere.' }
}

/**
 * Miglior offerta della lega per un giocatore in vendita: chi ha un buco
 * in quel reparto e il budget paga una frazione del valore. Deterministica
 * dalla coppia (seed, stagione): chiederlo due volte dà lo stesso mercato.
 */
export function aiBidFor(careerSeed, season, player, buyerClubs, playersByClub) {
  const rng = new Rng(seedFromString(careerSeed + ':bid:' + season + ':' + player.id))
  let best = null
  for (const club of buyerClubs) {
    const seniors = (playersByClub[club.id] || []).filter((p) => !p.youth)
    if (seniors.length <= 16) continue
    const sameRole = seniors.filter((p) => p.role === player.role).sort((a, b) => b.ovr - a.ovr)
    const weakest = sameRole[sameRole.length - 1]
    const interested = sameRole.length < 2 || (weakest && weakest.ovr < player.ovr - 2)
    if (!interested) continue
    const fee = Math.min(club.budget, roundFee(player.value * (0.7 + rng.float() * 0.35)))
    if (fee < player.value * 0.5) continue
    if (!best || fee > best.fee) best = { club, fee }
  }
  return best
}

/** Contratto del giocatore appena acquistato: 2-4 anni, nel seed. */
export function boughtContract(careerSeed, season, player) {
  const rng = new Rng(seedFromString(careerSeed + ':contract:' + player.id))
  return season + rng.int(2, 4)
}

/**
 * Il mercato estivo della lega: i club AI si rinforzano tra loro, senza di
 * te. Il chiamante applica le trattative in ordine e salta chi resta a secco.
 */
export function aiTransferDeals(seed, season, aiClubs, playersByClub) {
  const rng = new Rng(seedFromString(seed + ':ai-transfers:' + season))
  const deals = []
  const count = rng.int(5, 10)
  for (let i = 0; i < count; i++) {
    const buyer = rng.pick(aiClubs)
    const sellers = aiClubs.filter((c) => c.id !== buyer.id)
    if (!sellers.length) continue
    const seller = rng.pick(sellers)
    const squad = (playersByClub[seller.id] || []).filter((p) => !p.youth && p.key)
    if (squad.length <= 17) continue
    const keyIds = squad.slice().sort((a, b) => b.ovr - a.ovr).slice(0, 3).map((p) => p.id)
    const targets = squad.filter((p) => !keyIds.includes(p.id))
    if (!targets.length) continue
    const target = rng.pick(targets)
    const fee = roundFee(target.value * (0.75 + rng.float() * 0.3))
    if (fee > buyer.budget) continue
    deals.push({
      playerKey: target.key,
      fromId: seller.id,
      toId: buyer.id,
      fee,
      contractUntil: season + rng.int(2, 4),
    })
  }
  return deals
}
