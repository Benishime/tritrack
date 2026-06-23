# TriTrack APK Oluşturma ve Telefona Yükleme Planı

## Hedef
TriTrack PWA uygulamasını `.apk` dosyasına dönüştürüp telefonuna yüklemek.

## Sistem Durumu ✅

| Araç | Durum | Versiyon |
|------|-------|----------|
| Node.js | ✅ Yüklü | v24.14.0 |
| npm | ✅ Yüklü | 11.9.0 |
| Java JDK | ✅ Yüklü | 21.0.4 |
| Git | ✅ Yüklü | 2.53.0 |
| Bubblewrap | ❌ Yüklenmeli | — |
| GitHub Pages | ❌ Deploy edilmeli | — |

## Tahmini Süre: ~45–60 dakika

---

## Aşama 1 — Manifest ve İkon Düzeltmeleri ✅ TAMAMLANDI (v1.21)

> ✅ `manifest.json`: description, scope, lang, dir, categories + maskable ikon eklendi.
> ✅ `sw.js`: `icon-maskable-512.png` ASSETS'e eklendi, cache `v21`.
> ✅ `icon-maskable-512.png` mevcut. **Uygulama artık APK-hazır.** Sırada Aşama 2 (GitHub Pages deploy).

PWA'nın Android uygulamasına dönüşmesi için manifest dosyasında birkaç ekleme yapılmalı.

#### [MODIFY] [manifest.json](file:///c:/Users/User/Desktop/Fitness%20Takip/manifest.json)
- `description` alanı ekle
- `scope` alanı ekle  
- `lang` ve `categories` ekle
- Maskable ikon referansı ekle

#### [NEW] icon-maskable-512.png
- Mevcut `icon-512.png` dosyasından oluşturulacak
- Android'in adaptive icon sistemi için gerekli (yuvarlak/kare kırpma)

#### [MODIFY] [sw.js](file:///c:/Users/User/Desktop/Fitness%20Takip/sw.js)
- `ASSETS` listesine `icon-maskable-512.png` ekle
- Cache versiyonunu artır (`v12` → `v13`)

---

## Aşama 2 — GitHub Pages'e Deploy (10 dk)

APK oluşturmak için uygulamanın **canlı bir HTTPS URL'de** çalışıyor olması zorunlu. Bubblewrap bu URL'yi TWA (Trusted Web Activity) olarak paketler.

> [!IMPORTANT]
> GitHub hesabın var mı? Yoksa önce [github.com](https://github.com) adresinden ücretsiz hesap açman gerekiyor.

**Yapılacaklar:**
1. GitHub'da `tritrack` adında yeni bir **public** repo oluştur
2. Projeyi push et
3. Settings → Pages → main branch'ten deploy et
4. `https://KULLANICI_ADIN.github.io/tritrack/` adresinin çalıştığını doğrula

---

## Aşama 3 — Bubblewrap ile APK Oluşturma (25 dk)

### 3.1 — Bubblewrap CLI Kurulumu
```
npm i -g @nicolo-ribaudo/nicolo-bubblewrap
```

### 3.2 — Android proje klasörü oluştur ve init çalıştır
```
mkdir C:\Users\User\Desktop\tritrack-android
cd C:\Users\User\Desktop\tritrack-android
bubblewrap init --manifest=https://KULLANICI_ADIN.github.io/tritrack/manifest.json
```

İlk çalıştırmada Android SDK otomatik indirilecek (~500 MB, 5-10 dk).

### 3.3 — APK Derle
```
bubblewrap build
```

Çıktı dosyaları:
- `app-release-signed.apk` ← **Telefona yüklenecek dosya**
- `app-release-bundle.aab` ← Play Store için (şimdilik gerek yok)

---

## Aşama 4 — Digital Asset Links (5 dk)

TWA uygulamasının URL bar göstermemesi için doğrulama dosyası gerekiyor.

#### [NEW] .well-known/assetlinks.json
- Bubblewrap'in build sonrasında verdiği SHA-256 parmak izini içerecek
- GitHub Pages'e push edilecek

> [!WARNING]
> Bu adım atlanırsa uygulama çalışır ama üstte bir **URL bar** görünür (tarayıcı gibi). Assetlinks doğru yapılırsa tam ekran (standalone) açılır.

---

## Aşama 5 — APK'yı Telefona Yükleme (5 dk)

1. `app-release-signed.apk` dosyasını telefona aktar (USB kablo, WhatsApp, Google Drive vb.)
2. Telefonda: Ayarlar → Güvenlik → "Bilinmeyen kaynaklardan yükleme"yi etkinleştir
3. APK dosyasına dokun ve "Yükle" butonuna bas
4. Uygulama ana ekrana eklenir ve tam ekran çalışır

---

## Doğrulama Planı

- [ ] Uygulama ana ekranda ikon olarak görünüyor
- [ ] Tam ekran açılıyor (URL bar yok)
- [ ] Tüm sekmeler çalışıyor (Bugün, Program, Diyet, Kaydet, Analiz, Profil)
- [ ] Veri kaydı yapılabiliyor (localStorage çalışıyor)
- [ ] Çevrimdışı mod çalışıyor (WiFi kapatınca bile açılıyor)

---

## Açık Sorular

> [!IMPORTANT]
> Devam etmeden önce bunları netleştirmemiz gerekiyor:
> 1. **GitHub hesabın var mı?** (Yoksa birlikte oluşturalım)
> 2. **Uygulama paket adı ne olsun?** Örn: `com.tritrack.app` veya `com.senin_adin.tritrack`
> 3. **Telefonun Android mi?** (iOS için APK çalışmaz, farklı yöntem gerekir)
