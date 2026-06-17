# 👤 Kullanıcı Hesabı + Bulut Senkron — Kurulum (Supabase)

TriTrack'i çok kullanıcılı yapar: herkes kendi hesabıyla girer, verisi buluta kaydolur, cihaz değiştirince taşınır.
**Ücretsiz** Supabase katmanı yeter. (Hesapsız "Misafir" modu da korunur — o veride bulut yoktur.)

---

## Adım 1 — Supabase projesi (1 kez, ~3 dk)
1. https://supabase.com → giriş → **New project** (ad + güçlü DB parolası seç, bölge: en yakın).
2. Proje açılınca sol menü **Project Settings → API**:
   - **Project URL** (örn. `https://xxxx.supabase.co`)
   - **anon public** anahtarı (uzun `eyJ...` jetonu)
   Bunları not al. (anon anahtarı tarayıcıya konması güvenlidir; veri güvenliği RLS ile sağlanır.)

## Adım 2 — Veritabanı tablosu + güvenlik
Sol menü **SQL Editor → New query** → `db/schema.sql` dosyasının içeriğini yapıştır → **Run**.
(Bu, `user_data` tablosunu ve "herkes yalnız kendi verisi" RLS politikalarını kurar.)

## Adım 3 — Giriş yöntemi
Sol menü **Authentication → Providers → Email**'i aç (varsayılan açıktır).
- Test kolaylığı için **Authentication → Settings**'te "Confirm email"i kapatabilirsin (yayında açık tut).
- (Opsiyonel, Faz B) Google ile giriş: Google provider'ı buradan eklenir.

## Adım 4 — TriTrack'e bağla
[app.js](app.js) başındaki sabitleri doldur:
```js
const SUPABASE_URL = 'https://xxxx.supabase.co';
const SUPABASE_ANON_KEY = 'eyJ...';
```
> Boş bırakılırsa uygulama **tamamen yerel** (eski davranış) çalışır; hesap ekranı çıkmaz.

## Adım 5 — Dene
Uygulamayı aç → **Kayıt Ol** → birkaç veri gir → Supabase **Table Editor → user_data**'da satırın `data` alanı dolmalı.
Başka tarayıcıda aynı hesapla giriş → veriler gelmeli.

---

## Notlar
- **Gizlilik:** Veri artık Supabase'e (RLS ile izole) gider. Gemini API anahtarın ve Strava refresh token'ın
  **buluta gönderilmez**, cihazda kalır.
- **Strava:** Çok kullanıcılı olsa da Strava canlı senkronu Strava'nın "tek sporcu" kuralı yüzünden yalnız
  uygulama sahibinde çalışır; diğer kullanıcılar GPX yükleme + elle giriş kullanır.
- **Çakışma:** Aynı hesabı iki cihazda çevrimdışı düzenleyip ikisini de senkronlarsan **son kaydeden kazanır**.
