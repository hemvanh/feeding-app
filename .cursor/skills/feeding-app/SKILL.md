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

Stay on `dev` unless publishing. The short branch rule in `.cursor/rules/branch-roles.mdc` always applies. This skill is the working manual. If they disagree about which files to copy or about `feeding-data.json`, follow that rule.

## Hard rules

- `dev` is the Vite source. `main` is only the built Pages site. Never merge `dev` into `main`. Never put `src/`, `package.json`, `dist/`, or `node_modules/` on `main`.
- Do not overwrite live `feeding-data.json` or `pet-photos/` unless the user explicitly asks. A production build copies a seed JSON into `dist/`; that seed is not the live database.
- Do not commit unless the user asks, or they say **publish all** or **deploy all** (same procedure).
- Do not run `git config`. This machine has no commit identity. For every commit, set only the process environment: `GIT_AUTHOR_NAME` and `GIT_COMMITTER_NAME` = `hemvanh`, `GIT_AUTHOR_EMAIL` and `GIT_COMMITTER_EMAIL` = `hemvanh@users.noreply.github.com`.
- Shell is PowerShell. Do not use `&&` or bash heredocs. Commit with a PowerShell here-string: `git commit -m @" ... "@`.
- Never force-push. If `git push origin main` is rejected, `git pull --rebase origin main`, then push again.
- The GitHub token lives only in the browser (`localStorage`). Never ask the user to paste it into chat, and never write it into the repo.
- After UI, layout, or client-state changes, verify the affected flow in the browser at `http://localhost:5173` before finishing. Do not save a real feeding or pet edit during that check; a connected browser will push it to GitHub.

## Publish all / deploy all

Do this in order without asking again. Skip an empty `dev` commit when the tree is clean; still build and update `main` if the live site needs that build.

1. On `dev`, stage only the relevant source changes, commit, and `git push origin dev`.
2. On `dev`, run `npm run build`.
3. `git checkout main`, then `git pull --rebase origin main` so newer data commits are included first.
4. Copy these files from `dist/` onto the `main` working tree root: `index.html`, `favicon.svg`, `icons.svg`, `manifest.json`, `sw.js`, `pwa-icon-192.png`, `pwa-icon-512.png`, `apple-touch-icon.png`, `pwa-icon.svg`. Do not copy `feeding-data.json`. Do not `git add` `dist/` or `node_modules/`.
5. Commit the copied site files. `main` messages start with `Publish`. `dev` messages are normal sentences about why.
6. `git push origin main`.
7. `git checkout dev` and leave that branch checked out.

`main` often moves while you build because the app commits `Update feeding data` from a phone or PC. Rebase onto that, then push. Do not force-push.

## What not to break

- `base` is `./`. The site is not at the domain root. New asset URLs in the manifest, service worker, and HTML stay relative.
- The service worker registers only when `import.meta.env.PROD`. Check it with `npm run preview` (port 4173), not the dev server.
- Dexie is version 1 with stores `pets` and `feedings`. Extra fields (`tags`, `coverAt`, `weighings`, `sex`) are stored without a schema bump. Bump the version only when adding an index.
- A feeding still has one `outcome` for the schedule. `fed` and `water-changed` succeed and update "last ate". For every record, the next due date is the record's date plus `extensionDays` when Extend was checked, otherwise the record's date plus the pet's `feedingPeriodDays`. The extension replaces the cycle; it is not added to it or to the old due date. On the calendar every record ends the current colour band and starts a new one from its date to its due date; only `fed` and `water-changed` bands mark their first day as Fed. Every record day gets a corner icon (Ate check, W. Changed drop, Refused ✕, Regurg. arrow, Molt/Shed dot, extension clock); tapping that day opens a bubble with each record's tags (or legacy note), and tapping elsewhere closes it. Pet Details and Feed calendars (`resizable`) have bottom-right size buttons: 2 weeks → full month → 2 months (current and next month); collapsing steps back one size, and the month view can jump straight to 2 weeks. Home cards stay at 2 weeks. Tag priority when several results are selected: regurgitated, then refused, then water-changed, then fed. `Molt/Shed` is a standard tag but not a result: with no other result it saves as `extended`. The Add Feeding form has an Extend row (checkbox, extra days, notes); Refused, Regurg., and Molt/Shed check it automatically with 1, 2, and 3 days, and unchecking the last of them clears it. Tag order: Ate, W. Changed, Refused, Regurg., Molt/Shed. Selected tags are green, or red while Extend is checked. The notes go into `note`. At least one tag or a checked Extend is required; a feeding with only custom tags and no Extend is saved as `fed`, so it starts the next cycle. Typing a custom tag and leaving the field adds it, same as Enter. Custom tags are removable; standard tags only toggle.
- Prepare groups are feeder type only. Chip text still includes the amount (`Name · 5g` or `250L`). Water Change amounts use liters. On Pending, group columns are sized from the tags: a tag stays on one line when the row has room, and a group that cannot sit beside another group takes the full row. `#/` is All Pets (search and pet cards, no prepare list). `#/pending` is only the prepare list. A prepare chip opens All Pets, and only after that view has finished opening does it scroll to the pet and then pulse the card. Choosing that same chip again after returning to Pending plays the sequence again. Saving a feeding or an extension returns to Pending. All Pets and Pending share one history entry. Returning to either view drops every page opened after it, so the phone Back button leaves the app instead of opening an earlier feeding or list. The All Pets search field blurs on Enter so the phone keyboard closes.
- The home top bar stays docked while the page scrolls. Once the page moves, that bar raises with a soft lower edge so cards fade under it instead of being cut off; at the top of the page the edge stays flush. On All Pets the search field stays in that docked bar. The GitHub JSON panel stays hidden when the browser is connected. Home tools live in the Menu button, in this order: JSON link, print, scan, New. Beside Menu are the Pending (clock) and All Pets buttons.
- Pet page opens at scroll 0. A static `Feed !` label sits on the header row, right side, same line as Back. There is no separate Extend form; extending is the Extend row in the Add Feeding form.

## Where to change things

| Task | Look at |
| --- | --- |
| Dashboard, prepare bar, pet page, history | `src/App.tsx` |
| Add-feeding tags and date line | `src/components/FeedingForm.tsx` |
| Calendars | `src/components/MiniCalendar.tsx`, `src/utils/schedule.ts` |
| Labels, pets, events | `src/types.ts` |
| Layout | `src/index.css` |
| GitHub JSON and photo upload | `src/github.ts`, `src/sync.ts`, `src/utils/coverPhoto.ts` |
| IndexedDB | `src/db.ts` |

Data shape, sync, and Pages hosting are in [reference.md](reference.md).
