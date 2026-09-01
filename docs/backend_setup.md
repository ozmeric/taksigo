# TaksiGo — Backend Kurulum (Weblina İçin) / Backend Setup (For Weblina)

Bu belge, müşterinin Sheet'ini paylaştıktan sonra Weblina'nın backend'i
hızlıca kurması içindir. `clasp` (Google'ın resmi Apps Script komut satırı
aracı) kullanarak proje oluşturma ve kod yükleme adımları otomatikleştirilir.
**Tek bir adım otomatikleştirilemez:** ilk Web App dağıtımı, Google'ın
güvenlik nedeniyle zorunlu tuttuğu bir onay ekranı yüzünden tarayıcıda
elle yapılmalıdır. Aşağıda tam olarak nerede olduğunu göstereceğiz.

This doc is for Weblina's own efficient backend setup once a customer has
shared their Sheet. Uses `clasp` (Google's official Apps Script CLI) to
automate project creation and code upload. **One step can't be automated:**
the first Web App deployment must be done manually in the browser, because
Google requires a consent screen for security. We'll show exactly where.

---

## Bir Kerelik Kurulum / One-Time Setup

*(Sadece ilk müşteriden önce, bir kez yapılır.) / (Only once, before your first customer.)*

```bash
# 1. Node.js kurulu değilse kurun / Install Node.js if you don't have it
#    https://nodejs.org

# 2. clasp'ı yükleyin / Install clasp
npm install -g @google/clasp

# 3. Kendi Google hesabınızla giriş yapın / Log in with your own Google account
#    (müşterilerin Sheet paylaşacağı hesap — bu Weblina'nın hesabı)
#    (the account customers will share their Sheet with — this is Weblina's account)
clasp login
```

Ardından tarayıcıda şu adrese gidin ve **"Apps Script API"** ayarını
**AÇIK** konuma getirin (bir kerelik, hesap genelinde bir ayar):
Then in a browser, go here and turn the **"Apps Script API"** setting
**ON** (one-time, account-wide setting):

```
https://script.google.com/home/usersettings
```

---

## Her Yeni Müşteri İçin / For Each New Customer

### 1. Sheet ID'sini alın / Get the Sheet ID
Müşterinin gönderdiği linki açın. URL'de `/d/` ile `/edit` arasındaki
uzun karakter dizisi Sheet ID'sidir.
Open the link the customer sent. The long string between `/d/` and
`/edit` in the URL is the Sheet ID.

### 2. Yeni bir klasör açıp Apps Script projesini oluşturun / Create a new folder and the Apps Script project

```bash
mkdir taksigo-[musteri-adi] && cd taksigo-[musteri-adi]

clasp create --type sheets --title "TaksiGo - [Müşteri Adı]" --parentId "SHEET_ID_BURAYA"
```

Bu komut, müşterinin Sheet'ine bağlı YENİ bir Apps Script projesi
oluşturur ve bu klasörde `.clasp.json` + `appsscript.json` + `Code.js`
dosyalarını otomatik oluşturur.
This creates a NEW Apps Script project bound to the customer's Sheet, and
auto-generates `.clasp.json` + `appsscript.json` + `Code.js` in this folder.

### 3. Kodu yapıştırın / Paste in the code
`Code.js` dosyasını açın, içeriğini tamamen silin, güncel
`apps-script.gs` içeriğini yapıştırın. İçinde:
Open `Code.js`, delete everything in it, paste in the current
`apps-script.gs` content. In it:

- `SHEET_ID` değerini 1. adımdaki ID ile değiştirin
  Set `SHEET_ID` to the ID from step 1
- `ADMIN_PIN_DEFAULT` değerini geçici bir PIN yapın (müşteri sonra
  kendisi değiştirecek)
  Set `ADMIN_PIN_DEFAULT` to a temporary PIN (customer changes it later)

### 4. Kodu yükleyin / Push the code

```bash
clasp push
```

### 5. Tek manuel adım: Web App olarak dağıtın / The one manual step: deploy as Web App

```bash
clasp open
```

Bu, Apps Script düzenleyicisini tarayıcıda açar. Şurada:
This opens the Apps Script editor in your browser. There:

**Deploy → New deployment → (dişli ikonu/gear icon) → Web app →**
**Execute as: Me → Who has access: Anyone → Deploy**

Google ilk seferde izin isteyecektir — hesabınızla onaylayın.
Google will ask for permission the first time — approve it with your account.
Oluşan `/exec` URL'sini kopyalayın; bu, Cloudflare Worker'a bağlayacağınız
adrestir. Bu adımı bu müşteri için yalnızca BİR KEZ yapacaksınız — sonraki
kod güncellemeleri için 7. bölüme (Sonraki Güncellemeler) bakın, orada
komut satırından yapabilirsiniz.
Copy the resulting `/exec` URL — this is what you'll wire into the
Cloudflare Worker. You'll only do this manual step ONCE per customer —
see the "Future Updates" section below for updating code via command
line afterward.

### 6. Devam / Continue
`CUSTOMER-ONBOARDING.md` dosyasındaki 3-7. adımlarla devam edin
(Cloudflare Worker, DNS, GitHub repo, ilk giriş, teslim).
Continue with steps 3–7 in `CUSTOMER-ONBOARDING.md` (Cloudflare Worker,
DNS, GitHub repo, first login, handoff).

---

## Sonraki Güncellemeler İçin / For Future Updates to This Customer

`apps-script.gs` içinde bir düzeltme yaptığınızda, o müşterinin klasörüne
gidin, kodu güncelleyin, ve şu İKİ komutu çalıştırın:
When you fix something in `apps-script.gs`, go to that customer's folder,
update the code, and run these TWO commands:

```bash
cd taksigo-[musteri-adi]
clasp push
```

**Önemli:** `clasp push` sadece kodu yükler — canlı Web App'in gerçekte
çalıştırdığı sürümü GÜNCELLEMEZ. Var olan dağıtımı (aynı `/exec` URL'sini
koruyarak) güncellemek için dağıtım ID'sini kullanmanız gerekir:
**Important:** `clasp push` only uploads the code — it does NOT update
what the live Web App is actually running. To update the existing
deployment (keeping the same `/exec` URL), you need its deployment ID:

```bash
# Bir kereliğine, dağıtım ID'sini not edin / One time, note the deployment ID:
clasp deployments

# Her güncellemede bu komutu çalıştırın / Run this on every update:
clasp deploy --deploymentId "DAGITIM_ID_BURAYA" --description "Güncelleme"
```

(Kullandığınız clasp sürümüne göre bu komut `clasp create-deployment
--deploymentId ...` olarak da adlandırılabilir — `clasp help` ile kontrol
edin.)
(Depending on your clasp version, this command may instead be named
`clasp create-deployment --deploymentId ...` — check with `clasp help`.)

Bu şekilde `/exec` URL'si hiç değişmez — Cloudflare Worker'da hiçbir şeyi
güncellemenize gerek kalmaz.
This way the `/exec` URL never changes — nothing to update in the
Cloudflare Worker.
