# Reptile Feed

A local, browser-only feeding tracker for reptiles and frogs. No web server database is required: pets and feeding history are stored in **IndexedDB** in the browser.

## Run locally

```bash
npm install
npm run dev
```

Open the URL Vite prints (usually `http://localhost:5173`). On a phone on the same network, use the LAN address Vite lists.

To serve the production build as static files:

```bash
npm run build
```

Copy the whole `dist` folder to OneDrive (or any cloud drive). Open `index.html` from the synced folder in a browser — on this PC, phone, or another machine after OneDrive finishes syncing.

Because JS and CSS are inlined into `index.html`, you do not need a web server. OneDrive’s in-browser preview often will **not** run the app; use a real browser (Chrome, Edge, Safari) on the file.

## GitHub Pages (open on iPhone)

The OneDrive folder will not run in Safari. Host the `dist` files on GitHub Pages instead.

**Anyone with the URL can open the site.** Pet names are inside `index.html` and `feeding-data.json`. Use a **public** repo for free Pages, or a private repo if your GitHub plan allows private Pages.

1. Sign in at [github.com](https://github.com/new) and create a new repository (for example `feeding-app`). You can skip adding a README.
2. On the empty repo page, choose **uploading an existing file**.
3. Open `C:\Users\truon\repos\Feeding App\dist` and drop in **all four files**:
   - `index.html`
   - `feeding-data.json`
   - `favicon.svg`
   - `icons.svg`
4. Click **Commit changes**.
5. Open **Settings → Pages**.
6. Under **Build and deployment**:
   - Source: **Deploy from a branch**
   - Branch: **main** (or `master`), folder **`/ (root)`**
   - Save
7. Wait about a minute, then open  
   `https://YOUR_USERNAME.github.io/feeding-app/`  
   (use your GitHub username and repo name).
8. On the iPhone, open that `https://` link in **Safari**. Share → **Add to Home Screen** if you want an icon.

## Shared database (GitHub)

Safari cannot lock a OneDrive file. Phone and PC should both **Connect GitHub** so they read and write the same `feeding-data.json` in this repo.

1. Open [Fine-grained personal access tokens](https://github.com/settings/personal-access-tokens/new).
2. Name it `Reptile Feed`, set an expiry you are willing to renew.
3. Repository access: **Only select repositories** → your Pages repo.
4. Permissions → **Contents**: **Read and write**.
5. Generate the token and copy it.
6. In the app (iPhone and PC), fill **owner** (GitHub username), **repo**, and the token, then tap **Connect GitHub**.

The token is stored only in that browser. If it leaks, revoke it on GitHub and paste a new one. Export JSON now and then as a backup.

Chrome on a PC can still **Open local JSON** / **Save local JSON** for a file on disk. That copy is separate from GitHub unless you connect GitHub in that browser too.

You can still preview locally with `npm run preview` (paste the same token to sync against the repo).

## Features

- Create pets with name, species, multiple morph tags, and a feeding period in days
- Morph lists for Ball Python, King Snake, Milk Snake, Corn Snake, Hognose Snake, Reticulated Python, Burmese Python, Pacman Frog, and Bull Frog
- Record feedings (date defaults to today) with a note
- Next feeding date = last successful feed + that pet’s period
- Extend the next due date if the animal refuses or regurgitates
- Per-pet calendars with a green → red cycle from the last fed date toward the next due date, colored only through today
