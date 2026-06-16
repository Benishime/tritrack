# TriTrack — Geliştirme Günlüğü 📘

Bu dosya, uygulamada adım adım yapılan geliştirmeleri kaydeder. Sonradan dönüp
"ne yapmıştık, neden böyle?" sorusuna hızlıca cevap bulmak için tutulur.

> **Sürüm takibi:** Dosya değişikliği yapıldığında tarayıcının eski sürümü
> önbellekten göstermemesi için iki yer elle artırılır:
>
> - `index.html` içindeki `?v=1.X` (css + js linkleri)
> - `sw.js` içindeki `CACHE_NAME = 'tritrack-vX'`
>
> **Son sürüm:** `?v=1.13` · `tritrack-v13`

---

## ✅ UX Raporu Düzeltmeleri (1. parti) — `ux_report.md` temelli

`ux_report.md`'deki bulgulardan net + güvenli + yüksek değerli olanlar düzeltildi:

- **4.1 🔴 Zoom açıldı** — viewport'tan `maximum-scale`/`user-scalable=no` kaldırıldı (erişilebilirlik).
- **2.1 🔴 Fitness süresi** — Güç formuna Saat/Dakika/Saniye alanı eklendi; süre artık gerçek girişten
  (`fitness-duration-*`), boş bırakılırsa eski tahmine düşer. `prefillWorkoutForm` da süreyi doldurur.
- **3.2 🟡 `alert()` → toast** — tüm `alert()` çağrıları kırmızı `showToast(msg, 'error')` ile değiştirildi (`.toast-error`).
- **3.3 🟡 Kayıt sonrası form sıfırlama** — `saveWorkoutAndRoute` artık `resetWorkoutForms()` çağırıyor.
- **3.4 🟢 Boş vücut durumu** — hiçbir alan dolu değilse kayıt yapılmaz, uyarı verir.
- **4.2 🟡 Dokunma alanı** — antrenman ✏️/× butonları `.icon-tap-btn` (min 40×40px).
- **2.2 🟡 Plan mesafe birimi** — plan modalında branş yüzme ise etiket "Mesafe Hedefi (m)" olur (`updatePlanDistanceLabel`).
- **1.2 🟡 Sekme adı** — "Kaydet" → **"Antrenman"**.
- **2.5 🟡 Yazım** — "Listedebulamadın mı?" → "Listede bulamadın mı?".
- **2.6 🟢 Onboarding** — ilk adımda "Geri" butonu `display:none` (yer kaplamıyor).
- **6.5 🟢 AI markdown** — sohbet/raporlar `renderMarkdownLite` ile render ediliyor (**kalın**, ###, -, satır sonu).

> **Ertelenenler (ürün kararı / büyük iş — raporda gerekçeli):** 1.1 (6→5 sekme), 3.1 (confirm→özel modal),
> 1.4 (antrenman tarih seçici), 5.1 (IndexedDB/otomatik yedek), 6.3 (inline stil refactor),
> 6.7 (porsiyon bazlı besin hesabı), 5.3 (API anahtarı maskeleme), 4.4 (3'lü tema döngüsü).

---

## ✅ Haftalık Plan Toplu İçe Aktarma (dal: `ozellik/haftalik-plan-ice-aktar`)

Antrenörden gelen haftalık programı **tek seferde** ekleme. Program sekmesinde
**"📋 Haftayı İçe Aktar"** → modalda metin yapıştır → canlı önizleme → onayla.

- **Akıllı ayrıştırma** ([app.js](app.js) bölüm 5): her satır `Gün: Branş mesafe/süre detay`.
  `parseBulkLine` → gün adını (tam kelime; "Salata" ≠ "Salı"), branşı (`detectBulkSport`, TR/EN),
  mesafeyi (km/m; yüzme m, diğerleri m→km), süreyi (`1sa30dk`, `60dk`, `2 saat`) çıkarır.
  "Dinlenme/off/izin" → plan eklenmez.
- **Hafta seçici** (◀ ▶) + **canlı önizleme**: "X antrenman · Y dinlenme · Z anlaşılamadı";
  çözülemeyen satır kırmızı işaretlenir. **"Örnek doldur"** butonu formatı gösterir.
- **"Bu haftanın planlarını değiştir"** seçeneği (varsa o haftanın planlarını siler, sonra ekler).
- Yeniden kullanım: `mondayOf`/`addDaysStr` (tarih), `SPORT_META` (çip rengi/ad), mevcut `.modal-overlay`.

---

## ✅ Faz 5 — Haftalık Diyet Planı (İleri Tarihli Planlama)

Kullanıcı diyetini önceden, haftalık planlayıp "yarın ne yiyeceğim?"i tek bakışta görebilsin diye eklendi.

- **Diyet sekmesine mod geçişi:** `[ 📋 Günlük Takip | 🗓️ Haftalık Plan ]` segmenti
  ([index.html](index.html) `#view-diet`, `.diet-pane` / `.diet-segment-btn`). Yeni nav sekmesi eklenmedi.
- **Tarih-farkında planlama:** modal artık `dietTargetDate` ile herhangi bir güne plan ekleyebiliyor
  (`openDietModal(meal, date)`); `addSelectedFoodToState`/`saveManualFood` plan eklerken bu günü kullanır.
  Modal başında "📅 {gün} · {öğün} planlanıyor" bağlam etiketi (`#diet-modal-context`).
- **Haftalık görünüm:** `renderWeeklyDietView` — `renderProgramView` desenini taklit eder; 7 gün kartı,
  öğün satırları, günlük toplam kalori rozeti, ◀ ▶ hafta navigasyonu (`dietWeekAnchor`).
- **Hızlı doldurma:** `copyDietDay` (ertesi güne kopyala) + `applyDayToWeek` (tüm haftaya uygula, onaylı).
- **Bugün'de önizleme:** "🌅 Yarın Ne Yiyeceğim?" kartı (`renderTomorrowPreview`) yarının öğünlerini
  ve toplam kalorisini özetler; "🗓️ Planla" butonu doğrudan Haftalık Plan'a götürür.
- **Tekrar azaltma:** `MEAL_META` / `MEAL_ORDER` tek kaynak; `renderTodayView` inline öğün objeleri buna bağlandı.

> Not: Planlı bir öğün silinince/kopyalanınca ona bağlı tüketilen (`fd_sync_<id>`) kayıtları da
> tutarlı şekilde yönetilir. `state.dietPlans` zaten yedekleme/geri yükleme şemasında olduğundan
> ek migrasyon gerekmedi.

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

## ✅ AI Koç Geliştirme (dal: `ozellik/ai-koc-gelistirme`)

AI Koç hem bulut (Gemini) hem yerel modda zenginleştirildi ([app.js](app.js) bölüm 9):

- **Güncel model:** `gemini-1.5-flash` → **`gemini-2.5-flash`** (`GEMINI_MODEL` sabiti — buradan değiştirilir).
- **Hazır olma (readiness) hesabı:** `computeReadiness()` — uyku süresi + uyku puanı + HRV'yi
  (14 günlük HRV bazına göre) puanlayıp 🟢 Hazır / 🟡 Orta / 🔴 Dinlen verir.
- **Zengin bağlam:** `gatherCoachData()` — bugünkü diyet, vücut (uyku/puan/HRV), **7 gün ortalamaları**,
  **bu hafta vs geçen hafta yük**, son 6 antrenman, hazır olma. Hem Gemini istemine (`coachReportPrompt`)
  hem yerel rapora (`generateLocalReport`) bu veriler işleniyor.
- **Uyku puanı analize katıldı** (rapor + readiness).
- **Sohbet artık veri-farkında:** `handleCoachChat` Gemini'ye sporcunun güncel durumunu da iletiyor;
  yerel modda uyku/HRV/toparlanma sorularına readiness'e göre cevap veriyor.

## ✅ Antrenman Düzenleme + Diyet Çift-Görünüm Düzeltmesi (dal: `ozellik/antrenman-duzenle-diyet-fix`)

**1. Antrenman düzenleme akışı** ([app.js](app.js) bölüm 7): Önce sadece silinebiliyordu.
- "Yapılan Antrenmanlar" kartına **✏️ Düzenle** butonu eklendi.
- `startEditWorkout` → Kaydet sekmesine geçer, branş sekmesini seçer, `prefillWorkoutForm` ile
  tüm alanları (mesafe, süre, nabız, güç/kadans, RPE, havuz, egzersizler, not) doldurur.
- `editingWorkoutId` global durumu; `saveWorkoutAndRoute` bu set'liyse **yeni eklemek yerine günceller**
  (orijinal tarih + importKey korunur, plan eşleştirmesi atlanır). `resetWorkoutForms` modu sıfırlar.
- Kaydet butonu düzenlemede "✓ Antrenmanı Güncelle" olur.

**2. Diyet planı çift görünüm bug'ı** ([app.js](app.js) `renderDietView`): Tamamlanan plan hem "📋 Diyet Planı"
hem "🍽 Tüketilen" bölümünde çıkıyordu. Çözüm: "Tüketilen" listesi artık `fd_sync_` ile başlayan
(plandan otomatik gelen) öğeleri **göstermiyor** — plan satırı zaten işaretli görünüyor, kalori toplamı
yine doğru (toplamlar `state.diet`'ten okunuyor).

## ✅ Onboarding Sihirbazı (sahte seed verisi kaldırıldı)

İlk açılışta sahte "Barış Özcan" demo verisi (`seedMockData`) **tamamen kaldırıldı**; yerine 4 adımlık
kurulum sihirbazı geldi ([index.html](index.html) `#onboarding-overlay`, [app.js](app.js) bölüm 13):

- **Adım 1:** isim · **Adım 2:** kilo/boy/yaş/cinsiyet · **Adım 3:** haftalık antrenman yoğunluğu
  (Hafif/Orta/Yüksek/Çok Yüksek) · **Adım 4:** otomatik hesaplanan kalori+makro (düzenlenebilir).
- **Otomatik hesap:** `computeNutritionTargets` — Mifflin-St Jeor BMR × aktivite faktörü; protein 1.8 g/kg,
  yağ kalorinin %25'i, kalan karbonhidrat (dayanıklılık sporcusu profili).
- İlk açılış: `initEmptyState()` boş state kurar + `needsOnboarding=true` → `showOnboarding()`.
  Profil'e ayrıca `height/age/gender/activityFactor` da kaydedilir.
- Mevcut kullanıcılar etkilenmez (kayıtlı state varsa sihirbaz çıkmaz). Test için: verileri sıfırla veya gizli sekme.

---

## 🔜 Bekleyen / Gelecek Fikirler

- [ ] **Anlık (canlı) Strava senkronu** — istenirse: ücretsiz serverless proxy (Cloudflare/Vercel)
  + Strava OAuth + (10+ kullanıcı için) Strava uygulama incelemesi.
- [ ] [ornek-antrenman.gpx](ornek-antrenman.gpx) yayın paketinden silinmeli.
- [ ] Kilo trendi / kalori trendi grafikleri (`buildLineChartSVG` hazır).
- [ ] PWA cilası: bildirimler, ikon/offline iyileştirme, Play Store paketleme (Bubblewrap/PWABuilder).
- [x] ~~AI Koç: güncel model + uyku puanını da analiz raporuna katma.~~ (tamamlandı)

## 🗂️ Dosya Haritası (kısa)

- [index.html](index.html) — 6 görünüm (Bugün/Program/Diyet/Kaydet/Profil/Analiz) + 2 modal.
- [app.js](app.js) — bölüm bölüm numaralı: state, navigasyon, tema, bugün, program, diyet,
  antrenman kaydı, profil, AI koç, veri yönetimi (10), GPX/TCX import (11), analiz (12), yardımcılar (13).
- [styles.css](styles.css) — tema (açık/koyu), kartlar, grafikler (`.chart-*`, `.glance-*`).
- [foods.js](foods.js) — çevrimdışı yerel besin veritabanı.
- [sw.js](sw.js) — service worker (offline önbellek).
