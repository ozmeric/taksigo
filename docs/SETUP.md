# TaksiGo — Kurulum Rehberi (Setup Guide)

A generic, done-for-you taxi fleet management PWA. One vehicle (or several), multiple
drivers rotating shifts, admin sees everything, each driver only sees their own data.

## What's in this package
- `index.html` — the app itself (React, no build step)
- `apps-script.gs` — backend (deploy to Google Apps Script)
- `manifest.json`, `sw.js`, `icon-192.png`, `icon-512.png` — PWA install assets
- `cloudflare-worker.js` — API proxy (hides your Apps Script URL)
- `CNAME` — GitHub Pages custom domain file, pre-set to `taksigo.usebuildflow.io`

## 1. Google Sheet + Apps Script
1. Create a new Google Sheet. Copy its ID from the URL (the long string between `/d/` and `/edit`).
2. Go to [script.google.com](https://script.google.com) → New Project.
3. Paste in the contents of `apps-script.gs`.
4. Set `SHEET_ID` at the top to your Sheet's ID.
5. Set `ADMIN_PIN` to whatever PIN the owner should use to log in (default `2025` — change this).
6. Deploy → New deployment → type **Web app** → Execute as **Me** → Access **Anyone**.
7. Copy the deployment URL (ends in `/exec`).

The script auto-creates all needed tabs (`Taxis`, `Drivers`, `Shifts`, `Expenses`, `Vendors`)
the first time each is used — no manual sheet setup needed.

## 2. Cloudflare Worker (API proxy)
1. In the Cloudflare dashboard → Workers → Create Worker.
2. Paste in `cloudflare-worker.js`.
3. Replace `APPS_SCRIPT_URL` with the `/exec` URL from step 1.7.
4. Deploy. Copy the worker URL (`https://your-worker.workers.dev/`).

## 3. Point the app at your Worker
In `index.html`, find:
```javascript
const API_URL = "https://your-worker.workers.dev/";
```
Replace with your actual Worker URL.

## 4. Deploy the app (GitHub Pages, repo per client)

1. Create a **new, separate repo** (e.g. `taksigo-app`) — do NOT put this inside your
   `usebuildflow` repo. GitHub Pages only supports one custom domain per repo, so each
   client app needs its own repo to get its own subdomain.
2. Push all files in this package to the **root** of that repo (not a subfolder):
   `index.html`, `manifest.json`, `sw.js`, `icon-192.png`, `icon-512.png`, `CNAME`.
   - The `CNAME` file already contains `taksigo.usebuildflow.io` — change it if you want
     a different subdomain.
3. Repo → Settings → Pages → Source: deploy from `main` branch, root folder.
4. In your DNS provider for `usebuildflow.io`, add a CNAME record:
   `taksigo` → `[your-github-username].github.io`
5. Wait a few minutes for DNS + GitHub's automatic SSL certificate to provision.
   It'll be live at `https://taksigo.usebuildflow.io`.

Keep your original `usebuildflow` repo for the root domain (a BuildFlow landing/marketing
page) — every client app gets its own repo like this one going forward.

## 5. First login
- Owner logs in with `ADMIN_PIN` → sees the **Taksiler** (Taxis) screen.
- Tap **+ Taksi Ekle** to add a vehicle.
- Open the vehicle → **+ Şoför Ekle** to add a driver. Each driver gets an
  auto-generated 4-digit PIN (editable) — share that PIN with the driver so they
  can log into their own dashboard.
- Drivers log in with their own PIN and only see their own shift log, stats, and notes.

## How the numbers work
- Each shift: driver enters **Km Başlangıç / Km Bitiş** (start/end odometer),
  **Kazanç** (earnings, ₺), and fuel **Maliyet** (₺) + **Litre**.
- The app computes: km driven, ₺ earned per km, and km driven per liter (fuel efficiency)
  — both per shift and aggregated per driver/vehicle on the admin dashboard.
- All currency is ₺ (Turkish Lira), all distance is km — no unit conversion needed.

## Installing on a phone (home-screen app)
Once deployed, open the app URL in Chrome (Android) or Safari (iOS) and use
"Add to Home Screen" — it installs like a native app, works offline for the shell,
and syncs data whenever there's a connection.
