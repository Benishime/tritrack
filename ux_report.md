# 🔍 TriTrack UX Analiz Raporu — Kullanıcı Dostu Olmayan Kısımlar

> **Tarih:** 16 Haziran 2026  
> **Analiz Yöntemi:** Tüm kaynak kodun ([index.html](file:///c:/Users/User/Desktop/Fitness%20Takip/index.html), [app.js](file:///c:/Users/User/Desktop/Fitness%20Takip/app.js), [styles.css](file:///c:/Users/User/Desktop/Fitness%20Takip/styles.css), [foods.js](file:///c:/Users/User/Desktop/Fitness%20Takip/foods.js)) satır satır incelenmesiyle hazırlanmıştır.

---

## Önem Dereceleri

| Simge | Anlam |
|-------|-------|
| 🔴 | **Kritik** — Kullanıcıyı engelleyen veya veri kaybına yol açabilecek sorun |
| 🟡 | **Orta** — Belirgin bir kullanılabilirlik sorunu, kafa karıştırıcı |
| 🟢 | **Düşük** — İyileştirme önerisi, polish eksiklikleri |

---

## 1. Navigasyon ve Keşfedilebilirlik Sorunları

### 🔴 1.1 — Alt navigasyonda 6 sekme: Aşırı kalabalık

**Dosya:** [index.html#L640-L682](file:///c:/Users/User/Desktop/Fitness%20Takip/index.html#L640-L682)

Alt navigasyonda **6 adet sekme** var (Bugün, Program, Diyet, Kaydet, Analiz, Profil). Mobil UX standartlarına göre alt bar'da **en fazla 5 sekme** önerilir. 6 sekme ile:
- Her sekme etiketi çok küçük kalır (özellikle "Analiz" ve "Program" gibi uzun kelimelerle)
- Dokunma alanları birbirine çok yakın, yanlışlıkla komşu sekmeye basma riski yüksek
- Font boyutu zaten **10px** ile çok küçük

> **Öneri:** "Analiz" ve "Profil" sekmelerini birleştirin ya da "Profil"i bir header ikonuna taşıyın.

---

### 🟡 1.2 — "Kaydet" sekmesi ismi belirsiz

**Dosya:** [index.html#L662-L667](file:///c:/Users/User/Desktop/Fitness%20Takip/index.html#L662-L667)

"Kaydet" ismi ne kaydedeceğini belirtmiyor. Bir kalem ikonu ile birlikte "Kaydet" yazdığında kullanıcı bunu "ayarları kaydet" veya "verileri dışa aktar" gibi anlayabilir. Gerçek işlevi **"Antrenman Kaydı Oluştur"**.

> **Öneri:** Sekme adını **"+ Antrenman"** veya **"Kayıt"** olarak değiştirin.

---

### 🟡 1.3 — Tarih navigasyonuyla sadece "Bugün" sekmesi değişiyor

**Dosya:** [app.js#L228-L233](file:///c:/Users/User/Desktop/Fitness%20Takip/app.js#L228-L233)

Kullanıcı "Bugün" ekranında tarih değiştirdiğinde (`←` / `→` butonlarıyla), bu tarih değişimi **Diyet sekmesi** ve **Antrenman Kaydet** ekranını da etkiliyor (çünkü `currentDateStr` global değişkeni paylaşılıyor). Ancak bu hiçbir yerde kullanıcıya bildirilmiyor. Kullanıcı Diyet sekmesine geçtiğinde o günün beslenme verilerini görüyor ama **hangi gün olduğunu** Diyet ekranında göremez.

> **Öneri:** Diyet sekmesinin üstüne de tarih göstergesi ve gezinti butonları ekleyin.

---

### 🟡 1.4 — Antrenman kaydında tarih seçilemiyor

**Dosya:** [app.js#L1263-L1266](file:///c:/Users/User/Desktop/Fitness%20Takip/app.js#L1263-L1266)

Antrenman kaydet formlarında (Koşu, Bisiklet, Yüzme, Fitness) **tarih alanı yok**. Antrenman otomatik olarak `currentDateStr` tarihine kaydediliyor. Kullanıcı dünkü antrenmanını kaydetmek isterse:
1. Önce "Bugün" sekmesine gitmeli
2. Tarihi `←` butonuyla geri almalı
3. Sonra "Kaydet" sekmesine geçmeli

Bu çok dolaylı ve keşfedilmesi zor bir iş akışı.

> **Öneri:** Antrenman kayıt formlarına açık bir **tarih seçici (date picker)** ekleyin.

---

### 🟢 1.5 — "Antrenman Kaydet" butonunun yerleşimi kafa karıştırıcı

**Dosya:** [index.html#L99-L101](file:///c:/Users/User/Desktop/Fitness%20Takip/index.html#L99-L101)

"Bugün" ekranındaki "✅ Yapılan Antrenmanlar" kartının yanında küçük bir **"Antrenman Kaydet"** butonu var, ancak aynı işlevi yapan ayrı bir **"Kaydet" sekmesi** de mevcut. İki farklı giriş noktası aynı iş için.

> **Öneri:** "Bugün" ekranındaki buton yeterli. Veya FAB (floating action button) kullanarak tek bir giriş noktası sağlayın.

---

## 2. Form ve Giriş Sorunları

### 🔴 2.1 — Fitness formu: Süre alanı yok, otomatik tahmin doğru değil

**Dosya:** [app.js#L1380-L1388](file:///c:/Users/User/Desktop/Fitness%20Takip/app.js#L1380-L1388)

Fitness (Güç) antrenmanında süre alanı tamamen eksik. Süre `exercises.length * 5 * 60` formülüyle **otomatik hesaplanıyor** — yani her egzersiz için sabit 5 dakika. Gerçek hayatta bir squat seti ile ısınma hareketlerinin süresi çok farklı olabilir. Bu durum:
- Analiz grafiklerinde yanlış antrenman yükü göstermesine
- AI antrenör raporlarında yanlış toparlanma önerilerine neden olur

> **Öneri:** Fitness formuna da diğer branşlar gibi bir Saat/Dakika/Saniye alanı ekleyin.

---

### 🟡 2.2 — Yüzme formu: Mesafe birimi karışıklığı

**Dosya:** [index.html#L400-L401](file:///c:/Users/User/Desktop/Fitness%20Takip/index.html#L400-L401) vs [index.html#L711](file:///c:/Users/User/Desktop/Fitness%20Takip/index.html#L711)

- Yüzme formu "Mesafe (Metre)" olarak etiketlenmiş ve metre cinsinden girdi alıyor
- Ancak planlama modalında mesafe etiketi **"Mesafe Hedefi (km/m)"** — hangi branş için hangi birim olduğu belirsiz
- Ayrıca planlanan yüzme planında mesafe verisi doğru dönüştürülemiyor (km olarak gösteriliyor)

> **Öneri:** Plan modalında branşa göre birim etiketini dinamik değiştirin (yüzme seçilince → "Mesafe (m)").

---

### 🟡 2.3 — Besin ekleme modalı: İki buton karışıklığı ("Tüketilen Ekle" vs "Plana Ekle")

**Dosya:** [index.html#L785-L786](file:///c:/Users/User/Desktop/Fitness%20Takip/index.html#L785-L786)

Besin seçildikten sonra "Tüketilen Ekle" ve "Plana Ekle" şeklinde yan yana iki buton var. Yeni kullanıcı için:
- "Plana Ekle" ne anlama geliyor? (Haftalık diyet planına mı ekliyor?)
- Hangi butona basacağını bilerek karar vermesi gerekiyor
- Eğer günlük takip ekranından gelindiyse **her iki buton da aktif** ve hangisinin doğru olduğu belli değil

> **Öneri:** Bağlama göre buton görünürlüğünü değiştirin. Günlük takipten açılınca sadece "Tüketilen Ekle" gösterin; haftalık plandan açılınca sadece "Plana Ekle" gösterin.

---

### 🟡 2.4 — RPE slider'ı: Dokunmatik cihazlarda zor kullanılır

**Dosya:** [index.html#L338](file:///c:/Users/User/Desktop/Fitness%20Takip/index.html#L338)

`<input type="range">` ile RPE slider'ı tüm branş formlarında kullanılıyor. Ancak:
- Tarayıcı varsayılan `range` input'u mobilde çok ince ve küçük olabilir
- Rakam sadece slider'ın üstündeki küçük `<span>` etiketinde değişiyor
- 1–10 arası tam sayı seçimi için **buton grubları** (segmented control) çok daha dokunmatik dostu olurdu

> **Öneri:** RPE seçimini 1–10 arası küçük butonlardan oluşan bir satır haline getirin.

---

### 🟡 2.5 — Manuel besin ekleme: Gizli form

**Dosya:** [index.html#L794](file:///c:/Users/User/Desktop/Fitness%20Takip/index.html#L794)

"Listede bulamadın mı? Manuel Gıda Ekle" butonu `hidden` sınıfıyla gizleniyor. Butonun metni de birbirine bitişik: **"Listedebulamadın mı?"** (boşluk eksik).

> **Öneri:** Yazım hatasını düzeltin (`Listede bulamadın mı?`) ve bu alanı varsayılan olarak açık tutmayı düşünün.

---

### 🟢 2.6 — Onboarding: "Geri" butonu ilk adımda görünmez ama yer kaplıyor

**Dosya:** [app.js#L2731](file:///c:/Users/User/Desktop/Fitness%20Takip/app.js#L2731)

İlk adımda "Geri" butonu `visibility: hidden` ile gizleniyor ama **yer kaplamaya devam ediyor**. Bu, "İleri" butonunun sağa itilmesine neden olur.

> **Öneri:** İlk adımda butonu `display: none` yapın veya tek geniş "İleri" butonu gösterin.

---

## 3. Geri Bildirim ve Durum Bildirimi Eksiklikleri

### 🔴 3.1 — Silme işlemleri: `confirm()` ile ham tarayıcı uyarısı

**Dosya:** [app.js#L371](file:///c:/Users/User/Desktop/Fitness%20Takip/app.js#L371), [app.js#L619](file:///c:/Users/User/Desktop/Fitness%20Takip/app.js#L619), [app.js#L1099](file:///c:/Users/User/Desktop/Fitness%20Takip/app.js#L1099), [app.js#L2053](file:///c:/Users/User/Desktop/Fitness%20Takip/app.js#L2053)

Antrenman silme, plan silme, diyet planı silme ve tüm verileri sıfırlama işlemlerinin hepsinde tarayıcının yerleşik `confirm()` diyaloğu kullanılıyor. Bu:
- Uygulamanın premium tasarımıyla uyumsuz
- Mobilde iOS/Android'de farklı görünüyor, tutarsız deneyim
- PWA modunda çirkin görünüyor

> **Öneri:** Tüm onay diyaloglarını uygulama içi özel bir modal ile değiştirin (zaten modal altyapısı var).

---

### 🟡 3.2 — Doğrulama hataları: `alert()` ile ham uyarı

**Dosya:** [app.js#L1005](file:///c:/Users/User/Desktop/Fitness%20Takip/app.js#L1005), [app.js#L1253](file:///c:/Users/User/Desktop/Fitness%20Takip/app.js#L1253), [app.js#L1328](file:///c:/Users/User/Desktop/Fitness%20Takip/app.js#L1328), [app.js#L2737](file:///c:/Users/User/Desktop/Fitness%20Takip/app.js#L2737)

Tüm form doğrulama hataları `alert()` ile gösteriliyor. Uygulamada zaten güzel bir `showToast()` fonksiyonu var, ama hatalar için kullanılmıyor.

> **Öneri:** Tüm `alert()` çağrılarını kırmızı tonlu toast bildirimleriyle değiştirin.

---

### 🟡 3.3 — Kaydetme işleminden sonra görsel geri bildirim gecikmesi

**Dosya:** [app.js#L1419-L1421](file:///c:/Users/User/Desktop/Fitness%20Takip/app.js#L1419-L1421)

Antrenman kaydedildikten sonra uygulama otomatik olarak "Bugün" sekmesine geçiyor. Bu geçiş:
- Toast mesajı ile bildiriliyor (✓)
- Ama form verileri silinmiyor (`resetWorkoutForms` sadece "Kaydet" sekmesine geçişte çağrılıyor)
- Kullanıcı geri dönerse eski verileri formda hâlâ görebilir

> **Öneri:** Başarılı kayıttan sonra formu da sıfırlayın.

---

### 🟢 3.4 — Vücut durumu kaydetme: Değişiklik yoksa bile kayıt yapılıyor

**Dosya:** [app.js#L197-L218](file:///c:/Users/User/Desktop/Fitness%20Takip/app.js#L197-L218)

"Vücut Durumunu Kaydet" butonuna basıldığında tüm alanlar boş olsa bile kayıt yapılıyor ve "Başarıyla kaydedildi" toast'u gösteriliyor. Boş kayıt kullanıcıyı yanıltır.

> **Öneri:** En az bir alan doldurulmuşsa kaydedin, aksi takdirde uyarı gösterin.

---

## 4. Erişilebilirlik Sorunları

### 🔴 4.1 — `viewport` meta etiketi zoom'u devre dışı bırakıyor

**Dosya:** [index.html#L5](file:///c:/Users/User/Desktop/Fitness%20Takip/index.html#L5)

```html
<meta name="viewport" content="..., maximum-scale=1.0, user-scalable=no, ...">
```

Bu ayar kullanıcının sayfayı yakınlaştırmasını engelliyor. Görme güçlüğü olan kullanıcılar için ciddi bir erişilebilirlik engeli.

> **Öneri:** `maximum-scale=1.0` ve `user-scalable=no` kısıtlarını kaldırın.

---

### 🟡 4.2 — Antrenman silme butonları: Çok küçük dokunma alanı

**Dosya:** [app.js#L359](file:///c:/Users/User/Desktop/Fitness%20Takip/app.js#L359)

Antrenman kartlarındaki silme butonu (`×`) ve düzenleme butonu (`✏️`) çok küçük:
- `font-size: 15px` / `18px` ile sadece emoji boyutunda
- `padding: 2px 4px` — mobilde parmakla basmak çok zor
- [WCAG minimum dokunma hedefi](https://www.w3.org/TR/WCAG22/) **44×44 CSS pixel** önerir

> **Öneri:** Minimum `40×40px` dokunma alanı sağlayın (`min-width`, `min-height` veya padding ile).

---

### 🟡 4.3 — Scrollbar gizlenmiş: İçerik kaydırılabilirliği belli değil

**Dosya:** [styles.css#L188-L194](file:///c:/Users/User/Desktop/Fitness%20Takip/styles.css#L188-L194)

Ana içerik alanının scrollbar'ı tamamen gizlenmiş. Bazı kullanıcılar (özellikle masaüstünde) sayfanın kaydırılabilir olduğunu fark edemeyebilir.

> **Öneri:** Masaüstü viewport için ince bir özel scrollbar gösterin.

---

### 🟢 4.4 — Tema geçişi: "Auto" moda geri dönüş yolu yok

**Dosya:** [app.js#L162-L173](file:///c:/Users/User/Desktop/Fitness%20Takip/app.js#L162-L173)

Tema butonu sadece Light ↔ Dark arasında geçiş yapıyor. İlk açılışta `theme-auto` olarak başlıyor ama bir kez tıklandıktan sonra "sistem temasına uy" moduna geri dönme yolu yok.

> **Öneri:** Light → Dark → Auto şeklinde 3 aşamalı bir döngü yapın.

---

## 5. Veri Güvenliği ve Kayıp Riskleri

### 🔴 5.1 — Tüm veriler yalnızca `localStorage`'da

**Dosya:** [app.js#L82-L85](file:///c:/Users/User/Desktop/Fitness%20Takip/app.js#L82-L85)

Tüm antrenman, diyet, plan ve profil verileri yalnızca `localStorage`'da saklanıyor:
- Tarayıcı önbelleği temizlenince **tüm veri kaybolur**
- `localStorage` limiti genellikle **5MB** — yoğun kullanımda dolabilir
- Kullanıcıya hiçbir zaman "yedek al" hatırlatması yapılmıyor

> **Öneri:** Belirli aralıklarla (haftalık) otomatik yedek hatırlatması gösterin. IndexedDB'ye geçiş düşünün.

---

### 🟡 5.2 — Sıfırlama butonu tehlikeli bir konumda

**Dosya:** [index.html#L587](file:///c:/Users/User/Desktop/Fitness%20Takip/index.html#L587)

"🗑️ Tüm Verileri Sıfırla" butonu **kırmızı renkli** ve profil sayfasının alt kısmında, "Dışa Aktar" ve "İçe Aktar" butonlarının hemen altında yer alıyor. Çift onay mekanizması var ama:
- Butonun konumu tehlikeli (yanlışlıkla basılma riski)
- `confirm()` diyalogları ham ve kaygısız görünüyor

> **Öneri:** Bu butonu bir `<details>` içinde gizleyin veya Ayarlar alt menüsüne taşıyın.

---

### 🟡 5.3 — API anahtarı plaintext olarak `localStorage`'da

**Dosya:** [app.js#L1583](file:///c:/Users/User/Desktop/Fitness%20Takip/app.js#L1583)

Gemini API anahtarı `state.profile.geminiApiKey` içinde doğrudan saklanıyor. Bu `localStorage`'da şifresiz metin olarak duruyor. "Dışa Aktar" ile indirilen JSON'da da açık metin olarak yer alıyor.

> **Öneri:** Dışa aktarma sırasında API anahtarını maskeleyerek veya hariç tutarak dışa aktarın.

---

## 6. Görsel ve Düzen Sorunları

### 🟡 6.1 — Haftalık program: Kart tıklama ile yeni plan ekleme yok

**Dosya:** [index.html#L165-L192](file:///c:/Users/User/Desktop/Fitness%20Takip/index.html#L165-L192)

Program sekmesindeki gün kartları yalnızca listeleme amaçlı. Bir güne tıklayarak o güne plan ekleme imkanı yok. Kullanıcının sayfanın üstündeki **"+ Antrenman Planla"** butonuna gidip tarihi orada seçmesi gerekiyor.

> **Öneri:** Her gün kartının içine küçük bir "+" butonu ekleyin veya karta tıklama ile modal açın.

---

### 🟡 6.2 — Diyet sekmesi: İki mod arası geçiş sezgisel değil

**Dosya:** [index.html#L205-L208](file:///c:/Users/User/Desktop/Fitness%20Takip/index.html#L205-L208)

"📋 Günlük Takip" ve "🗓️ Haftalık Plan" segmented control'ü var ama:
- İlk kullanımda bu iki modun ne farkı olduğu açık değil
- Açıklama metni sadece haftalık plan sekmesinin altında, 10px font ile zar zor okunuyor
- Günlük takipte "Tüketilen" ve "Planlanan" kavramları birbirine karışıyor

> **Öneri:** Her modun başına kısa ve anlaşılır bir açıklama banner'ı ekleyin.

---

### 🟡 6.3 — Inline stil fazlalığı: Tutarsız görünüm

**Dosyalar:** [index.html](file:///c:/Users/User/Desktop/Fitness%20Takip/index.html) (onlarca satır), [app.js](file:///c:/Users/User/Desktop/Fitness%20Takip/app.js) (JS ile yapılan element.style atamaları)

Birçok elemanda inline `style=""` kullanılıyor:
- [index.html#L77](file:///c:/Users/User/Desktop/Fitness%20Takip/index.html#L77): `style="width:auto; padding: 4px 10px; height: 32px; font-size:12px;"`
- [index.html#L111-L150](file:///c:/Users/User/Desktop/Fitness%20Takip/index.html#L111-L150): Kalori ring'i tamamı inline stil
- [app.js#L602-L608](file:///c:/Users/User/Desktop/Fitness%20Takip/app.js#L602-L608): JavaScript'te `element.style.xxx` ile stil atanıyor

Bu, bakımı zorlaştırıyor ve tutarsız görünüme yol açıyor.

> **Öneri:** Inline stilleri CSS sınıflarına taşıyın.

---

### 🟡 6.4 — Analiz sekmesi: Veri yokken boş/karışık görünüm

**Dosya:** [app.js#L2525-L2555](file:///c:/Users/User/Desktop/Fitness%20Takip/app.js#L2525-L2555)

Hiç antrenman veya vücut verisi girilmediğinde Analiz sekmesi:
- `0dk`, `0 km`, `0` gibi değerler gösteriyor
- Grafik alanlarında "Henüz veri girilmemiş" mesajı gösteriliyor ama genel özet kartları bos değer gösteriyor
- İlk kez gelen kullanıcıya "Analiz görmek için önce antrenman kaydet" gibi bir yönlendirme yok

> **Öneri:** Veri yokken bütünsel bir boş durum (empty state) ekranı gösterin; kullanıcıyı "Kaydet" sekmesine yönlendiren bir CTA butonuyla.

---

### 🟢 6.5 — AI antrenör chat alanı: Markdown render edilmiyor

**Dosya:** [app.js#L1668](file:///c:/Users/User/Desktop/Fitness%20Takip/app.js#L1668)

`appendChatMessage` fonksiyonu mesaj içeriğini `innerText` ile yazıyor. Hem yerel rapor hem de Gemini API yanıtı **markdown formatında** dönüyor (`**kalın**`, `### başlık`, `- madde` vb.) ama bunlar düz metin olarak gösteriliyor.

> **Öneri:** Basit bir markdown → HTML dönüştürücü ekleyin veya en azından `\n` karakterlerini `<br>` olarak render edin.

---

### 🟢 6.6 — Haftalık diyet planı: Gün kartlarında toplam kalori hesaplanmıyor

Haftalık diyet planlamasında her güne eklenen öğünlerin toplam kalorisi kartın başlığında gösterilmiyor. Kullanıcı her gün için ne kadar kalori planladığını göremez.

> **Öneri:** Gün kartının başlığına o günün toplam planlanan kalorisini (kcal badge) ekleyin.

---

### 🟢 6.7 — Besin arama sonuçları: Porsiyona göre besin değerleri kafa karıştırıcı

**Dosya:** [foods.js](file:///c:/Users/User/Desktop/Fitness%20Takip/foods.js)

Yerel besin listesinde bazı öğeler 100g bazlı, bazıları porsiyon bazlı:
- "Yumurta (1 adet, bütün, haşlanmış)" → 78 kcal (1 adet için)
- "Tavuk Göğsü (Izgara, 100g)" → 165 kcal (100g için)

Ama besin ekleme modalında miktar/birim sistemi **her zaman 100g bazlı hesaplama** yapıyor ([app.js#L992](file:///c:/Users/User/Desktop/Fitness%20Takip/app.js#L992)). Yani kullanıcı "1 porsiyon yumurta" seçtiğinde yumurta değeri 78 kcal × 1.5 = 117 kcal olarak hesaplanıyor ki bu yanlış.

> **Öneri:** Porsiyon bazlı besinler için 100g'a normalize edin veya `per_unit` alanı ekleyerek birim hesaplamasını düzeltin.

---

## Özet Tablosu

| # | Bulgu | Derece | Kategori |
|---|-------|--------|----------|
| 1.1 | 6 sekme — kalabalık alt navigasyon | 🔴 | Navigasyon |
| 1.2 | "Kaydet" sekmesi ismi belirsiz | 🟡 | Navigasyon |
| 1.3 | Tarih değişimi diğer sekmelere yansımıyor | 🟡 | Navigasyon |
| 1.4 | Antrenman kaydında tarih seçilemiyor | 🟡 | Form/Giriş |
| 1.5 | Çift "Antrenman Kaydet" giriş noktası | 🟢 | Navigasyon |
| 2.1 | Fitness süre alanı yok, yanlış tahmin | 🔴 | Form/Giriş |
| 2.2 | Yüzme/plan mesafe birimi karışıklığı | 🟡 | Form/Giriş |
| 2.3 | "Tüketilen Ekle" vs "Plana Ekle" karmaşası | 🟡 | Form/Giriş |
| 2.4 | RPE slider mobilde zor | 🟡 | Form/Giriş |
| 2.5 | Manuel besin ekleme gizli + yazım hatası | 🟡 | Form/Giriş |
| 2.6 | Onboarding "Geri" butonu yer kaplıyor | 🟢 | Form/Giriş |
| 3.1 | Silme: ham `confirm()` diyaloğu | 🔴 | Geri Bildirim |
| 3.2 | Doğrulama: ham `alert()` mesajları | 🟡 | Geri Bildirim |
| 3.3 | Kayıt sonrası form sıfırlanmıyor | 🟡 | Geri Bildirim |
| 3.4 | Boş vücut durumu kaydı yapılabiliyor | 🟢 | Geri Bildirim |
| 4.1 | Zoom devre dışı — erişilebilirlik engeli | 🔴 | Erişilebilirlik |
| 4.2 | Silme/Düzenleme butonları çok küçük | 🟡 | Erişilebilirlik |
| 4.3 | Scrollbar gizli — kaydırma fark edilmiyor | 🟡 | Erişilebilirlik |
| 4.4 | Tema: Auto moda geri dönüş yok | 🟢 | Erişilebilirlik |
| 5.1 | Tüm veri sadece localStorage'da | 🔴 | Veri Güvenliği |
| 5.2 | Sıfırlama butonu tehlikeli konumda | 🟡 | Veri Güvenliği |
| 5.3 | API anahtarı açık metin olarak saklanıyor | 🟡 | Veri Güvenliği |
| 6.1 | Program: Güne tıklayarak plan ekleme yok | 🟡 | Düzen |
| 6.2 | Diyet mod geçişi sezgisel değil | 🟡 | Düzen |
| 6.3 | Inline stil fazlalığı, tutarsızlık | 🟡 | Düzen |
| 6.4 | Analiz: Veri yokken boş durum yok | 🟡 | Düzen |
| 6.5 | AI chat: Markdown render edilmiyor | 🟢 | Düzen |
| 6.6 | Haftalık diyet: Toplam kalori eksik | 🟢 | Düzen |
| 6.7 | Besin hesaplama: Porsiyon/100g tutarsızlığı | 🟢 | Düzen |

---

> **Toplam: 5 Kritik 🔴 · 16 Orta 🟡 · 8 Düşük 🟢**

Bu bulguları öncelik sırasına göre düzeltmek isterseniz, bir uygulama planı hazırlayabilirim.
