# TriTrack — Geliştirme Günlüğü 📘

Bu dosya, uygulamada adım adım yapılan geliştirmeleri kaydeder. Sonradan dönüp
"ne yapmıştık, neden böyle?" sorusuna hızlıca cevap bulmak için tutulur.

> **Sürüm takibi:** Dosya değişikliği yapıldığında tarayıcının eski sürümü
> önbellekten göstermemesi için iki yer elle artırılır:
>
> - `index.html` içindeki `?v=1.X` (css + js linkleri)
> - `sw.js` içindeki `CACHE_NAME = 'tritrack-vX'`
>
> **Son sürüm:** `?v=1.31` · `tritrack-v31`

---

## ✅ AI Asistan güçlendirme (4 madde)

- **#1 Zengin bağlam:** `gatherCoachData` artık Form/TSB, CTL/ATL, **ACWR**, haftalık TSS, **hedef yarış (gün+faz)**
  ve **eşikleri (LTHR/FTP/tempo)** içeriyor (`getRaceInfo`). `coachReportPrompt` + `assistantSystemPrompt` bunları
  kullanıyor → tavsiyeler veriye dayalı + döneme uygun.
- **#3 Sohbet hafızası:** `aiChatTurns` (son ~8 tur) `runAssistantAgent`'a ekleniyor → bağlamlı, sürdürülebilir diyalog.
- **#2 Haftalık plan üretimi:** yeni AI aracı **`haftalikPlanEkle`** (`aiAddWeekPlan`) — yarış/forma göre tüm haftayı
  tek onayla Programa ekler. Asistan'a **"📅 Haftalık Plan Öner"** butonu.
- **#4 Haftalık rapor:** **"📊 Haftalık Rapor"** butonu → `generateWeeklyReport` (geçen hafta vs bu hafta + Form/ACWR;
  API yoksa `weeklyLocalReport` yerel özet).

---

---

## ✅ Profesyonel sürüm: B grubu (hedef & motivasyon)

- **B1 · Hedef yarış + geri sayım:** Ayarlar'a `raceName`/`raceDate`; Bugün'de "🏁 N gün kaldı" kartı +
  faz önerisi (Base/Build/Peak/Taper, gerçek bugüne göre). `renderRaceCard`.
- **B2 · Ay takvimi:** Program'a aylık takvim (◀ ▶), günlerde sporda renkli noktalar (dolu=yapılan, soluk=planlı),
  güne dokun → o güne plan ekle. `renderCalendar`/`shiftCalendarMonth` (`mondayOf`/`SPORT_META` deseni).
- **B3 · Antrenman şablonları:** plan modalında "⭐ şablon olarak kaydet" + "Şablonlarım" çipleri (dokun→formu doldur,
  ×→sil). `state.templates` (normalizeState'e eklendi → yedek/senkronda korunur). `saveWorkoutTemplate`/`renderPlanTemplates`.
- **B4 · Streak + haftalık recap:** Bugün sonunda 🔥 ardışık gün serisi + bu haftanın özeti (antrenman/süre/mesafe/TSS). `renderStreakRecap`.

> Tümü mevcut Bugün/Program/Ayar altyapısına eklendi; yeni `profile`/`state` alanları opsiyonel (migrasyon yok).

---

---

## ✅ Profesyonel sürüm: A (çekirdek antrenman) + C (beslenme/toparlanma) grupları

Checklist'teki A ve C grupları tamamlandı (plan: "Profesyonel Sürüm").

**A — Çekirdek antrenman döngüsü**
- **A1 · Antrenman detay ekranı + HR/GPS izi:** `parseGPX` artık ≤120 noktalık `track` (hr/lat/lon) saklıyor
  (`addImportedWorkout` → `workout.track`). Bugün'de antrenman kartına dokununca **detay modalı** (`#workout-detail-modal`,
  `openWorkoutDetail`): özet+TSS/IF, **nabız grafiği** (`buildLineChartSVG`), **bölgede süre**, **mini rota** (`buildRouteSVG`).
- **A2 · TSS + IF + ACWR:** `workoutIF` (bisiklet güç/FTP, koşu tempo/eşik, genel HR/LTHR) + `workoutLoad` (TSS ölçeği:
  saat×IF²×100; eşik yoksa RPE/10). `dailyLoadOn` artık TSS topluyor → CTL/ATL/Form TSS bazlı. `computeAcwr` (akut7g/kronik)
  → Form kartında sakatlık/yüklenme uyarısı.
- **A3 · Branşa göre bölgeler:** `ifZone` + `workoutZone` (güç/tempo/HR). "Nabız Bölgeleri" → **"Yoğunluk Bölgeleri (HR/güç/tempo)"**.

**C — Beslenme & toparlanma**
- **C1 · Hidrasyon:** Bugün'de 💧 Su kartı (250ml bardak, hedef 2500ml, `holisticLogs[date].water`).
- **C2 · Kilo hedefi:** Ayarlar'a `weightGoal`; kilo trendinde "hedefe X kg · ~Y hafta" projeksiyonu.
- **C3 · Yakıtlama:** ≥90 dk seans olan günlerde Bugün'de ⛽ öneri kartı (sırasında 60–90g/sa karb + kg'ye göre toparlanma).

> Yeni `profile` alanları (RHR/LTHR/FTP/eşik tempo/weightGoal) opsiyonel → migrasyon yok; Supabase senkron + yedeklemede korunur.
> `track` downsample'lı (~3-4KB/seans) saklanır. Eşikleri "📈 Verilerimden tahmin et" ile geçmişten doldurabilirsin.

---

## ✅ Profesyonel P1 (dilim 1): Performans eşikleri + LTHR tabanlı nabız bölgeleri

Sporcuya özel zone'ların temeli atıldı (plan: "Profesyonel Sürüm" P1.1 + P1.2 ilk dilim).

- **Yeni profil alanları** (Ayarlar → "🎯 Performans Eşikleri", hepsi opsiyonel): **RHR, LTHR (eşik nabzı),
  FTP (watt), eşik tempo (dk/km)**. `state.profile.{restingHr,lthr,ftp,thresholdPace}`; `initProfileView`
  load/save. Opsiyonel → migrasyon yok; Supabase senkronda korunur (secret değil), yedeklemede de.
- **Nabız bölgeleri artık LTHR'a göre:** `hrZoneOfLthr` (Friel benzeri 5 bölge: <81/81-90/90-94/94-100/≥100%).
  `renderHrZones` LTHR girilmişse onu, yoksa eski %maxHR'ı kullanır; glance "(LTHR 165)" / "(maxHR 190)" basisini
  ve düşük-yoğunluk (Z1–Z2) yüzdesini gösterir; LTHR yoksa "LTHR gir" ipucu.
- FTP/eşik tempo şimdilik yalnız saklanıyor; sonraki dilimde güç-zone'ları, koşu tempo-zone'ları ve TSS/ACWR.

---

## ✅ UX Cilası (1): confirm() → uygulama-içi onay modalı (ux_report 3.1)

Çirkin/tutarsız tarayıcı `confirm()` pencereleri kalktı; yerine şık, temalı bir modal geldi (premium his).

- **Altyapı:** `#confirm-overlay` ([index.html](index.html)) + `.confirm-*` stilleri ([styles.css](styles.css)) +
  `showConfirm(message, {title, okText, cancelText, danger})` → **Promise<boolean>** ([app.js](app.js), showToast yanında).
  Mesaj `textContent` ile basılır (enjeksiyon yok), `white-space: pre-line` ile `\n` satır sonları korunur.
  Overlay/ESC ile iptal; DOM yoksa `window.confirm`'e güvenli yedek.
- **9 çağrı dönüştürüldü** (hepsi `await showConfirm`): antrenman/plan/diyet-planı silme, tüm haftaya uygula,
  yedek geri yükleme, tüm veriyi sıfırla (çift onay), çıkış, misafir→hesap veri taşıma. İçeren callback/fonksiyonlar
  `async` yapıldı; silme/sıfırlama onayları `danger:true` (kırmızı buton).
- `alert()`'ler zaten daha önce toast'a çevrilmişti; artık ham tarayıcı diyaloğu kalmadı.

---

## ✅ Haftalık Diyet Bug'ı — GERÇEK kök neden (bağlam-duyarlı modal)

Önceki `refreshDietUI()` düzeltmesi yenileme tarafını kapatmıştı ama **bug devam ediyordu**. Asıl sebep:
besin ekleme modalı her bağlamda **hem "Tüketilen Ekle" hem "Plana Ekle"** gösteriyordu. Haftalık plandan
"+ Ekle" deyince kullanıcı birincil **"Tüketilen Ekle"**'ye basıyor → veri `state.diet`'e (bugüne tüketim)
gidiyor, `state.dietPlans`'a (haftalık plan) değil → haftalık listede asla görünmüyor. Yani veri **yanlış yere**
yazılıyordu; yenileme sorunu değildi.

- **Çözüm:** `openDietModal(meal, date, mode)` — günlük çağrı `'track'`, haftalık çağrı `'plan'`.
  `applyDietModalMode` plan modunda "Tüketilen Ekle" butonlarını (hem seçim paneli hem manuel form) gizleyip
  sadece "Plana Ekle"yi tam genişlik bırakır. Böylece haftalıktan eklenen her şey doğru biçimde `dietPlans`'a gider.
- **Güvence:** `refreshDietUI` artık her görünümü `try/catch` ile sarmalıyor — biri hata verse bile haftalık güncellenir.

---

## ✅ PWABuilder Düzenlemeleri & Diyet Planı Senkronizasyon Düzeltmesi

PWABuilder Android paketlemesi uyarılarını gidermek ve diyet planlamasındaki anlık yenilenmeme (senkronizasyon) hatasını çözmek için kapsamlı güncellemeler yapıldı.

- **Model:** Gemini 3.5 Flash (High)
- **PWABuilder Hata ve Uyarı Çözümleri:**
  - `manifest.json` dosyasına benzersiz `id` (`/tritrack/`), amaca uygun maskable ikon tanımları ve 1024x1024 boyutlarında iki yeni uygulama ekran görüntüsü (`screenshot-dashboard.png`, `screenshot-analysis.png`) eklendi.
  - İkon dosyalarının (`icon-192.png`, `icon-512.png`, `icon-maskable-512.png`) piksel boyutları PowerShell `System.Drawing` ile gerçek boyutlarına resize edilerek manifest tanımlarıyla tam eşleşmesi sağlandı (1024px sürümü `icon-1024.png` adıyla ayrıca eklendi).
  - `sw.js` (Service Worker) önbellek listesine yeni görseller eklendi ve tarayıcı/telefon önbelleğini temizlemeye zorlamak için önbellek sürümü `tritrack-v22`'ye yükseltildi.
  - Değişiklikler paketlenerek GitHub `main` ve `gelistirme` dallarına başarıyla push edildi.
- **Haftalık Diyet Planı Senkronizasyon Hatası:**
  - Sorun: Diyet sekmesinde haftalık görünümdeyken besin ekleme eylemi yapıldığında, eklenen öğeler sadece günlük görünümü yenilediği için haftalık planda anlık olarak belirmiyordu (ancak kopyalama gibi başka bir eylem tetiklendiğinde görünüyorlardı).
  - Çözüm: `app.js` içerisine hem günlük, hem haftalık hem de dashboard (bugün) diyet görünümlerini eşzamanlı güncelleyen `refreshDietUI()` fonksiyonu tanımlandı.
  - Diyet ekleme, silme, kopyalama, tamamlama ve yapay zeka ile diyet girdisi yapma yerlerindeki eski render çağrıları `refreshDietUI()` ile değiştirilerek tüm görünümlerin anlık olarak senkronize çalışması sağlandı.

---

## ✅ Kullanıcı Hesabı + Bulut Senkron (Supabase) — Faz A

TriTrack çok kullanıcılı ürüne dönüştü: hesapla giriş + kullanıcı-bazlı bulut depolama, yerel-öncelikli
çalışmayı bozmadan. Kurulum: **[SUPABASE-KURULUM.md](SUPABASE-KURULUM.md)** + `db/schema.sql`.

- **Model:** kullanıcı başına **tek satır** (`user_data.data jsonb`) = tüm `state`. RLS ile her kullanıcı
  yalnız kendi verisini görür. Mevcut `normalizeState`/`isValidStateShape` pull'da yeniden kullanıldı.
- **app.js "1.A AUTH & BULUT":** `initAuth` (oturum kontrol → pull / auth ekranı / misafir),
  `signIn`/`signUp`/`signOut`/`continueAsGuest`, `pullCloud` (giriş anında bulut doğruluk kaynağı),
  `pushCloud` (debounced, `saveState`'ten). `state.updatedAt` damgası; çakışmada **son-yazan-kazanır**.
- **Gizlilik:** `cloudPayload` Gemini anahtarı + Strava token/proxy'yi **buluta göndermez** (cihazda kalır).
- **Misafir modu korunur:** `tritrack_guest` bayrağı → tamamen yerel (eski davranış). `SUPABASE_URL/ANON_KEY`
  boşsa hesap ekranı hiç çıkmaz, uygulama saf yerel çalışır.
- **UI:** `#auth-overlay` (giriş/kayıt, onboarding deseni), Profil'e Hesap kartı + Çıkış. Supabase JS yerel
  vendor (`supabase.min.js`, sw cache'te → çevrimdışı kabuk korunur).
- **Yeni kullanıcı:** bulut satırı yoksa onboarding; misafirken veri varsa "hesabına yükleyeyim mi?" taşıma.

> Strava çok-kullanıcı DEĞİL: Strava "tek sporcu" kuralı yüzünden canlı senkron yalnız sahip hesabında;
> diğer kullanıcılar GPX/elle giriş kullanır. Faz B: Google girişi, parola sıfırlama, çevrimdışı push kuyruğu.

---

## ✅ Strava Canlı Senkron (kişisel, otomatik) — Huawei → Strava → TriTrack

Antrenmanları elle girmeyi bitirmek için canlı Strava senkronu eklendi (kapsam: **sadece sahip / tek sporcu**).
Yol haritası ve gerekçeler `bu-projeyi-incele...` plan dosyasında; kurulum **[STRAVA-KURULUM.md](STRAVA-KURULUM.md)**.

- **Neden proxy?** Strava `client_secret` tarayıcıda tutulamaz + Strava API tarayıcıdan CORS'a kapalı.
  Çözüm: küçük ücretsiz **Cloudflare Worker** (`strava-proxy/worker.js` + `wrangler.toml`): `/login`, `/callback`, `/sync`.
- **PWA tarafı** ([app.js](app.js) "11.B STRAVA CANLI SENKRONU"): `connectStrava` (OAuth'a yönlendir),
  `handleStravaRedirect` (dönüşte `#strava_token`'ı yakalayıp `state.profile.strava`'ya yaz), `syncStrava`
  (Worker `/sync` → aktiviteler), `mapStravaActivity` (Strava `type`→branş, mesafe/süre/nabız/güç),
  `renderStravaStatus`. Profil'e "Strava Canlı Senkron" kartı + Proxy URL alanı.
- **Tekrar engelleme:** `addImportedWorkout` artık `stravaId` ile de dedup yapıyor; içe aktarılan kayıtlara
  `source:'strava'` işaretleniyor.
- **Strava API sözleşmesi:** Strava kaynaklı **ham** antrenman detayları AI'ya gönderilmiyor —
  `gatherCoachData.recent` artık `source==='strava'` kayıtları **dışlıyor** (haftalık kaba toplam gidebilir).
- **Huawei:** Huawei Health → native Strava bağlantısı (veya GPX/TCX dışa aktar) ile veri Strava'ya, oradan buraya.
  Import kartındaki yardım metni Huawei adımlarıyla güncellendi.

> Çalışması için kullanıcı bir kez Strava API uygulaması açıp Worker'ı yayınlar ve Proxy URL'sini girer.
> `state.profile.strava` opsiyonel olduğundan migrasyon gerekmedi (yedeklemede korunur; refresh_token hassastır).

---

## ✅ AI Asistan: Eylem yapabilen agent (Gemini Function Calling)

AI Koç artık "bilen"den "yapabilen"e geçti — **okuma + (onaylı) yazma** ([app.js](app.js) "9.5. AI ASİSTAN ARAÇLARI").

- **6 araç:** `antrenmanEkle`, `antrenmanPlaniEkle`, `vucutDurumuKaydet`, `besinEkle`, `hedefGuncelle` (yazma) +
  `gunVerisiniGetir` (okuma — geçmiş günleri sorgular).
- **Agent döngüsü** `runAssistantAgent`: model → araç çağrısı → (yazma ise **onay kartı**) → çalıştır →
  `functionResponse` geri → final metin. Maks 6 adım. `geminiGenerate` = tools + `systemInstruction` destekli istek.
- **İnsan onayı (kullanıcı kararı):** her yazma öncesi sohbette `aiConfirmAction` ile
  **[✅ Onayla] [✖ Vazgeç]** kartı; onaylanmadan state'e dokunulmaz. Silme/sıfırlama araçları **verilmedi**.
- Sohbetin bulut dalı `callGeminiAPI` yerine `runAssistantAgent`'a bağlandı; karşılama mesajı + girdi ipucu güncellendi.
- REST formatı doğrulandı (ai.google.dev): araç sonucu `role:"user"` + `functionResponse:{name,response}`,
  modelin `functionCall` turu da contents'e eklenir.
- Dokümantasyon: [AI-VERI-ERISIMI.md](AI-VERI-ERISIMI.md) yeni yazma yeteneğine göre güncellendi.

---

## ✅ Analiz Paketi — 5 yeni içgörü (saf SVG, sıfır bağımlılık)

Mevcut Analiz altyapısı (`buildLineChartSVG`, `collectDailySeries`, glance deseni, `SPORT_META`) yeniden
kullanılarak toplanan veriden 5 yeni analiz türetildi ([app.js](app.js) Bölüm 12, [index.html](index.html) Analiz görünümü):

- **⚖️ Kilo Trendi** — `renderWeightChart` (`collectDailySeries('weight',30)`).
- **🔥 Kalori Trendi** — `renderCalorieChart` + `collectCalorieSeries` (günlük `state.diet` toplamı), hedefe göre yorum.
- **🏆 Kişisel Rekorlar** — `computePersonalRecords`/`renderPersonalRecords`: en uzun koşu/sürüş, en iyi tempo,
  en hızlı sürüş, en uzun süre, en yüksek haftalık mesafe (`.analysis-stat-card` ızgarası).
- **📊 Form & Yük (CTL/ATL/TSB)** — `dailyLoadOn` (RPE×dk TRIMP) + `computeFitnessFatigue` (EWMA: CTL 42g, ATL 7g,
  Form=CTL−ATL); `renderLoadBalanceChart` iki-çizgi grafik + Form yorumu (taze/dengede/yorgun).
- **❤️‍🔥 Nabız Bölgeleri** — `hrZoneOf`/`renderHrZones`: son 28 günde nabızlı antrenmanları süreye göre Z1–Z5
  dağıtır (yatay barlar). Yeni profil alanı **`maxHr`** (Ayarlar → "Maksimum Nabız", boşsa 190).

> Fazlar bağımsız geliştirildi; her biri veri yokken düzgün boş durum gösterir. `profile.maxHr` opsiyonel
> olduğundan migrasyon gerekmedi (yedekleme/geri yüklemede de korunur).

---

## ✅ Navigasyon: Profil → header ikonu, alt menüde "Asistan"

Alt menü yeniden düzenlendi (UX raporu 1.1 yönünde):

- **Alt menüdeki "Profil" sekmesi → "🤖 Asistan"** oldu; içeriği yalnızca AI Koç kartı (yeni `#view-assistant`).
- **Profil/kullanıcı bilgileri header'a taşındı:** üst köşeye **👤 profil ikonu** (`#profile-open-btn`)
  eklendi → `#view-profile` (artık "Profil ve Ayarlar": GPX içe aktarma + ayarlar + veri yönetimi).
- Navigasyon: header ikonu alt menüde olmayan `view-profile`'ı açar (`initNavigation` içinde özel handler);
  alt menüye basınca ikon aktifliği kalkar. `refreshActiveView`'a `assistant` case'i eklendi.
- AI Koç olay bağlayıcıları (`initProfileView`) DOM'da olduğu sürece çalışmaya devam ediyor (kart taşındı, ID'ler aynı).

## ✅ Bugün: "Yarın Ne Yiyeceğim?" kartı kaldırıldı

Bugün sekmesinde yalnızca bugüne ait şeyler kalsın diye yarın önizleme kartı (`renderTomorrowPreview`,
`#tomorrow-diet-preview`, buton dinleyicisi) tamamen kaldırıldı. Yarın planı hâlâ **Diyet → Haftalık Plan**'da.

---

## ✅ Bugün: Plan ↔ Yapılan kartlarının ayrıştırılması (UX)

"Bugünün Antrenman Planı" ve "Yapılan Antrenmanlar" kartları aynı işi iki yerde gösteriyordu
(tamamlanan plan üstü çizili olarak planda kalıyor + ayrıca yapılanlarda görünüyordu).

- **Plan kartı = yalnızca yapılacaklar:** `renderTodayView` artık sadece `!completed` planları listeler;
  hepsi bitince "🎉 Bugünün tüm planlarını tamamladın!" mesajı.
- **Tamamlananlar "Yapılan"a akar:** "Kaydet" ile loglanan plan, `saveWorkoutAndRoute` içinde
  `plan.loggedWorkoutId = workout.id` ile kayda **bağlanır** → çift gösterim önlenir.
- **Sadece tiklenen (detay girilmeyen) plan**, "Yapılan Antrenmanlar"da kompakt bir
  `.workout-done-row` satırı + **"Geri al"** (yapılacaklara döndür) ile gösterilir.

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
