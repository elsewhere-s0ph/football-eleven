# Pitchtory ⚽

**Pitch + Victory.** Il football manager definitivo in formato PWA. Tutto client-side: nessun account, nessun server — la carriera vive sul tuo dispositivo.

> Stato: Fase 3 — Motore partite (QTE e sostituzioni completati; in arrivo: infortuni, evoluzione OVR, fine stagione).

## Sviluppo

    npm install
    npm run dev       # http://localhost:5173
    npm run build     # build di produzione in dist/
    npm run preview   # anteprima della build

## Cosa c'è nella F3 (finora)

Motore di simulazione tick-based con gol Poisson guidati dalla forza delle squadre (miglior XI, morale, fattore campo), marcatori e assist, cronaca con occasioni e cartellini. Partita della propria squadra in replay live alla velocità scelta (1-2 / 5-6 / 7-8 minuti), con "salta al risultato" prima del fischio d'inizio.

**QTE nei momenti chiave**: pool di 7 momenti possibili — rigore da giocare, uno contro uno col portiere, contropiede a favore, punizione dal limite, corner finale, contropiede da fermare, corner da difendere nel finale (attivo solo con un risultato da proteggere). 3 opzioni, timer 10 secondi, scelta prudente automatica allo scadere. L'esito di ogni opzione è precomputato deterministicamente: lo stesso QTE dà sempre lo stesso esito, niente reroll ricaricando la pagina.

**Sostituzioni in corsa**: massimo 3 cambi dal vivo, pannello con le barre di stamina di chi è in campo (ogni ruolo consuma energie a modo suo: i centrocampisti più di tutti, il portiere quasi nulla). Chi entra parte fresco (97%) e può cambiare la partita — gol, assist o occasione pericolosa — sempre con esito deterministico dal seed: niente reroll nemmeno sui cambi. I giocatori coinvolti in un momento chiave in arrivo non sono sostituibili.

Il resto della giornata si simula in background, la classifica si aggiorna e il morale risente del risultato. In arrivo: infortuni, evoluzione OVR in stagione e fine stagione con assegnazione del campionato.

## Stack

React · Vite · Tailwind CSS · Dexie (IndexedDB) · Zustand · PRNG con seed (carriere deterministiche e condivisibili)

## Decisioni di design

- Sola Italia, una lega; data model già pensato multi-lega (prossimo futuro: più campionati con promosse e retrocesse)
- Partite della propria squadra sempre live, con QTE nei momenti chiave (3 opzioni, timer 10 s, scelta prudente allo scadere)
- Durata partita a scelta dell'utente: 1-2 min (compressa) · 5-6 min (rilassata) · 7-8 min (cronaca estesa); "salta al risultato" proposto prima del fischio d'inizio
- Massimo 3 sostituzioni a partita, con stamina per ruolo e impatto deterministico dei freschi
- Gestione completa: mercato, contratti, morale, rapporti
- Potenziale dei giovani mai rivelato: stima dello staff, sistema osservatori completo in F4/F5
- Abilità Speciali con rarità (comune → leggendaria)
- Nomi fittizi credibili, niente cliché

## Roadmap

- [x] F0 — Fondazioni: scaffold, Dexie, PRNG, CI
- [x] F1 — Generatori dell'universo fittizio
- [x] F2 — Data model & gestione (carriere, contratti, morale, giovanili)
- [ ] F3 — Motore partite live + QTE + sostituzioni (in corso: mancano infortuni e progressione)
- [ ] F4 — Mercato
- [ ] F5 — Abilità Speciali
- [ ] F6 — PWA completa (manifest, service worker, _headers, bilingue)
- [ ] F7 — Capacitor (app vera)

## Deploy

GitHub → Cloudflare Pages (project TBD).

---

© 2026 Little Elsewhere · MIT License
