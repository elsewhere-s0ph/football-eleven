# Football Eleven ⚽

Il football manager definitivo in formato PWA. Tutto client-side: nessun account, nessun server — la carriera vive sul tuo dispositivo.

> Stato: Fase 1 — Generatori dell'universo fittizio.

## Sviluppo

    npm install
    npm run dev       # http://localhost:5173
    npm run build     # build di produzione in dist/
    npm run preview   # anteprima della build

## Anteprima F1

In locale: inserisci un seed (es. ELEVEN-CASA) e premi "Genera universo". Stesso seed → stesso universo, sempre: 20 club della Divisione d'Onore (8 con nome e storia a mano, 12 generati), 28 calciatori ciascuno (22 prima squadra + 6 Primavera), calendario andata/ritorno a 38 giornate.

## Stack

React · Vite · Tailwind CSS · Dexie (IndexedDB) · Zustand · PRNG con seed (carriere deterministiche e condivisibili)

## Decisioni di design

- Sola Italia, una lega; data model già pensato multi-lega (prossimo futuro: più campionati con promosse e retrocesse)
- Partite della propria squadra sempre live, con QTE nei momenti chiave (3 opzioni, timer 10 s, scelta prudente allo scadere)
- Durata partita a scelta dell'utente: 1-2 min (compressa) · 5-6 min (rilassata) · 7-8 min (cronaca estesa); "salta al risultato" proposto prima del fischio d'inizio
- Gestione completa: mercato, contratti, giovanili, morale, rapporti
- Abilità Speciali con rarità (comune → leggendaria)
- Nomi fittizi credibili, niente cliché

## Roadmap

- [x] F0 — Fondazioni: scaffold, Dexie, PRNG, CI
- [x] F1 — Generatori dell'universo fittizio
- [ ] F2 — Data model & gestione (contratti, giovanili, morale, rapporti)
- [ ] F3 — Motore partite live + QTE + sostituzioni
- [ ] F4 — Mercato
- [ ] F5 — Abilità Speciali
- [ ] F6 — PWA completa (manifest, service worker, _headers, bilingue)
- [ ] F7 — Capacitor (app vera)

## Deploy

GitHub → Cloudflare Pages (project TBD).

---

© 2026 Little Elsewhere · MIT License
