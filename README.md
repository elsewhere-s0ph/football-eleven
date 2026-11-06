# Pitchtory ⚽

**Pitch + Victory.** Il football manager definitivo in formato PWA. Tutto client-side: nessun account, nessun server — la carriera vive sul tuo dispositivo.

> Stato: Fase 3 completa — motore partite, QTE, sostituzioni, infortuni, evoluzione OVR e fine stagione. Prossima: F4 mercato.

## Sviluppo

    npm install
    npm run dev       # http://localhost:5173
    npm run build     # build di produzione in dist/
    npm run preview   # anteprima della build

## Cosa c'è nella F3

Motore di simulazione tick-based con gol Poisson guidati dalla forza delle squadre (miglior XI, morale, fattore campo), marcatori e assist, cronaca con occasioni e cartellini. Partita della propria squadra in replay live alla velocità scelta (1-2 / 5-6 / 7-8 minuti), con "salta al risultato" prima del fischio d'inizio.

**QTE nei momenti chiave**: pool di 7 momenti possibili — rigore da giocare, uno contro uno col portiere, contropiede a favore, punizione dal limite, corner finale, contropiede da fermare, corner da difendere nel finale (attivo solo con un risultato da proteggere). 3 opzioni, timer 10 secondi, scelta prudente automatica allo scadere. L'esito di ogni opzione è precomputato deterministicamente: lo stesso QTE dà sempre lo stesso esito, niente reroll ricaricando la pagina.

**Sostituzioni in corsa**: massimo 3 cambi dal vivo, pannello con le barre di stamina di chi è in campo. Chi entra parte fresco (97%) e può cambiare la partita — gol, assist o occasione — sempre con esito deterministico dal seed. I giocatori coinvolti in un momento chiave in arrivo non sono sostituibili.

**Infortuni**: possono colpire chiunque, in ogni partita (anche nei club AI, per equità). Se ne accorghi in diretta: cambio obbligato se hai cambi disponibili, altrimenti si resta in dieci. La gravità (1-5 giornate) è nel seed della partita.

**Statistiche e progressione**: presenze, minuti e gol di ogni giocatore (colonne PG e G nella tab Rosa). A fine stagione chi ha giocato migliora di più: crescita = margine sul potenziale × età × minuti giocati. I giovani della Primavera non vedono il campo, quindi crescono in base al livello del settore giovanile. Dopo i 30 anni arriva il declino. Tutto deterministico dal seed della carriera.

**Fine stagione**: titolo assegnato alla prima in classifica, trofeo salvato nella carriera, riepilogo con chi è cresciuto e chi ha pagato dazio, invecchiamento, promozione dei Primavera che compiono 19 anni, calendario nuovo. La stessa carriera, lo stesso futuro: le stagioni successive sono deterministiche quanto la prima.

## Stack

React · Vite · Tailwind CSS · Dexie (IndexedDB) · Zustand · PRNG con seed (carriere deterministiche e condivisibili)

## Decisioni di design

- Sola Italia, una lega; data model già pensato multi-lega (prossimo futuro: più campionati con promosse e retrocesse)
- Partite della propria squadra sempre live, con QTE nei momenti chiave (3 opzioni, timer 10 s, scelta prudente allo scadere)
- Durata partita a scelta dell'utente: 1-2 min (compressa) · 5-6 min (rilassata) · 7-8 min (cronaca estesa); "salta al risultato" proposto prima del fischio d'inizio
- Massimo 3 sostituzioni a partita, con stamina per ruolo e impatto deterministico dei freschi
- Chi gioca migliora di più: la progressione dipende dai minuti, dall'età e dal potenziale nascosto
- Gestione completa: mercato, contratti, morale, rapporti
- Potenziale dei giovani mai rivelato: stima dello staff, sistema osservatori completo in F4/F5
- Abilità Speciali con rarità (comune → leggendaria)
- Nomi fittizi credibili, niente cliché

## Roadmap

- [x] F0 — Fondazioni: scaffold, Dexie, PRNG, CI
- [x] F1 — Generatori dell'universo fittizio
- [x] F2 — Data model & gestione (carriere, contratti, moduli, giovanili)
- [x] F3 — Motore partite live, QTE, sostituzioni, infortuni, progressione, fine stagione
- [ ] F4 — Mercato
- [ ] F5 — Abilità Speciali
- [ ] F6 — PWA completa (manifest, service worker, _headers, bilingue)
- [ ] F7 — Capacitor (app vera)

## Deploy

GitHub → Cloudflare Pages (project TBD).

---

© 2026 Little Elsewhere · MIT License
