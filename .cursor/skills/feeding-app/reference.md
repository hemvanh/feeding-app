# Reptile Feed reference

## Hosting

GitHub Pages deploys branch `main`, folder `/` (root). URL: `https://hemvanh.github.io/feeding-app/`.

`main` contains the built site plus live data, not the Vite project:

- App shell: `index.html` (JS and CSS inlined by `vite-plugin-singlefile`), icons, `manifest.json`, `sw.js`
- Database: `feeding-data.json` at the repo root
- Cover photos: `pet-photos/{petId}-{coverAt}.jpg`

The connected app writes those data files itself through the GitHub Contents API, on branch `main`, as the GitHub user whose token is stored in that browser. Commit message for the JSON file is `Update feeding data`. Cover bytes go through `putGitHubBytes`. Deleting a pet with a cover deletes that photo file.

`src/data/feeding-data.json` is the bundled seed for an empty IndexedDB. `public/feeding-data.json` is copied into `dist/` by Vite. Neither file is the live database. Publishing must leave the `main` copy untouched.

## Sync behavior

`initSync` in `src/sync.ts` runs at startup.

- Database name: `reptile-feeding-db`. Pets and feedings. Hooks queue a push 250ms after a write.
- If GitHub is connected (`localStorage` key `reptile-feed-gh-connected` = `1`, plus owner, repo, and token), pull `feeding-data.json` and poll every 4 seconds.
- A remote file that is empty must not wipe a browser that already has pets. The app pushes local data instead.
- Chrome can also lock a local JSON file. That file is separate from GitHub unless that browser is connected too.
- Settings keys: `reptile-feed-gh-token`, `reptile-feed-gh-owner`, `reptile-feed-gh-repo`. Owner `hemvanh`, repo `feeding-app`. Token needs Contents read/write on this repo only. It never belongs in source.

Dump shape:

```json
{ "version": 1, "updatedAt": "ISO-8601", "pets": [], "feedings": [] }
```

`parseDump` rejects anything that is not version 1 with both arrays. Do not change the version unless every connected browser can still read the file.

Cover images are not inside the JSON. `Pet.coverAt` is a numeric stamp. The image URL is `https://raw.githubusercontent.com/hemvanh/feeding-app/main/pet-photos/{id}-{stamp}.jpg`.

## Schedule

`computeSchedule` walks events by date, then `createdAt`.

- `fed` or `water-changed`: last fed becomes that date, next due is that date plus `feedingPeriodDays`.
- Other outcomes add `extensionDays` to the current due date (or to the event date if there is no due date yet).
- Default extensions in the form: refused 1 day, regurgitated 2.
- Prepare urgency skips pets already fed today. Groups sort by `FEEDER_TYPES`, then name. Unknown types sort after the presets and before `Unspecified`.

## Routes

Hash routes in `src/App.tsx`: `#/`, `#/new`, `#/pet/{id}`, `#/pet/{id}/edit`, `#/print-qrs`.

## Stack

React 19, TypeScript, Vite 8, Dexie. `npm run dev` serves port 5173 on the LAN (`host: true`). `npm run build` is `tsc -b` then Vite. Production check for the service worker is `npm run preview` on port 4173.

PWA: `public/manifest.json` uses `id`, `start_url`, and `scope` of `./`, display `standalone`, theme `#2f7d4a`. Icons are `pwa-icon-192.png`, `pwa-icon-512.png`, and `apple-touch-icon.png`. `public/sw.js` precaches the shell and falls back to `index.html` for navigations. Same-origin GET only.
