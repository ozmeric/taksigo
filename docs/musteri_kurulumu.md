# TaksiGo — Müşteri Kurulum Süreci (Faz 2)

Yeni bir taksi işletmesi müşterisi için mevcut adım adım kurulum süreci.
Şu anda elle yapılıyor; aynı zamanda ileride yazılacak otomasyon
(Faz 2 kurulum betiği) için de tam bir teknik şartname niteliğinde.

**Sahiplik ayrımı — süreç boyunca bunu akılda tutun:**
- Müşterinin **Google Sheet + Apps Script**'i → **kendi** Google
  hesabında kalır. Gerçek verilerinin bulunduğu yer burasıdır.
- **Cloudflare Worker + alt alan adı** → **Weblina'nın** kendi Cloudflare
  hesabında kalır. Müşterinin Cloudflare hesabı açmasına hiç gerek yoktur.

---

## Başlamadan önce müşteriden gerekenler

- [ ] Bir Google hesabı (Gmail) — çoğu kişinin zaten vardır. Müşterinin
      sağlaması gereken tek hesap budur.
- [ ] İşletme/marka adı (alt alan adı için, örn. `acme` →
      `acme.usebuildflow.io`)
- [ ] Kaç taksi ve yaklaşık kaç şoförle çalıştıkları — ilk kayıtları
      girerken ne bekleyeceğinizi bilmeniz için
- [ ] Her şoförün ücret düzeni: kazançtan yüzde mi alacak, yoksa vardiya
      başına sabit ücret mi (bu daha sonra her şoför için değiştirilebilir,
      ama baştan bilmek faydalı)

## Kurulum Adımları

### 1. Google Sheet (müşterinin hesabı)
- [ ] Müşteriden kendi hesabında boş bir Google Sheet oluşturup size
      **Düzenleyici** erişimi vermesini isteyin (veya ekran paylaşımıyla
      birlikte canlı yapın)
- [ ] Sheet'i açıkça adlandırın, örn. "[Şirket Adı] — TaksiGo Verisi"
- [ ] URL'deki Sheet ID'sini kopyalayın (`/d/` ile `/edit` arasındaki
      karakter dizisi)

### 2. Apps Script Backend (müşterinin hesabı)
- [ ] Aynı Sheet üzerinden: Uzantılar (Extensions) → Apps Script
- [ ] Güncel `apps-script.gs` dosyasının içeriğini yapıştırın
- [ ] `SHEET_ID` değerini 1. adımdaki ID ile değiştirin
- [ ] `ADMIN_PIN_DEFAULT` değerini, teslim edeceğiniz geçici bir PIN
      olarak ayarlayın (müşteri bunu daha sonra kendi Ayarlar
      ekranından değiştirir)
- [ ] Deploy (Dağıt) → New deployment (Yeni dağıtım) → Web app →
      Execute as (Şu olarak çalıştır) **Me (Ben)** → Access (Erişim)
      **Anyone (Herkes)** → Deploy
- [ ] Oluşan `/exec` URL'sini kopyalayın

### 3. Cloudflare Worker (Weblina'nın hesabı)
- [ ] Cloudflare panelinden: Workers & Pages → Create Worker
- [ ] Açıkça adlandırın, örn. `taksigo-[sirket-kodu]`
- [ ] `cloudflare-worker.js` içeriğini yapıştırın, `APPS_SCRIPT_URL`
      değerini 2. adımdaki `/exec` URL'si ile değiştirin
- [ ] Dağıtın, Worker'ın `https://....workers.dev/` adresini kopyalayın

### 4. DNS + Alt Alan Adı (Weblina'nın hesabı)
- [ ] Bir CNAME kaydı ekleyin: `[sirket-kodu]` → Worker (veya frontend
      Cloudflare Pages üzerinden sunuluyorsa o yönlendirmeyi yapın —
      bu adımı yapmadan önce hangi yöntemin güncel olduğunu doğrulayın)
- [ ] `[sirket-kodu].usebuildflow.io` adresinin çözümlendiğini doğrulayın

### 5. Frontend Dağıtımı (Weblina'nın GitHub'ı)
- [ ] Bu müşteri için yeni bir GitHub deposu açın (örn.
      `taksigo-[sirket-kodu]`) — **mevcut bir deponun içine klasör olarak
      eklemeyin** (GitHub Pages her depo için yalnızca bir özel alan adını
      destekler)
- [ ] `index.html`, `manifest.json`, `sw.js`, `icon-192.png`,
      `icon-512.png` dosyalarını ve içeriği
      `[sirket-kodu].usebuildflow.io` olan bir `CNAME` dosyasını gönderin
- [ ] `index.html` içinde `API_URL` değerini 3. adımdaki Worker adresi
      ile değiştirin
- [ ] Depo Ayarları → Pages → `main` dalından, kök dizinden dağıtın
- [ ] GitHub'ın DNS kontrolünün ve otomatik SSL sertifikasının
      tamamlanmasını bekleyin (birkaç dakikadan bir saate kadar sürebilir)

### 6. İlk Giriş ve Veri Kurulumu
- [ ] `[sirket-kodu].usebuildflow.io` adresini açın, 2. adımdaki geçici
      yönetici PIN'i ile giriş yapın
- [ ] Ayarlar'a gidin → yöneticinin kurtarma e-postasını ayarlayın, sonra
      PIN'i işletme sahibinin gerçekten hatırlayacağı bir şeyle değiştirin
- [ ] Her taksiyi ekleyin (+ Taksi Ekle)
- [ ] Her şoförü kendi taksisi altında ekleyin (+ Şoför Ekle) — telefon,
      ücret tipi (yüzde/sabit) ve değerini girin
- [ ] Her şoförün PIN'ini kendisiyle doğrudan paylaşın (eklerken ekranda
      gösterilir, ya da sonradan "PIN'i Yenile" ile tekrar alınabilir)

### 7. Müşteriye Teslim
- [ ] İşletme sahibine gösterin: uygulamayı ana ekrana nasıl ekleyeceğini
      (Chrome/Safari → Ana Ekrana Ekle)
- [ ] Gösterin: bir şoförün gözünden Vardiya Başlat → Sefer Ekle →
      Yakıt Ekle → Vardiyayı Bitir akışı
- [ ] Gösterin: Taksiler ekranı, tarih filtreleri, şoför detay sayfası,
      Ayarlar
- [ ] Şunları bırakın: alt alan adı adresleri, (kendisinin değiştirdiği)
      yönetici PIN'i, ve bu belgedeki şoför PIN listesi

---

## Gelecekteki Otomasyon İçin Notlar (Faz 2 Betiği)

1–5. adımların tamamı, Weblina'nın zaten erişimi olan API'ler üzerinden
otomatikleştirilebilir: Google Sheets API + Apps Script API (1–2. adımlar,
Sheet müşteriye ait olacağı için müşterinin OAuth ile yetki vermesi
gerekir), ve Cloudflare API (3–4. adımlar, tamamen Weblina'nın kendi
hesabında, müşteri etkileşimi gerekmez). 5. adım, GitHub API üzerinden
şablonlanabilir (bir şablon depodan yeni depo oluşturma, dosyaları
gönderme, Pages'i etkinleştirme) — elle yapmak yerine. 6. adım kısmen
otomatikleştirilebilir (uygulamanın kendisinin kullandığı aynı
`addTaxi`/`addDriver` API aksiyonlarıyla ilk taksi/şoför kayıtlarını
oluşturarak), bunun için de bir kurulum formunun müşterinin başlangıç
kadrosunu önceden toplaması gerekir.
