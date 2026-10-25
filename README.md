# Plant Care

Local-first PWA for tracking houseplants. Same stack and architecture as Dog Care / Savings Tracker: Preact + signals, IndexedDB (idb-keyval), Vite + vite-plugin-pwa, vitest. Data lives in the browser; use Settings → Export for backups, or turn on the shared household to sync it between phones.

- **Today**: what is overdue, due today and coming up (next 30 days). One tap on ✓ logs it (with Undo); tap the card to backdate, add a note, set the next date by hand, or skip.
- **Plants**: cards with species, place, age and next care; the detail sheet has the growth timeline (planted → sprouted → buds → bloom → bloom ended → harvest, repeatable every year), the plant's routines and typical care for the species.
- **Calendar**: month grid with planting dates, milestones, care done and care still planned. Add a planting date or a milestone to any day.
- **Guide**: 26 common Ukrainian houseplants with typical care (light, watering for summer/winter, feeding, humidity, temperature, repotting, bloom months, pet toxicity); 8 pests and diseases with signs, steps, products and course length; a month-by-month plan.
- **Pest protection**: one tap adds the usual prevention plan (inspection, leaf shower, humidity in the heating season, bio treatment in spring and autumn, sticky traps). From a pest card you can schedule a treatment course (N doses a few days apart) for chosen plants.
- **Routines**: fully customisable — repeat every N days/weeks/months/years, remind N days before, which plants, active months (e.g. heating season), course length, first date, pause.
- **Species care in one tap**: summer and winter watering rhythms plus feeding for a chosen species.
- **Shared household, real time**: one person creates it and sends a single-use invite link; the second joins. Changes show on both phones within a second (WebSocket), with a toast like "Anna: 💧 Watering · Monstera". Works offline and catches up when back online.
- **Push reminders**: sent by the server at the hour you choose, even when the app is closed. Without a household, reminders show while the app is open.
- **Private**: the server stores one encrypted blob (AES-GCM). The key lives only on your phones and in the invite link's `#` part, which browsers never send to a server.
- Ukrainian and English, light/dark/auto, accent colour, backup export/import, calendar export (`.ics` with repeating events and alerts that honour the season and course length).

```
npm install
npm run dev        # develop
npm test           # unit tests (vitest)
npm run build      # typecheck + production build in dist/
npm run preview    # serve the build
npm run icons      # regenerate the leaf icons
npm run vapid      # generate push keys (once)
```

## Set up sync and reminders (once)

See [worker/README.md](worker/README.md). The server knows nothing about plants, so the Dog Care server works too: type its address in Settings. Without any server the app still works fully on one phone, with reminders while it is open and the calendar export.

## How it works

- Every record (plant, milestone, routine, log entry) has an `updatedAt`; deletions are tombstones. Merging two copies (`src/merge.ts`) is commutative and idempotent, so two phones always converge, even after being offline.
- Push has no content: the server only knows *when* to wake a phone. The service worker (`src/sw.ts`) then reads the local data and writes the message in your language.
- Tests: scheduling, merge convergence, encryption and invites, reminders, translations, calendar export, VAPID signing. `tests/worker.test.ts` runs two phones against a live server when `SYNC_URL` is set (`cd worker && npx wrangler dev --local`, then `SYNC_URL=http://localhost:8787 npm test`).
- Next due = last log + interval, unless the entry has a hand-set date. Routines with active months wait for the season. A routine with a course length stops for a plant after that many completed doses.
- All scheduling is in `src/care.ts` (pure, tested); the guide data is in `src/species.ts` and `src/pests.ts`.

## Notes

- iPhone: install to the Home Screen (Share → Add to Home Screen) before enabling push; Safari only allows push for installed apps (iOS 16.4+).
- Care intervals and treatments are typical starting points, not professional advice. Follow product labels and keep treated plants away from pets and children.
- Calendars repeat on a fixed schedule; after a late completion, export again.
