# TriTrack - Triatlon ve Koşu Takip Uygulaması 🏃🚴🏊🏋️

TriTrack, triatletler ve koşucular için özel olarak tasarlanmış, minimalist, mobil öncelikli ve çevrimdışı çalışabilen (PWA) bir antrenman ve diyet takip uygulamasıdır.

Uygulama herhangi bir sunucuya ihtiyaç duymadan tamamen tarayıcıda çalışır. Tüm antrenman, diyet, uyku, HRV ve uyku puanı verileri tarayıcınızın yerel hafızasında (`localStorage`) güvenli bir şekilde saklanır.

---

## ✨ Özellikler

*   **🏠 Bugün (Dashboard):** Tarih gezinmeli günlük panel — vücut durumu (uyku, **uyku puanı**, HRV, kilo), günün antrenman ve diyet planları, yapılan antrenmanlar, kalori/makro özeti, "Yarın ne yiyeceğim?" önizlemesi.
*   **🗓️ Program:** Haftalık antrenman programı + **antrenörden gelen planı toplu içe aktarma** (metin yapıştır → akıllı ayrıştır → canlı önizleme → ekle).
*   **🍉 Diyet:** Günlük takip **ve haftalık plan** modu. Open Food Facts API + çevrimdışı yerel besin listesi. Porsiyon/tabak/kase/bardak/avuç birimleri.
*   **🏋️ Antrenman Kaydı:** Koşu / Bisiklet / Yüzme / Güç formları (pace, güç, kadans, nabız, RPE). Kayıtları **düzenleme/silme** ve **Strava canlı senkronu** (Cloudflare Worker proxy ile otomatik içe aktarma).
*   **📊 Analiz:** Saf SVG grafikler — haftalık yük, branş dağılımı, uyku & HRV trendi, "tek bakışta" özet kartları + yorumlar.
*   **🤖 AI Koç:** Gemini (`gemini-2.5-flash`) bulut modu veya çevrimdışı yerel mod. Hazır-olma (readiness) hesabı, veri-farkında sohbet.
*   **🚀 Onboarding:** İlk açılışta kurulum sihirbazı; kalori + makro hedeflerini Mifflin-St Jeor ile otomatik hesaplar.
*   **💾 Veri Güvenliği:** JSON dışa/içe aktarma (yedekleme), şema doğrulama, tüm verileri sıfırlama.
*   **📱 PWA:** Çevrimdışı çalışır, telefona kurulabilir, Play Store'a paketlenebilir.

---

## 📂 Dosya Yapısı

Kök dizinde yalnızca **canlı uygulama** dosyaları durur; kod `js/` ES modüllerine, dokümanlar `docs/`'a,
görseller `assets/`'e ayrılmıştır.

```
TriTrack/
├── index.html            # Mobil öncelikli arayüz: 5 alt sekme + Profil, modallar, onboarding sihirbazı
├── styles.css            # Açık/Karanlık tema, grafik (.chart-*/.glance-*), onboarding & toplu plan stilleri
├── sw.js                 # Service Worker (çevrimdışı önbellek; HTML için ağ-öncelikli; sürüm = CACHE_NAME)
├── manifest.json         # PWA manifestosu (telefona kurulum / Play Store)
├── supabase.min.js       # 3. taraf Supabase istemcisi (klasik script, modüllerden önce yüklenir)
├── README.md             # Bu dosya
│
├── js/                   # ⚙️ Uygulama kodu — ES modülleri (giriş: js/main.js, type="module")
│   ├── main.js           #   navigasyon + DOMContentLoaded bootstrap (GİRİŞ NOKTASI)
│   ├── state.js          #   merkezi state, loadState/saveState, kimlik/tarih yardımcıları, setter'lar
│   ├── cloud.js          #   Supabase auth + bulut senkron
│   ├── theme.js          #   açık/koyu tema
│   ├── today.js          #   "Bugün" paneli (vücut durumu, su, diyet özeti, plan listeleri)
│   ├── program.js        #   haftalık program + aylık takvim + toplu plan içe aktarma
│   ├── diet.js           #   günlük diyet takibi + haftalık diyet planı + besin arama
│   ├── workout.js        #   antrenman kayıt formları (koşu/bisiklet/yüzme/güç)
│   ├── profile.js        #   profil/ayarlar (3 alt sayfa) + AI ayar bağlama
│   ├── ai.js             #   AI Koç (çok sağlayıcı LLM + function-calling araçları + raporlar)
│   ├── analysis.js       #   Analiz sekmesi (saf SVG grafikler, TSS/CTL/ATL, zone'lar, PR)
│   ├── data.js           #   JSON yedekleme / geri yükleme / sıfırlama
│   ├── importgpx.js      #   GPX/TCX ayrıştırma yardımcıları (canlı Strava senkronu kullanır)
│   ├── strava.js         #   Strava canlı senkron (Cloudflare Worker proxy)
│   ├── onboarding.js     #   ilk açılış kurulum sihirbazı (Mifflin-St Jeor hedefleri)
│   ├── utils.js          #   ortak yardımcılar (toast, onay modalı, SW kaydı, escape)
│   └── foods.js          #   çevrimdışı popüler sporcu gıdası listesi (LOCAL_FOODS)
│
├── assets/               # 🖼️ İkonlar + ekran görüntüleri (icon-*.png, screenshot-*.png)
├── docs/                 # 📑 Tüm dokümantasyon (aşağıya bak)
├── db/                   # Supabase şeması (schema.sql)
├── strava-proxy/         # Cloudflare Worker (Strava OAuth proxy: worker.js + wrangler.toml)
└── Starava veri/         # ⚠️ Kişisel Strava arşivi — .gitignore'lu, ASLA commit edilmez
```

### 📑 docs/
*   `GELISTIRME-GUNLUGU.md` — Adım adım geliştirme günlüğü (ne, neden, hangi fonksiyon/sürüm).
*   `GELISTIRME-TALEPLERI.md` — Talep edilen UX/mimari değişiklikler.
*   `CALISMA-DUZENI.md` — Git dal yapısı, commit kuralları, çoklu yapay zeka / sub-agent düzeni.
*   `STRAVA-KURULUM.md` · `SUPABASE-KURULUM.md` — Kurulum rehberleri.
*   `AI-VERI-ERISIMI.md` — AI'ın eriştiği veri kapsamı.
*   `ux_report.md` · `ux_bug_report.md` — UX analizi ve düzeltme durumu.
*   `TriTrack APK Oluşturma ve Telefona Yükleme Planı.md` — APK/TWA paketleme notları.

> **Sürüm kuralı:** Dosya değişince `index.html` içindeki `?v=1.X` ve `sw.js` içindeki `CACHE_NAME='tritrack-vX'`
> elle (+ `docs/GELISTIRME-GUNLUGU.md` başlığı) artırılır — eski önbellek sorunu olmasın. **Güncel: `v1.43`.**

---

## 🚀 Yerel Olarak Çalıştırma

Tarayıcı güvenlik protokolleri nedeniyle, **PWA (Telefona Yükleme)** ve **Service Worker** özellikleri sadece güvenli bağlantılarda (`https://`) veya yerel sunucularda (`http://localhost`) çalışmaktadır.

Uygulamayı bilgisayarınızda yerel bir sunucu ile çalıştırmak için aşağıdaki yöntemlerden birini kullanabilirsiniz:

### Yöntem 1: Python / Py Launcher (Windows İçin En Güvenli Yol)
Terminalinizi (PowerShell / CMD) açıp proje klasörüne gidin ve şu komutu çalıştırın:
```bash
py -m http.server 8000
```
*(Eğer `py` çalışmazsa `python -m http.server 8000` komutunu deneyebilirsiniz).* 
Tarayıcınızdan **`http://localhost:8000`** adresine girin.

### Yöntem 2: VS Code Live Server
1. Proje klasörünü VS Code ile açın.
2. Sağ alt köşedeki **"Go Live"** butonuna basın veya eklenti listesinden **Live Server** kurup başlatın.
3. Uygulama otomatik olarak `http://127.0.0.1:5500` veya benzeri bir portta açılacaktır.

### Yöntem 3: NodeJS (NPM)
NPM yüklüyse terminalde şu komutu çalıştırabilirsiniz:
```bash
npx http-server ./
```

---

## 🍉 Diyet Takip ve Planlama Özellikleri (Yeni)

Uygulamada diyet takibi iki katmanlı olarak yapılmaktadır:
1.  **Diyet Planlama**: Gelecek veya bugün için öğün bazlı diyet planı oluşturabilirsiniz. Bugün sayfasındaki **"Bugünün Diyet Planı"** kartından bu planları tik atarak tamamlayabilirsiniz. Bir plana tik attığınızda, o gıda otomatik olarak tüketilen gıdalar listesine eklenir ve kaloriniz hesaplanır. Tik kaldırıldığında tüketilenlerden silinir.
2.  **Anlık Tüketim**: Modal üzerinden besin aratarak (Open Food Facts veya yerel veri tabanından) doğrudan "Tüketilen Ekle" butonuna basarak o an yediğiniz besini kaydedebilirsiniz.

---

## 🤖 Google Play Store'a Yükleme Rehberi

TriTrack bir PWA (Progressive Web App) olduğu için, kodu sıfırdan Java veya Kotlin ile yazmaya gerek kalmadan doğrudan Google Play Store'a yükleyebileceğiniz bir Android uygulamasına (`.apk` veya `.aab`) dönüştürebilirsiniz.

### Yöntem 1: Bubblewrap CLI (Google Resmi Aracı - Önerilen)
Bubblewrap, PWA'nızı Google Play Store'un desteklediği TWA (Trusted Web Activity) formatına dönüştürür.
1. Bilgisayarınıza Node.js ve Java JDK 8+ kurun.
2. Terminalde Bubblewrap CLI aracını yükleyin:
   ```bash
   npm i -g @bubblewrap/cli
   ```
3. Uygulamanızın canlı URL'sini (örn. GitHub Pages linki) kullanarak projeyi başlatın:
   ```bash
   bubblewrap init --manifest=https://sizin-uygulamaniz.com/manifest.json
   ```
4. Derleme yapmak için:
   ```bash
   bubblewrap build
   ```
5. Oluşan `.aab` dosyasını Google Play Console'a yükleyebilirsiniz!

### Yöntem 2: PWABuilder (Web Tabanlı - En Hızlı Yol)
1. [pwabuilder.com](https://www.pwabuilder.com) adresine gidin.
2. TriTrack uygulamanızın canlı URL'sini girin ve **"Analyze"** butonuna basın.
3. Analiz sonrası **"Package for Store"** seçeneğinden Android APK/AAB paketlerini indirin.
