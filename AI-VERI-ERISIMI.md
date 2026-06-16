# 🤖 AI Asistan — Veri Erişimi ve Yetenekleri

> **Kısa cevap (v1.18+):**
> - **Okuma:** AI hem güncel özetini görür hem de **geçmiş günleri sorgulayabilir** (`gunVerisiniGetir`).
> - **Yazma:** ✅ **VAR — ama her zaman SENİN ONAYINLA.** AI antrenman/plan/besin/vücut durumu/hedef
>   ekleyebilir; ancak önce sohbette bir **onay kartı** çıkarır, sen **✅ Onayla**'ya basana kadar
>   hiçbir şey kaydedilmez.
>
> *(Yalnızca Gemini API anahtarı girili "Bulut modu"nda geçerlidir. Anahtarsız yerel modda AI hiçbir
> şey yazamaz/çağıramaz.)*

Bu dosya, **🤖 Asistan** sekmesindeki AI Koç'un (Google Gemini) tam olarak hangi bilgilere
eriştiğini ve neyi yapıp yapamayacağını açıklar. Tüm bilgiler kaynak kod
([app.js](app.js) — `gatherCoachData`, `coachReportPrompt`, `handleCoachChat`, `callGeminiAPI`)
incelenerek hazırlanmıştır.

---

## 1. AI Hangi Bilgilere Erişiyor?

AI verilerine doğrudan bağlanmaz; her istekte uygulama, o anki bir **anlık özet (snapshot)**
hazırlayıp metin olarak Gemini'ye gönderir.

### "⚡ Verilerimi Analiz Et" (rapor) gönderilen veriler
| Kategori | Gönderilen |
|----------|------------|
| **Profil** | İsim, kilo, günlük kalori hedefi, makro hedefleri (P/C/Y) |
| **Bugünkü diyet** | Toplam kalori, protein, karbonhidrat, yağ (*hangi besinleri yediğin değil, sadece toplamlar*) |
| **Bugünkü vücut** | Uyku saati, uyku puanı, HRV |
| **7 günlük ortalama** | Uyku, uyku puanı, HRV ortalamaları |
| **Haftalık yük** | Bu hafta ve geçen hafta toplam antrenman dakikası |
| **Hazır olma** | Uygulamanın hesapladığı 🟢/🟡/🔴 durumu + gerekçeleri |
| **Son 6 antrenman** | Tarih, branş, süre, mesafe, RPE ve **notların** |

### Sohbet kutusuna soru yazınca gönderilenler
- Yukarıdakilerin kısa bir özeti (bugünkü uyku/puan/HRV, bugünkü kalori+protein, haftalık yük, hazır olma)
- **Senin yazdığın soru**

---

## 2. AI Neyi GÖRMÜYOR?

Aşağıdakiler Gemini'ye **gönderilmez**:

- Geçmiş günlerin tek tek kayıtları (sadece bugünkü değerler + 7 günlük *ortalama* gider)
- Hangi besinleri yediğinin **isim listesi** (sadece günlük toplam kalori/makro gider)
- Diyet planların ve haftalık diyet planın
- Antrenman programın (Program sekmesi / planlanan antrenmanlar)
- Fitness antrenmanlarının egzersiz detayları (set/tekrar/kilo)
- 6'dan eski antrenmanlar, kilo geçmişi, tüm geçmiş veriler
- Yedek dosyaların / ham `localStorage` içeriğin

---

## 3. AI'nın Yazma / Değiştirme Yeteneği (v1.18+)

**Evet — ama insan onayıyla.** AI artık **Gemini Function Calling (araç çağrısı)** ile şunları yapabilir:

| Araç | Ne yapar | Onay? |
|------|----------|:---:|
| `antrenmanEkle` | Yapılan antrenman kaydeder | ✅ |
| `antrenmanPlaniEkle` | İleri/bugün için plan ekler | ✅ |
| `vucutDurumuKaydet` | Uyku/uyku puanı/HRV/kilo kaydeder | ✅ |
| `besinEkle` | Tüketilen besin ekler | ✅ |
| `hedefGuncelle` | Kalori/makro hedefini günceller | ✅ |
| `gunVerisiniGetir` | Bir günün verisini **okur** | onay yok (okuma) |

**Akış:** Sen *"bugün 10 km koştum"* yazarsın → AI `antrenmanEkle` aracını çağırır → uygulama
sohbette **"🏃 10 km koşu, bugün — eklensin mi? [✅ Onayla] [✖ Vazgeç]"** kartı gösterir →
sen onaylarsan kaydedilir, vazgeçersen **hiçbir şey olmaz**.

**Güvenlik:**
- Yazma işlemleri **asla otomatik uygulanmaz**; her biri tek tek onaylanır (`aiConfirmAction`).
- Silme/sıfırlama gibi yıkıcı işlemler AI'ya **hiç verilmedi** (sadece ekleme/güncelleme).
- AI hâlâ sınırlı: yalnızca tanımlı 6 aracı kullanabilir, başka bir şeye erişemez.

> İlgili kod: [app.js](app.js) "9.5. AI ASİSTAN ARAÇLARI" bölümü — `AI_TOOLS`, `runAssistantAgent`,
> `aiConfirmAction`, `geminiGenerate` ve `aiAddWorkout`/`aiAddPlan`/`aiSetBody`/`aiAddFood`/`aiUpdateGoals`.

---

## 4. Gizlilik

- **Bulut modu (API anahtarı girili):** Yukarıdaki özet **Google'ın Gemini sunucularına** gönderilir.
  Yani bu veriler bulut moddayken cihazından çıkar. (Google'ın API gizlilik şartları geçerlidir.)
- **Yerel mod (anahtar yok):** **Hiçbir veri cihazından çıkmaz**; analiz tamamen tarayıcıda,
  kural tabanlı yapılır.
- **API anahtarın** yalnızca tarayıcının `localStorage`'ında saklanır ve her istekte doğrudan
  Google'a (başka hiçbir sunucuya değil) gönderilir.
- ⚠️ **Yedek (Dışa Aktar) dosyası** API anahtarını açık metin içerir — yedeği paylaşmadan önce dikkat et.

---

## 5. Teknik Detay

| | |
|--|--|
| **Sağlayıcı** | Google Gemini (Generative Language API) |
| **Model** | `gemini-2.5-flash` (kodda `GEMINI_MODEL` sabiti) |
| **Uç nokta** | `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent` |
| **Kimlik** | URL'deki `?key=` ile API anahtarın |
| **Araç/Fonksiyon çağrısı** | **Var** — 6 araç (5 yazma + 1 okuma), her yazma onaylı |
| **İlgili kod** | [app.js](app.js): `gatherCoachData`, `coachReportPrompt`, `runAssistantAgent`, `AI_TOOLS`, `geminiGenerate` |

---

*Özet: AI senin spor/sağlık verilerini **okur, yorumlar** ve **senin onayınla kayıt yapabilir**.
Onaylamadığın hiçbir şey kaydedilmez; son söz her zaman sende.*
