# 🟧 Strava Canlı Senkron — Kurulum (Kişisel)

Bu rehber, **kendi** Huawei/Strava antrenmanlarını TriTrack'e otomatik çekmek içindir.
Strava yeni uygulamaları "tek sporcu" (Single Player Mode) ile sınırlar — kişisel kullanım için bu **yeterli ve ücretsiz**.

Veri yolu: **Huawei saat → Huawei Health → Strava → TriTrack**.

---

## Adım 0 — Huawei → Strava (kod yok)
1. **Huawei Health** uygulaması → **Ben → Ayarlar → Üçüncü taraf uygulamalar** (veya "Veri paylaşımı") → **Strava**'yı bağla.
   - Bölgende Strava görünmüyorsa, desteklenen bir ülke (örn. İngiltere) Huawei ID'si ile dene.
2. Artık her antrenman otomatik Strava'ya düşer. (Tek seferlik geçmiş için: Huawei Health'te antrenmanı aç →
   rota → **GPX/TCX dışa aktar** → TriTrack Profil → **GPX/TCX Yükle**.)

> Sadece bunu yapıp dosya yüklemeyle devam edebilirsin. Aşağıdaki adımlar **otomatik** çekme içindir.

---

## Adım 1 — Strava API uygulaması oluştur (1 kez, ~3 dk)
1. https://www.strava.com/settings/api adresine gir.
2. Uygulama oluştur:
   - **Application Name:** TriTrack (veya istediğin)
   - **Category:** Training / Data Importer
   - **Authorization Callback Domain:** *Worker'ı yayınladıktan sonra* alacağın alan adı
     (örn. `tritrack-strava-proxy.<hesabın>.workers.dev`). Şimdilik boş geçme, Adım 2 sonrası gir.
3. Sana verilen **Client ID** ve **Client Secret**'i not al.

## Adım 2 — Proxy'yi yayınla (Cloudflare Workers, ücretsiz)
`strava-proxy/` klasöründeki Worker, secret'i güvenle saklar (tarayıcıya hiç gitmez).
```bash
npm i -g wrangler
cd strava-proxy
wrangler login
wrangler secret put STRAVA_CLIENT_ID       # Adım 1'deki Client ID
wrangler secret put STRAVA_CLIENT_SECRET    # Adım 1'deki Client Secret
wrangler deploy
```
Çıktıdaki URL'yi not al, örn: `https://tritrack-strava-proxy.adin.workers.dev`
→ Bu alan adını **Adım 1'deki "Authorization Callback Domain"** alanına yaz (sadece domain, `https://` yok).

## Adım 3 — TriTrack'i proxy'ye bağla
1. [app.js](app.js) içindeki `STRAVA_PROXY_URL` sabitini yayınladığın Worker URL'siyle değiştir
   (veya uygulama açıldıktan sonra Profil → Strava kartındaki alana yapıştır — kalıcı saklanır).
2. TriTrack'i **canlı HTTPS** adresinde aç (GitHub Pages — bkz. `implementation_plan.md`). OAuth dönüşü
   için uygulamanın gerçek bir `https://` adresi gerekir (localhost'ta da çalışır ama telefonda Pages önerilir).
3. **Profil → 🟧 Strava'yı Bağla** → Strava onayı → geri dönünce **Son antrenmanları çek**.

---

## Güvenlik notu
- `Client Secret` yalnızca Worker'da (Cloudflare) durur, tarayıcıya/koda **hiç girmez**.
- `refresh_token` senin cihazının `localStorage`'ında saklanır (Gemini API anahtarı gibi). Yedek (Dışa Aktar)
  dosyasını paylaşırken dikkat et.
- Strava API sözleşmesi gereği Strava kaynaklı ham antrenman verisi **AI Asistan'a gönderilmez**
  (uygulama bunu otomatik dışlar).
