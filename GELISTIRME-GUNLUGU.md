# TriTrack — Geliştirme Günlüğü 📘

Bu dosya, uygulamada adım adım yapılan geliştirmeleri kaydeder. Sonradan dönüp
"ne yapmıştık, neden böyle?" sorusuna hızlıca cevap bulmak için tutulur.

> **Sürüm takibi:** Dosya değişikliği yapıldığında tarayıcının eski sürümü
> önbellekten göstermemesi için iki yer elle artırılır:
>
> - `index.html` içindeki `?v=1.X` (css + js linkleri)
> - `sw.js` içindeki `CACHE_NAME = 'tritrack-vX'`
>
> **Son sürüm:** `?v=1.8` · `tritrack-v8`

---

## ✅ Faz 0 — Stabilizasyon

**Kritik bug:** Alt menü sekmeleri (Program/Diyet/Kaydet/Profil) çalışmıyordu.

- Sebep: [app.js](app.js) `querySelectorAll('.main-content .view-section')` arıyordu ama
  HTML'deki sınıf `.app-content`. Liste boş dönünce sekme geçişi hiç olmuyordu.
- Çözüm: `.main-content` → `.app-content`.
- Ek temizlik: kullanılmayan `sportNames` değişkeni ve yanlış eklenen
  `border-highlight-yuzme` sınıfı kaldırıldı.

## ✅ UI Düzeltmeleri (Antrenman Kaydet + Diyet)

**1. Antrenman Kaydet — branşa özel form geçişi**

- Sebep: CSS'te `.sport-log-form` kuralı hiç yoktu → 4 form (koşu/bisiklet/yüzme/güç) aynı anda görünüyordu.
- Çözüm: [styles.css](styles.css)'e `.sport-log-form { display:none }` + `.sport-log-form.active { display:block }`
  ve seçili sekme vurgusu `.sport-tab-btn.active` eklendi.

**2. Diyet — birim seçenekleri + kullanıcı dostu seçim**

- Yeni birimler: Gram'a ek olarak **Porsiyon (~150g), Tabak (~300g), Kase (~250g), Bardak/Kutu (~200ml), Avuç (~30g)**.
  Hepsi gram karşılığına çevrilir → `UNIT_GRAMS` tablosu ([app.js](app.js)).
- Arama sonucundan seçilen besin artık görsel vurgulanıyor (`highlightSelectedResult`).
- Miktar/birim değişince makrolar **canlı güncelleniyor** (`updatePortionPreview`).
- Listelerde birimler Türkçe gösteriliyor (`formatPortion`, `UNIT_LABELS`).

## ✅ Faz 1 — Veri Yedekleme (Güvenlik)

Profil sekmesine **"Veri Yönetimi"** kartı eklendi ([index.html](index.html), [app.js](app.js)):

- 📤 **Dışa Aktar** — tüm state'i `tritrack-yedek-YYYY-MM-DD.json` olarak indirir (`exportData`).
- 📥 **İçe Aktar** — JSON yedeği okur, **şema doğrular** (`isValidStateShape`), eksik alanları
  tamamlar (`normalizeState`), geri yükleme öncesi **acil yedek** alır (`importData`).
- 🗑️ **Tüm Verileri Sıfırla** — çift onayla siler (`resetAllData`).

## ✅ Faz 2 — Strava / GPX Antrenman İçe Aktarma

**Karar:** "Play Store'da herkes kolayca yüklesin + garanti sorunsuz" hedefi için
**GPX/TCX dosya yükleme** seçildi.

- Strava OAuth ("tek tık bağlan") neden elendi: yeni uygulamalar **"Single Player Mode"**
  (sadece sahip, 1 sporcu); panelden 10 sporcuya yükseltilebilir ama **10+ kullanıcı için
  Strava'nın uygulama incelemesi + bir backend (client_secret) gerekir**. Bu, "garanti
  sorunsuz + sunucusuz" şartına uymuyordu.
- Dosya yöntemi: backend yok, onay yok, sınırsız kullanıcı, asla bozulmaz, üstelik
  Garmin/Polar gibi her saatin GPX'i de çalışır.

**Yapılanlar** ([app.js](app.js)):

- Sahte "Strava ile Bağlan/Senkronize Et" kartı kaldırıldı → gerçek **GPX/TCX yükleme** kartı (Profil).
- `parseGPX` — Haversine ile mesafe, zaman damgalarından süre, `extensions`'tan nabız, isim/`type`'tan spor tahmini.
- `parseTCX` — yapısal `Lap` verisinden süre/mesafe/nabız.
- `addImportedWorkout` — antrenman şemasına dönüştürme + **tekrar ekleme önleme** (`importKey`), çoklu dosya.
- Pace/hız yardımcıları (`formatPace`, `computePacePerKm`, `computePacePer100m`, `computeSpeed`).
- Test için [ornek-antrenman.gpx](ornek-antrenman.gpx) oluşturuldu. **(Play Store paketinden silinebilir.)**

## ✅ Faz 3 — Analiz & İstatistik

Alt menüye **6. sekme "📊 Analiz"** eklendi. Tüm grafikler **saf SVG** (sıfır kütüphane, offline çalışır).

- **Özet kartları:** bu hafta süre · mesafe (koşu+bisiklet) · antrenman sayısı · ort. RPE.
- **📈 Haftalık yük** — son 8 hafta, branşa göre yığılmış bar.
- **🍩 Branş dağılımı** — toplam süreye göre donut + yüzdeler.
- **🌙 Uyku trendi** — süre (bar) + uyku puanı (çizgi).
- **❤️ HRV trendi** — tek temiz çizgi.

**Uyku Puanı eklendi:** Bugün → "Günlük Vücut Durumu" kartına 0–100 uyku puanı alanı
(`holisticLogs[tarih].sleepScore`). Saatten (Garmin/Whoop/Oura) gelen puan girilebilir.

**Okunabilirlik (glanceable) tasarımı:** Her grafik kartı artık **büyük güncel değer +
trend oku (▲/▼) + tek cümle Türkçe yorum** ile başlıyor (`glanceTop`, `makeTrend`, `setGlance`).
Trend renkleri: uyku/HRV artışı yeşil (iyi), düşüş kırmızı; antrenman yükü nötr gri.

> Not: Tek grafikte uyku+HRV birlikteyken iki ölçek kafa karıştırıyordu; bu yüzden
> ikiye ayrıldı. Yeniden kullanılabilir `buildLineChartSVG` yazıldı (ileride kilo/kalori
> trendi için hazır).

---

## 🔜 Bekleyen / Gelecek Fikirler

- [ ] **Anlık (canlı) Strava senkronu** — istenirse: ücretsiz serverless proxy (Cloudflare/Vercel)
  + Strava OAuth + (10+ kullanıcı için) Strava uygulama incelemesi.
- [ ] [ornek-antrenman.gpx](ornek-antrenman.gpx) yayın paketinden silinmeli.
- [ ] Kilo trendi / kalori trendi grafikleri (`buildLineChartSVG` hazır).
- [ ] PWA cilası: bildirimler, ikon/offline iyileştirme, Play Store paketleme (Bubblewrap/PWABuilder).
- [ ] AI Koç: güncel model + uyku puanını da analiz raporuna katma.

## 🗂️ Dosya Haritası (kısa)

- [index.html](index.html) — 6 görünüm (Bugün/Program/Diyet/Kaydet/Profil/Analiz) + 2 modal.
- [app.js](app.js) — bölüm bölüm numaralı: state, navigasyon, tema, bugün, program, diyet,
  antrenman kaydı, profil, AI koç, veri yönetimi (10), GPX/TCX import (11), analiz (12), yardımcılar (13).
- [styles.css](styles.css) — tema (açık/koyu), kartlar, grafikler (`.chart-*`, `.glance-*`).
- [foods.js](foods.js) — çevrimdışı yerel besin veritabanı.
- [sw.js](sw.js) — service worker (offline önbellek).
