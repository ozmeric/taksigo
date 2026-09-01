# TaksiGo — How It Works

TaksiGo is a taxi fleet management PWA for a single taxi owner running one or
more vehicles with multiple drivers. Built on the BuildFlow stack (Weblina LLC).

## Architecture

```
Driver / Admin phone (PWA)
        │  HTTPS POST (PIN + action)
        ▼
Cloudflare Worker  (Weblina's Cloudflare account — stateless proxy, stores nothing)
        │  forwards request as-is
        ▼
Google Apps Script  (customer's own Google account — the actual backend)
        │  reads/writes
        ▼
Google Sheet  (customer's own Google account — the actual database)
```

**Why split this way:** the customer's own Google account holds 100% of their
real data (driver names, phone numbers, earnings, fuel spend). The Cloudflare
Worker is a stateless pass-through under Weblina's account that only exists to
hide the raw Apps Script URL — it never stores or logs any customer data. This
means Weblina never becomes a data holder for customer information, which
matters both for trust and for KVKK (Turkish data protection law) exposure.

## Frontend

**Code/config split:** `app.js` contains all the actual React/logic code and
is **identical across every customer** — it's hosted once at a stable shared
URL and loaded by every customer's `index.html`. Each customer's repo only
contains a tiny `config.js` (currently just their `apiUrl` — their Worker
URL) plus the unchanging shell files (`index.html`, `manifest.json`, `sw.js`,
icons, `CNAME`). Updating the app for every customer at once means editing
and re-hosting `app.js` in one place — no per-customer repo pushes needed
for logic changes.

`app.js` and `config.js` are loaded with a version query string
(`app.js?v=1`) and cached **cache-first** by the service worker for instant
loads. To push an update to every customer, bump the `?v=` number in
`index.html` — the new URL is a cache miss, so it's fetched fresh and cached
under its own key; the old version simply stops being referenced. (An
earlier version of this made app.js/config.js network-first instead, which
guaranteed freshness but added a network round-trip to every single load —
the version-string approach gets both instant loading and controlled
updates.)

Styled black/yellow (taxi colors). Installable as a home-screen PWA via
`manifest.json` + `sw.js` (the rest of the app shell is cached for offline
use; API calls always go to network, never cached).

## Roles & Authentication

- **PIN-based, no passwords, no usernames.** One PIN per driver, one PIN for
  the admin/owner.
- The backend resolves *role* purely from which PIN was entered — same login
  screen concept, but the UI defaults to a large "driver" login and a smaller
  "admin" login is one tap away (`Yönetici misiniz? →`).
- Login persists across page refreshes via `localStorage` (the PIN itself is
  stored client-side — acceptable for this low-stakes internal tool, not
  bank-grade, but fine for a small operator's own devices).
- **Admin PIN recovery:** admin can set a recovery email in Ayarlar
  (Settings). If locked out, "PIN'imi unuttum" on the login screen emails a
  fresh PIN via `MailApp` (Google's own email sending) — sent from the
  customer's own Google account, so it works even if Weblina isn't involved.
  If email isn't configured, the admin PIN can also be reset directly by
  editing `ADMIN_PIN` in the Apps Script project's Script Properties (no
  redeploy needed).
- **Driver PIN recovery:** the admin can view and one-tap regenerate any
  driver's PIN from that driver's detail screen.

## Data model (Google Sheet tabs)

- **Taxis** — vehicles the owner runs. Each is a card in the admin console;
  an owner can have more than one.
- **Drivers** — belong to a taxi. Each has a PIN, phone, start/end date,
  admin notes, driver notes, and a pay setup (`salaryType`: percentage or
  flat, `salaryValue`).
- **Shifts** — a "vardiya." Has a lifecycle: **open** (driver started it,
  logging rides/fuel live) → **closed** (driver or admin ended it with a
  final odometer reading). Stores rides and fuel purchases as embedded JSON
  arrays, each stamped with Istanbul-time timestamps generated server-side
  (never trusts the phone's own clock/timezone).
- **Expenses** — vehicle-level costs (maintenance, insurance, etc.), separate
  from per-shift fuel purchases.
- **Vendors** — mechanics, insurance brokers, etc.

All sheets **self-heal their headers**: if a schema field was added after a
customer's sheet was already created, the backend detects the missing column
on next use and appends it automatically with a sensible default — no manual
sheet editing needed when the app is updated.

## Core workflow (driver side)

1. **Vardiya Başlat** — enter starting km. Creates an "open" shift.
2. While active: **+ Sefer Ekle** (log each ride's fare — they sum live into
   the shift's running total) and **⛽ Yakıt Ekle** (log fuel purchases with
   km, ₺, and liters, any time during the shift).
3. **Vardiyayı Bitir** — enter ending km and notes. Closes the shift.
4. Driver sees their own estimated payout (per their pay setup) live during
   the shift and finalized once it's closed, plus a collapsible history of
   past vardiyas.

## Core workflow (admin side)

- **Taksiler** — taxi cards (add/edit/delete), each expandable to show its
  drivers, with date-range filtering (Bugün/Bu Hafta/Bu Ay/Tümü or custom
  range) applied to all totals. Each taxi shows total earnings, km, ₺/km,
  and a fuel purchase log (who bought fuel, how much, at what km) regardless
  of which driver was driving.
- **Driver detail** — full stats, PIN view/reset, pay setup, admin notes,
  ability to force-close or delete a stray open vardiya, and collapsible
  shift history with per-shift payout.
- **Giderler** (Expenses) / **Tedarikçiler** (Vendors) — standard tracking.
- **Ayarlar** (Settings) — change admin PIN, set recovery email.

## Performance

Login (and any full reload) makes **one** backend call — a `bootstrap`
action that bundles role + taxis + drivers + shifts into a single Apps
Script execution — instead of four separate calls. Apps Script pays fixed
overhead per request (opening the spreadsheet, cold start) regardless of
how much work happens inside, so bundling cuts that overhead roughly in
half compared to calling `whoAmI`, `getTaxis`, `getDrivers`, and `getShifts`
separately. Everyday actions (adding a ride, a fuel entry, starting/ending
a shift) use a lighter `getShifts`-only refresh rather than re-running
`bootstrap`, since taxis/drivers rarely change turn-to-turn.

## Known limitations

- **No background GPS.** As a PWA, location tracking only works while the
  app is open on screen — phones locking or backgrounding stops it. This is
  an OS-level restriction on all web apps, not something fixable in code.
  Solving this requires wrapping the app natively (see roadmap).
- **Apps Script has real per-request latency** (spreadsheet open + row scan
  on every call) and hard quotas (~20,000 calls/day, 6-minute execution
  limit) per Google account. Fine for one customer's usage; would become a
  bottleneck if many customers ever shared one backend (they don't — each
  customer has their own Google account and quota).
- **Single shared admin PIN** — no multi-admin support yet (e.g. owner +
  manager each with their own login).
