# TriTrack — Geliştirme Talepleri

Bu belge, TriTrack uygulamasında yapılması istenen UX ve mimari değişiklikleri açıklamaktadır. Her madde ayrıntılı şekilde anlatılmıştır.

---

## 1. Günlük Vücut Durumu Kartı — Kayıt Sonrası Davranış İyileştirmesi

### Mevcut Durum
"Bugün" (Dashboard) ekranındaki **"🩺 Günlük Vücut Durumu"** kartı her zaman açık formlar (uyku, uyku puanı, HRV, kilo) ve "Vücut Durumunu Kaydet" butonu ile görünüyor. Kullanıcı değerleri girip kaydettikten sonra kart aynı şekilde duruyor — **kayıt yapılmış hissi vermiyor.**

### İstenen Davranış
- Kullanıcı o günün verilerini kaydettikten sonra **form gizlensin** ve yerine kaydedilen değerlerin **kompakt bir özeti** gösterilsin.
  - Örnek özet görünümü:
    ```
    🩺 Günlük Vücut Durumu  ✅
    Uyku: 7.5 saat | Puan: 82 | HRV: 65 ms | Kilo: 74.2 kg
    [Düzenle]
    ```
- Özet görünümünde küçük bir **"Düzenle"** butonu olsun. Buna tıklanınca form tekrar açılsın ve değerler düzenlenebilsin.
- Günün verisi girilmemişse (ilk açılış) normal form görünümü gösterilsin.
- Yani akış şöyle olmalı:
  1. Veri girilmemiş → açık form göster
  2. Kullanıcı kaydetti → formu gizle, özet kartını göster (✅ işaretiyle)
  3. "Düzenle" tıklandı → formu tekrar göster (mevcut değerlerle dolu)
  4. Tekrar kaydetti → özet kartına geri dön

### Etkilenen Dosyalar
- `index.html` — `holistic-card` bölümü (satır ~74-98)
- `app.js` — `renderTodayView()` fonksiyonu, `save-holistic-btn` event listener
- `styles.css` — özet görünümü için yeni stiller

---

## 2. Profil Sayfası — Performans Eşikleri Kaydet Butonu Eksikliği

### Mevcut Durum
Profil ve Ayarlar sayfasında "🎯 Performans Eşikleri" bölümü (dinlenme nabzı, eşik nabzı LTHR, FTP, eşik tempo) var. Bu alanları doldurduktan sonra **kaydetmek için sayfanın en altına kadar inip** genel "Ayarları Kaydet" butonuna basmak gerekiyor. Kullanıcı eşikleri girdiğinde **kaydetmemiş gibi hissediyor** çünkü alanın yakınında bir kaydet butonu yok.

### İstenen Davranış
- Performans Eşikleri bölümünün hemen altına (mevcut "📈 Verilerimden otomatik tahmin et" butonunun yanına veya altına) **ayrı bir "Eşikleri Kaydet" butonu** eklensin.
- Bu buton tıklanınca yalnızca eşik alanlarını (maxHR, RHR, LTHR, FTP, eşik tempo) state'e kaydetsin.
- Kaydetme sonrası kısa bir toast mesajı gösterilsin: _"Performans eşikleri kaydedildi ✅"_
- Alternatif olarak: Eşik alanları değiştirildiğinde otomatik kaydetme (auto-save) yapılabilir ve küçük bir "✓ Kaydedildi" göstergesi gösterilebilir.

### Etkilenen Dosyalar
- `index.html` — `form-settings` formu içindeki performans eşikleri bölümü (satır ~779-806)
- `app.js` — Yeni event listener veya mevcut `form-settings` submit handler'ın güncellenmesi

---

## 3. Profil Sayfasının 3 Alt Sayfaya Bölünmesi

### Mevcut Durum
"Profil ve Ayarlar" sayfası (`view-profile`) şu anda tek bir uzun sayfa halinde tüm ayarları barındırıyor:
- Strava / GPX İçe Aktarma
- Strava Canlı Senkron
- Hesap bilgileri (Supabase auth)
- Profil ve Hedef Ayarları (isim, yarış, kilo, kalori, makrolar, performans eşikleri, AI ayarları)
- Veri Yönetimi (yedekleme/geri yükleme/sıfırlama)

Bu çok uzun ve karışık bir sayfa.

### İstenen Yapı — 3 Alt Sayfa

Profil sayfasını **üst kısımdaki segment/tab butonları** ile geçiş yapılan 3 alt sayfaya böl:

#### Sayfa 1: 📊 Verilerim
- İsim
- Kilo / Kilo hedefi
- Hedef yarış (isim + tarih)
- Günlük kalori hedefi
- Makro hedefleri (protein, karb, yağ)
- Performans eşikleri (maxHR, RHR, LTHR, FTP, eşik tempo) + "Verilerimden otomatik tahmin et" butonu
- Veri Yönetimi (dışa aktar / içe aktar / sıfırla)

#### Sayfa 2: ⚙️ Ayarlar
- AI Koç ayarları (sağlayıcı seçimi, model, API anahtarı)
- Hesap bilgileri (Supabase auth kartı — e-posta, çıkış yap)
- Tema ayarı (isteğe bağlı — şu an header'daki tema toggle'ı yeterli olabilir)

#### Sayfa 3: 🔄 Strava Senkron
- Strava Canlı Senkron kartı (proxy URL, bağla butonu, senkron butonu, durum)
- ~~GPX / TCX İçe Aktarma~~ (**Kaldırılacak** — bkz. Madde 4)

### Tasarım Detayları
- Diyet sayfasındaki mevcut segment butonları (`diet-segment-btn`) ile aynı tasarım dili kullanılsın.
- Segment butonları: `📊 Verilerim` | `⚙️ Ayarlar` | `🔄 Strava`
- Her alt sayfa ayrı bir `div` (pane) olarak gösterilsin/gizlensin (diyet sayfasındaki `diet-daily` / `diet-weekly` mantığıyla aynı).
- Alt sayfalar arası geçiş animasyonlu olsun.

### Etkilenen Dosyalar
- `index.html` — `view-profile` section'ın yeniden düzenlenmesi
- `app.js` — `initProfileView()`, `renderProfileView()` fonksiyonlarının güncellenmesi, segment geçiş mantığı eklenmesi
- `styles.css` — Segment butonları (mevcut diyet segmentlerinin stili yeniden kullanılabilir)

---

## 4. GPX / TCX İçe Aktarma Özelliğinin Kaldırılması

### Mevcut Durum
Profil sayfasında **"🟧 Strava / GPX Antrenman İçe Aktar"** kartı var. Bu kart:
- `.gpx` ve `.tcx` dosyası seçme butonu
- Huawei saat / Strava'dan dosya nasıl alınır açıklaması
- `parseGPX()`, `parseTCX()` fonksiyonları
- `initWorkoutImport()`, `handleWorkoutFiles()`, `finishImport()` fonksiyonları

### İstenen Değişiklik
- Bu kartı (`workout-import-btn`, `workout-import-input` ve ilgili HTML bloğu) tamamen **kaldır**.
- İlgili JavaScript fonksiyonlarını (`initWorkoutImport`, `handleWorkoutFiles`, `finishImport`, `parseGPX`, `parseTCX`) de kaldır ya da yorum satırına al.
- **NOT:** `addImportedWorkout()` fonksiyonu Strava canlı senkronu tarafından da kullanılıyor, bu fonksiyonu **kaldırma**. Aynı şekilde `haversine()`, `guessSport()`, `computePacePerKm()`, `computePacePer100m()`, `computeSpeed()` yardımcı fonksiyonları da başka yerlerde kullanılıyor, onları **kaldırma**.
- Service worker'daki cache listesinden etkilenen bir değişiklik yok (dosya silinmiyor, sadece UI kaldırılıyor).

### Etkilenen Dosyalar
- `index.html` — "Strava / GPX Antrenman İçe Aktar" kartı (satır ~669-699)
- `app.js` — `initWorkoutImport()` çağrısını kaldır, ilgili fonksiyonları kaldır/yorum satırına al

---

## Özet

| # | Değişiklik | Tip | Öncelik |
|---|-----------|-----|---------|
| 1 | Vücut Durumu kartı: kayıt sonrası özet göster, düzenleme butonu ekle | UX | Yüksek |
| 2 | Performans Eşikleri bölümüne ayrı "Kaydet" butonu ekle | UX | Yüksek |
| 3 | Profil sayfasını 3 alt sayfaya böl (Verilerim / Ayarlar / Strava) | Mimari + UX | Orta |
| 4 | GPX/TCX içe aktarma özelliğini kaldır | Sadeleştirme | Düşük |

> **Not:** Bu değişiklikler yapılırken mevcut veri yapısı (state) ve Supabase bulut senkronu bozulmamalıdır. Mevcut kullanıcı verileri korunmalıdır.
