# TaksiGo — Customer Onboarding (Phase 2)

This is the current step-by-step process for bringing on a new taxi company
customer. It's manual today; it's also the exact spec that a future
provisioning script (Phase 2 automation) needs to replicate.

**Ownership split — keep this in mind throughout:**
- The customer's **Google Sheet + Apps Script** → lives under **their own**
  Google account. This is where their real data lives.
- The **Cloudflare Worker + subdomain** → lives under **Weblina's** own
  Cloudflare account. The customer never needs a Cloudflare account.

---

## What the customer needs before you start

- [ ] A Google account (Gmail) — most people already have one. This is the
      only account *they* need to provide.
- [ ] Their business/brand name (for the subdomain slug, e.g. `acme` →
      `acme.usebuildflow.io`)
- [ ] How many taxis and roughly how many drivers, so you know what to expect
      when setting up the first records
- [ ] Each driver's pay setup: percentage of earnings, or flat fee per
      vardiya (this can be changed later per driver, just useful to know
      up front)

## Setup steps

### 1. Google Sheet (customer's account)
- [ ] Ask the customer to create a blank Google Sheet in their own account
      and share **Editor** access with you (or do it live on a screen-share)
- [ ] Rename it clearly, e.g. "[Company Name] — TaksiGo Data"
- [ ] Copy the Sheet ID from its URL (the string between `/d/` and `/edit`)

### 2. Apps Script backend (customer's account)
- [ ] From that same Sheet: Extensions → Apps Script
- [ ] Paste in the current `apps-script.gs`
- [ ] Set `SHEET_ID` to the ID from step 1
- [ ] Set `ADMIN_PIN_DEFAULT` to a temporary PIN you'll hand off (customer
      changes it themselves later in Ayarlar)
- [ ] Deploy → New deployment → Web app → Execute as **Me** → Access
      **Anyone** → Deploy
- [ ] Copy the resulting `/exec` URL

### 3. Cloudflare Worker (Weblina's account)
- [ ] Cloudflare dashboard → Workers & Pages → Create Worker
- [ ] Name it clearly, e.g. `taksigo-[company-slug]`
- [ ] Paste in `cloudflare-worker.js`, set `APPS_SCRIPT_URL` to the `/exec`
      URL from step 2
- [ ] Deploy, copy the Worker's `https://....workers.dev/` URL

### 4. DNS + subdomain (Weblina's account)
- [ ] Add a CNAME: `[company-slug]` → the Worker (or route via Cloudflare
      Pages if serving the frontend from Pages — confirm which pattern is
      current before doing this step)
- [ ] Confirm `[company-slug].usebuildflow.io` resolves

### 5. Frontend deployment (Weblina's GitHub)
- [ ] New GitHub repo for this customer (e.g. `taksigo-[company-slug]`) —
      **not** a folder inside an existing repo (GitHub Pages only supports
      one custom domain per repo)
- [ ] Push `index.html`, `manifest.json`, `sw.js`, `icon-192.png`,
      `icon-512.png`, and a `CNAME` file containing
      `[company-slug].usebuildflow.io`
- [ ] In `index.html`, set `API_URL` to the Worker URL from step 3
- [ ] Repo Settings → Pages → deploy from `main`, root
- [ ] Wait for GitHub's DNS check + automatic SSL to clear (a few minutes to
      an hour)

### 6. First login & data setup
- [ ] Open `[company-slug].usebuildflow.io`, log in with the temporary admin
      PIN from step 2
- [ ] Go to Ayarlar → set the admin's recovery email, then change the PIN to
      something the owner will actually remember
- [ ] Add each taxi (+ Taksi Ekle)
- [ ] Add each driver under their taxi (+ Şoför Ekle) — set phone, pay type
      (percentage/flat), and value
- [ ] Share each driver's PIN with them directly (shown when added, or via
      "PIN'i Yenile" later if needed)

### 7. Handoff to the customer
- [ ] Show the owner: how to install the app to their home screen (Chrome/
      Safari → Add to Home Screen)
- [ ] Show them: Vardiya Başlat → Sefer Ekle → Yakıt Ekle → Vardiyayı Bitir
      flow, from a driver's perspective
- [ ] Show them: Taksiler screen, date filters, driver detail, Ayarlar
- [ ] Leave them with: their subdomain URL, admin PIN (which they've now
      changed), and this doc's driver PIN list

---

## Notes for future automation (Phase 2 script)

Everything in steps 1–5 is scriptable via APIs Weblina already has access
to: Google Sheets API + Apps Script API (steps 1–2, requires the customer's
authorization via OAuth since the Sheet must be *theirs*), and the
Cloudflare API (steps 3–4, fully under Weblina's own account, no customer
interaction needed). Step 5 could be templated via the GitHub API (create
repo from a template repo, push files, enable Pages) rather than done by
hand each time. Step 6 could be partially scripted (creating initial taxi/
driver records via the same `addTaxi`/`addDriver` API actions the app
itself uses) once an onboarding form collects the customer's initial roster
up front.
