# TriTrack — Çalışma Düzeni (Git + Çoklu Yapay Zeka + Sub-Agent) 🧭

Bu dosya, projede **geçmişe rahat dönebilmek** ve **birden fazla yapay zeka** ile
karışmadan çalışabilmek için kuralları tanımlar.

---

## 🌿 Dal (Branch) Yapısı

| Dal | Amaç | Kural |
|-----|------|-------|
| `main` | **Kararlı / yayın** sürümü. Her zaman çalışır durumda. | Doğrudan commit YOK. Sadece `gelistirme`'den birleştirilir. |
| `gelistirme` | Aktif geliştirme. Biten özellikler buraya gelir. | Test edilmiş özellikler birleştirilir. |
| `ozellik/<isim>` | Tek bir özellik/iş. Örn: `ozellik/kilo-grafigi` | İş bitince `gelistirme`'ye merge → dal silinir. |

**Akış:** `ozellik/...` → (test) → `gelistirme` → (test) → `main` → (etiketle).

---

## 🏷️ Etiketler (Tag) — Geçmişe Dönüşün Kolay Yolu

Her kararlı/önemli noktada etiket atılır. Eski bir sürüme dönmek için:

```bash
git tag                      # tüm etiketleri listele
git log --oneline            # commit geçmişi
git checkout v1.0            # o sürümü görüntüle (salt-okunur)
git switch -c eski-deneme v1.0   # o sürümden yeni dal aç (üzerinde çalış)
git switch main              # geri dön
```

Mevcut etiketler:
- `v1.0` — Faz 0–3 tamamlandı (stabilizasyon, yedekleme, GPX import, analiz).

---

## ✍️ Commit Mesaj Kuralı

Kısa, Türkçe, başına tip ekle. Birden fazla AI kullanıldığında **hangi AI** olduğunu da yaz:

```
<tip>: <kısa açıklama>  [AI: <isim>]

tipler: faz | ozellik | duzeltme | refactor | dok | stil
örnek:  ozellik: kilo trendi grafiği eklendi  [AI: Claude]
örnek:  duzeltme: diyet birim hesabı düzeltildi  [AI: Gemini]
```

> Önemli her değişiklikte `GELISTIRME-GUNLUGU.md` de güncellenir.

---

## 🤖 Çoklu Yapay Zeka ile Çalışma Sistemi

Birden fazla AI (Claude, Gemini, ChatGPT vb.) kullanırken **çakışmayı önlemek** için:

1. **Her AI kendi `ozellik/...` dalında çalışır.** Aynı anda `main`'e dokunmazlar.
2. **Tek görev = tek dal.** İş bitince `gelistirme`'ye merge edilir, dal kapatılır.
3. **Commit'te AI adı belirtilir** (yukarıdaki kural) — kimin ne yaptığı bellidir.
4. **Aynı dosyada paralel çalışmaktan kaçının.** Mümkünse işleri dosya/bölüm bazında ayırın
   ([app.js](app.js) numaralı bölümlere ayrılmıştır — bu ayrım işi bölmeyi kolaylaştırır).
5. **Birleştirmeden önce test:** sunucuyu açıp (`py -m http.server 8000`) ilgili özelliği dene.
6. Çakışma olursa: `gelistirme`'yi temel al, değişikliği oradan yeniden uygula.

---

## 🧩 Sub-Agent (Alt Ajan) Kullanımı

Claude Code içinde tek seferde, izole/paralel iş için sub-agent kullanılabilir.
**Sub-agent ancak açıkça istenince başlatılır.** Ne zaman mantıklı:

- **Geniş araştırma/tarama** ("tüm projede şu deseni bul", "X nasıl yapılır araştır") → `Explore` veya `general-purpose`.
- **İzole özellik geliştirme** → ayrı bir git worktree'de (`isolation: worktree`) çalışıp ana dalı bozmadan.
- **Mimari/plan çıkarma** → `Plan` ajanı.

Nasıl istenir (örnek): *"kilo grafiği özelliğini bir sub-agent ile ayrı worktree'de geliştir."*

> Not: Her sub-agent sıfırdan başlar (bağlamı yeniden kurar) → token maliyeti artar.
> Bu yüzden küçük işleri doğrudan yapmak, sadece gerçekten paralel/izole işleri sub-agent'a
> vermek daha verimli.

---

## ⚡ Sık Kullanılan Komutlar

```bash
# Yeni özelliğe başla
git switch gelistirme
git switch -c ozellik/yeni-sey

# Kaydet
git add -A
git commit -m "ozellik: ... [AI: Claude]"

# Özelliği geliştirmeye birleştir
git switch gelistirme
git merge ozellik/yeni-sey
git branch -d ozellik/yeni-sey

# Kararlı sürümü yayınla + etiketle
git switch main
git merge gelistirme
git tag v1.1
```
