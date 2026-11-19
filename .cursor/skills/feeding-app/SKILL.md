---
name: feeding-app
description: >-
  Maintain the Reptile Feed tracker (hemvanh/feeding-app): Vite source on dev,
  GitHub Pages on main, and live feeding-data.json sync. Use when editing,
  optimizing, debugging, or styling this Feeding App, or when the user says
  publish all or deploy all.
---

# Reptile Feed

Local browser app for reptile, frog, and fish feeding. IndexedDB is the working copy. GitHub Pages hosts the site and the shared `feeding-data.json`. Repo: `hemvanh/feeding-app`. Live site: `https://hemvanh.github.io/feeding-app/`.

Stay on `dev` unless publishing. The short branch rule in `.cursor/rules/branch-roles.mdc` always applies. This skill is the working manual of the current app. If it disagrees with that rule about which files to copy or about `feeding-data.json`, follow the rule. Data shape, sync, and Pages hosting are in [reference.md](reference.md).

A new chat should treat the sections below as the contract. Change only the feature asked, and leave the rest of this behavior in place.

## Hard rules

- `dev` is the Vite source. `main` is only the built Pages site. Never merge `dev` into `main`. Never put `src/`, `package.json`, `dist/`, or `node_modules/` on `main`.
- Do not overwrite live `feeding-data.json` or `pet-photos/` unless the user explicitly asks. A production build copies a seed JSON into `dist/`; that seed is not the live database.
- Do not commit unless the user asks, or they say **publish all** or **deploy all** (same procedure).
- Do not run `git config`. This machine has no commit identity. For every commit, set only the process environment: `GIT_AUTHOR_NAME` and `GIT_COMMITTER_NAME` = `hemvanh`, `GIT_AUTHOR_EMAIL` and `GIT_COMMITTER_EMAIL` = `hemvanh@users.noreply.github.com`.
- Shell is PowerShell. Do not use `&&` or bash heredocs. Commit with a PowerShell here-string: `git commit -m @" ... "@`.
- Never force-push. If `git push origin main` is rejected, `git pull --rebase origin main`, then push again.
- The GitHub token lives only in the browser (`localStorage`). Never ask the user to paste it into chat, and never write it into the repo.
- After UI, layout, or client-state changes, verify the affected flow in the browser at `http://localhost:5173` before finishing. Do not save a real feeding or pet edit during that check; a connected browser will push it to GitHub. If the page still shows old source, a service worker from a previous production visit is serving it: unregister it in that test browser and reload. `npm run dev` is the check; the service worker registers only for a production build.

## Publish all / deploy all

**publish all** and **deploy all** are interchangeable. Either phrase runs this same procedure, in order, without asking again. Skip an empty `dev` commit when the tree is clean; still build and update `main` if the live site needs that build.

1. On `dev`, stage only the relevant source changes, commit, and `git push origin dev`.
2. On `dev`, run `npm run build`.
3. `git checkout main`, then `git pull --rebase origin main` so newer data commits are included first.
4. Copy these files from `dist/` onto the `main` working tree root: `index.html`, `favicon.svg`, `icons.svg`, `manifest.json`, `sw.js`, `pwa-icon-192.png`, `pwa-icon-512.png`, `apple-touch-icon.png`, `pwa-icon.svg`. Do not copy `feeding-data.json`. Do not `git add` `dist/` or `node_modules/`.
5. Commit the copied site files. `main` messages start with `Publish`. `dev` messages are normal sentences about why.
6. `git push origin main`.
7. `git checkout dev` and leave that branch checked out.

`main` often moves while you build because the app commits `Update feeding data` from a phone or PC. Rebase onto that, then push. Do not force-push.

## Schedule

`computeSchedule` and `buildCycles` in `src/utils/schedule.ts`. Events are ordered by date, then `createdAt`. One `outcome` still drives the schedule.

- `fed` and `water-changed` succeed and set "last ate" to that date. Refused, Regurg., Molt/Shed, and an extension do not.
- Every record sets the next due date to the record's date plus `extensionDays` when that is above 0, otherwise the record's date plus the pet's `feedingPeriodDays`. The extension replaces the cycle. It is not added to the cycle or to the previous due date.
- On the calendar, every record ends the current colour band and starts a new one from its own date to its own due date. The band stops where the next record starts. Only `fed` and `water-changed` bands mark their first day as Fed (underline and "Fed").

## Add feeding

`src/components/FeedingForm.tsx`. The pet page header has a static `Feed !` label. There is no Extend tab.

- Tag order: Ate, W. Changed, Refused, Regurg., Molt/Shed, then custom tags. `Molt/Shed` is a standard tag, not an outcome.
- Selected tags are green. They turn red (`#c8372b`, dark `#c8372b` with a lighter border) while Extend is checked. Custom tags follow the same colours.
- Refused, Regurg., and Molt/Shed check Extend automatically, with 1, 2, and 3 days. When several of those are on, the largest default wins. Turning the last of them off unchecks Extend. Checking Extend by hand uses that suggested number, or 3.
- Extend notes go into `note`. Days and notes stay disabled until Extend is checked. Extend needs at least 1 day.
- At least one tag or a checked Extend is required. Custom tags count. Typing a custom tag and leaving the field adds it, same as Enter. Custom tags can be removed; standard tags only toggle.
- Outcome priority: regurgitated, refused, water-changed, fed. Molt/Shed or Extend with no other result saves as `extended`. Custom tags only, with Extend off, save as `fed`.
- A water-change pet opens the form with W. Changed selected. Saving returns to Pending.

## Calendar

`src/components/MiniCalendar.tsx`. Home pet cards stay at two weeks and have no size buttons.

- Every record day gets a corner icon. Priority when a day has several records: Regurg. (orange arrow), Refused (red ✕), Molt/Shed (purple dot), extension (blue clock), W. Changed (teal drop), Ate (green check).
- Tapping a marked day opens a bubble with one line per record: its tags, or the legacy note when there are no tags, or the result name when there is neither. Sunday and Saturday bubbles align to the card edge. Tapping the same day or anywhere else closes it. On the Feed page, that tap also selects the feeding date.
- Pet Details and the Feed page pass `resizable`. Size buttons sit on the panel's bottom border, centered on that edge, with a lighter fill and a soft shadow. One tap goes 2 weeks → full month. The month view has shrink (back to 2 weeks) and expand (current month plus the next). Two months has one shrink back to one month. The grid fades out for 140ms, switches, then fades in for 220ms. The buttons stay visible. Collapsing to 2 weeks opens the week of the selected day or today when that day is in the month on screen, otherwise that month's first week.

## Home, Pending, and navigation

- `#/` is All Pets: search and pet cards, no prepare list. `#/pending` is only the prepare list. They share one history entry (`src/utils/navHistory.ts`). Returning to either drops pages opened after it, so the phone Back button leaves the app.
- Prepare groups are feeder type only. Chip text includes the amount (`Name · 10g` or `Name · NPK 2g/L`). A chip opens All Pets, waits for that view to finish opening, scrolls to the pet, then pulses the card. Choosing the same chip again after returning to Pending plays that again.
- Saving a feeding returns to Pending. The All Pets search field blurs on Enter so the phone keyboard closes.
- The home top bar stays docked. After the page moves, it raises and a black-to-transparent fade (18px, 240ms) appears under it. At the top of the page that edge stays flush. Switching All Pets and Pending snaps the fade (`is-snap`) so it does not play on a list that is already at the top. Search stays in the docked bar on All Pets.
- The GitHub JSON panel stays hidden while the browser is connected. Menu order: JSON link, print, scan, New. Beside Menu are Pending (clock) and All Pets.
- Page changes fade: 160ms out, 300ms in. `waitForPageArrival` waits for the animation named `page-fade-in`.

## Pets, details, and history

- On a pet card, the cover, the name, the species line, and the morph line open Pet Details (`#/pet/{id}/details`). The pencil opens Edit. The status badge sits in the same tappable block, so it opens Pet Details too. Feed, or Change for a water-change pet, opens the feeding page.
- Pet Details shows the cover, identity, due badge, period, feeder summary, calendar (`resizable`), and History. Back returns to All Pets.
- Both History lists delete a record with a red ✕ (`history-remove`, "Delete this feeding") and a confirm dialog. The weight log still uses a text Remove control.
- Edit is `#/pet/{id}/edit`. `?from=home` returns to All Pets; otherwise it returns to that pet's feeding page. Creating a pet opens its edit page. Deleting a pet also deletes its feedings and, when GitHub is connected, its cover file.

## Pet form

`src/components/PetForm.tsx`. Species can be a preset or custom text. Sex is male, female, or unsexed. Feeder type is Mouse, Rat, Chicken, Water Change, or custom text.

The Amount field is optional free text, at most 40 characters, saved as `feederAmount`. Saving the form clears the old numeric `feederWeightGrams`. `feederAmountText` shows a plain number with `g`, or `L` when the feeder is Water Change. Any other text, such as `NPK 2g/L` or `10g`, is shown exactly as typed. Older pets that only have `feederWeightGrams` still show `{number}g` or `{number}L`. That text is what cards, summaries, and Pending chips display.

## Look

- One solid page background, `--bg: #778372`, in both themes. No page gradient. The manifest `background_color` is `#778372`.
- The title "Reptile Feed" is a gold gradient (`#f3e7c0` → `#ecc964` at 45% → `#cf8f2c`) with a firm drop shadow. The letter and glow animations run once, not in a loop.
- Cards use `--card`. Dark mode recolors cards, fields, and calendar cells; it does not change the page background.

## Where to change things

| Task | Look at |
| --- | --- |
| Routes, home, Pending, pet page, details, history | `src/App.tsx` |
| Back-button history for All Pets and Pending | `src/utils/navHistory.ts` |
| Add-feeding tags, Extend row | `src/components/FeedingForm.tsx` |
| Calendars and colour bands | `src/components/MiniCalendar.tsx`, `src/utils/schedule.ts` |
| Pending column layout | `src/utils/prepColumns.ts` |
| Labels, pets, events, feeder amount | `src/types.ts` |
| Pet create and edit | `src/components/PetForm.tsx` |
| Cover photo | `src/components/CoverPhoto.tsx`, `src/utils/coverPhoto.ts` |
| Weight log | `src/components/WeightTracker.tsx` |
| Layout and theme | `src/index.css` |
| GitHub JSON and photo upload | `src/github.ts`, `src/sync.ts` |
| IndexedDB | `src/db.ts` |

Dexie stays at version 1. Extra fields (`tags`, `coverAt`, `weighings`, `sex`, `feederAmount`) are stored without a schema bump. Bump the version only when adding an index.
