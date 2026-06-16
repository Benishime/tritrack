# TriTrack - Triatlon ve Koşu Takip Uygulaması 🏃🚴🏊🏋️

TriTrack, triatletler ve koşucular için özel olarak tasarlanmış, minimalist, mobil öncelikli ve çevrimdışı çalışabilen (PWA) bir antrenman ve diyet takip uygulamasıdır.

Uygulama herhangi bir sunucuya ihtiyaç duymadan tamamen tarayıcıda çalışır. Tüm antrenman, diyet, uyku ve HRV verileri tarayıcınızın yerel hafızasında (`localStorage`) güvenli bir şekilde saklanır.

---

## 📂 Dosya Yapısı

*   `index.html` - Mobil öncelikli arayüz, sekmeler ve modal pencereler (tamamen CSS uyumlu sınıflarla güncellendi).
*   `styles.css` - Açık/Karanlık tema desteği (mavi-siyah ve mavi-beyaz minimalist tema), planlama listeleri ve animasyonlar.
*   `app.js` - State yönetimi, diyet araması (Open Food Facts API), yerel AI Antrenör (veya Gemini API bağlantısı) ve form lojikleri.
*   `foods.js` - Çevrimdışı kullanılabilen 50'den fazla popüler sporcu gıdası listesi.
*   `manifest.json` - Uygulamanın telefona kurulmasını ve Play Store'a dönüştürülmesini sağlayan PWA Manifestosu.
*   `sw.js` - Çevrimdışı çalışabilirlik için dosyaları önbelleğe alan Service Worker (v2).
*   `icon-192.png` & `icon-512.png` - Uygulama logoları.

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
