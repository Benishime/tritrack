import { SPORT_META, addDaysStr, avgOf, computeAcwr, computeFitnessFatigue, dailyLoadOn, holisticValues, mondayOf, workoutLoad } from './analysis.js';
import { refreshDietUI } from './diet.js';
import { computePacePer100m, computePacePerKm, computeSpeed } from './importgpx.js';
import { escapeHtml, renderProgramView } from './program.js';
import { currentDateStr, generateId, parseLocalDate, saveState, state } from './state.js';
import { renderTodayView } from './today.js';
import { showToast } from './utils.js';

// ==========================================
// 9. GEMINI AI ANTRENÖR ZEKASI (CLOUD & LOCAL)
// ==========================================

export function appendChatMessage(sender, text) {
  const container = document.getElementById('ai-chat-output');
  const msgEl = document.createElement('div');
  msgEl.className = `ai-message message-${sender}`;

  if (sender === 'user') {
    msgEl.style.alignSelf = 'flex-end';
    msgEl.style.backgroundColor = 'var(--accent-blue)';
    msgEl.style.color = '#fff';
    msgEl.style.borderRadius = '12px 12px 0 12px';
  } else {
    msgEl.style.alignSelf = 'flex-start';
    msgEl.style.backgroundColor = 'var(--bg-primary)';
    msgEl.style.color = 'var(--text-primary)';
    msgEl.style.borderRadius = '12px 12px 12px 0';
  }
  msgEl.style.padding = '8px 12px';
  msgEl.style.maxWidth = '85%';
  msgEl.style.lineHeight = '1.4';
  msgEl.style.border = '1px solid var(--card-border)';
  msgEl.style.wordBreak = 'break-word';
  msgEl.innerHTML = (sender === 'user') ? escapeHtml(text) : renderMarkdownLite(text);

  container.appendChild(msgEl);
  container.scrollTop = container.scrollHeight;
}

// Basit markdown → HTML (önce HTML kaçışı, sonra **kalın**, ### başlık, - madde, satır sonu)
export function renderMarkdownLite(text) {
  return escapeHtml(text)
    .replace(/^###\s+(.*)$/gm, '<strong>$1</strong>')
    .replace(/^##\s+(.*)$/gm, '<strong>$1</strong>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/^\s*[-*]\s+/gm, '• ')
    .replace(/\n/g, '<br>');
}

// Güncel Gemini modeli (gerekirse buradan değiştir). 2026-06: 2.0 modelleri kapatıldı → 3.5-flash.
export const GEMINI_MODEL = 'gemini-3.5-flash'; // gemini agent'in varsayilani (geri uyum)

// --- Çoklu AI sağlayıcı (A+D) ---
export const AI_PROVIDERS = {
  gemini: { label: 'Google Gemini', defaultModel: 'gemini-3.5-flash', keyField: 'geminiApiKey', tools: true },
  claude: { label: 'Anthropic Claude', defaultModel: 'claude-sonnet-4-6', keyField: 'claudeApiKey', tools: false },
  openai: { label: 'OpenAI GPT', defaultModel: 'gpt-4o', keyField: 'openaiApiKey', tools: false }
};
export function aiProvider() { return AI_PROVIDERS[state.profile.aiProvider] ? state.profile.aiProvider : 'gemini'; }
export function aiModel() { return (state.profile.aiModel || '').trim() || AI_PROVIDERS[aiProvider()].defaultModel; }
export function aiKey() { return state.profile[AI_PROVIDERS[aiProvider()].keyField] || ''; }
export function aiSupportsTools() { return AI_PROVIDERS[aiProvider()].tools; }

// Uzman koçluk bilgi tabanı (B) — her prompt'a gömülür, modeli "uzman" yapar
export const COACHING_KB = `UZMAN İLKELERİ (bunlara göre yönlendir):
- Periyotlama: Base (uzun, düşük yoğunluk, hacim kur) → Build (eşik/VO2max kalite ekle) → Peak (yarışa özgü kalite, hacmi koru) → Taper (son 1-3 hafta hacmi %40-60 düşür, yoğunluğu koru).
- Yoğunluk dağılımı kutuplaşmış olsun: ~%80 düşük (Z1-Z2 kolay), ~%20 yüksek (Z4-Z5). Sürekli "orta" (Z3) tuzaktır.
- Yük artışı: haftalık toplamı %10'dan fazla artırma. ACWR (akut/kronik) 0.8-1.3 güvenli; >1.5 ciddi sakatlık riski → net azalt de.
- Toparlanma: HRV ortalamanın altında veya uyku <7sa ise yoğunluğu düşür/dinlen. Form/TSB çok negatifse (<-20) dinlenme günü şart. Uyku 7-9 saat.
- Yakıtlama: >90 dk seansta saatte 60-90 g karbonhidrat; seans sonrası ilk 60 dk ~1 g/kg karb + 0.3 g/kg protein.
- Zone'lar eşiklerden gelir: koşu eşik temposu, bisiklet FTP, genel LTHR. Eşik yoksa kullanıcıyı test/girişe yönlendir.
- Beslenme: antrenman yoğunluğuna göre karb; protein ~1.6-2.0 g/kg/gün kas onarımı için.`;

export function fmtNum(v, dec) {
  if (v == null) return '-';
  const k = Math.pow(10, dec);
  return Math.round(v * k) / k;
}

// Belirli bir haftanın (Pazartesi başlangıçlı) toplam antrenman dakikası
export function weekMinutes(monday) {
  const end = addDaysStr(monday, 6);
  return Math.round(state.workouts
    .filter(w => w.date >= monday && w.date <= end)
    .reduce((a, w) => a + (w.duration || 0) / 60, 0));
}

// Bugünün "hazır olma" durumu: uyku süresi + uyku puanı + HRV (14 günlük baz ile)
export function computeReadiness() {
  const b = state.holisticLogs[currentDateStr] || {};
  const sleep = b.sleep, score = b.sleepScore, hrv = b.hrv;
  const hrvBase = avgOf(holisticValues('hrv', 1, 14));
  let pts = 0, max = 0;
  const reasons = [];

  if (typeof sleep === 'number') {
    max++;
    if (sleep >= 7.5) pts++;
    else if (sleep >= 6.5) { pts += 0.5; reasons.push('uyku biraz kısa'); }
    else reasons.push('uyku yetersiz');
  }
  if (typeof score === 'number') {
    max++;
    if (score >= 80) pts++;
    else if (score >= 65) { pts += 0.5; reasons.push('uyku kalitesi orta'); }
    else reasons.push('uyku kalitesi düşük');
  }
  if (typeof hrv === 'number') {
    max++;
    if (hrvBase) {
      if (hrv >= hrvBase * 0.95) pts++;
      else if (hrv >= hrvBase * 0.85) { pts += 0.5; reasons.push('HRV ortalamanın altında'); }
      else reasons.push('HRV belirgin düşük');
    } else if (hrv >= 55) pts++;
    else { pts += 0.5; reasons.push('HRV düşük'); }
  }

  if (max === 0) return null;
  const ratio = pts / max;
  if (ratio >= 0.8) return { label: 'Hazır', emoji: '🟢', ratio, reasons };
  if (ratio >= 0.5) return { label: 'Orta', emoji: '🟡', ratio, reasons };
  return { label: 'Dinlen', emoji: '🔴', ratio, reasons };
}

// Antrenör için tüm bağlamı topla
// Hedef yarış bilgisi (gün/hafta/faz) — AI bağlamı ve kart için
export function getRaceInfo() {
  const date = state.profile.raceDate;
  if (!date) return null;
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const race = parseLocalDate(date); race.setHours(0, 0, 0, 0);
  const days = Math.round((race - today) / 86400000);
  if (days < 0) return { name: state.profile.raceName || 'Yarış', daysLeft: days, phase: 'geçti' };
  const weeks = Math.max(1, Math.ceil(days / 7));
  const phase = weeks > 12 ? 'Base (temel)' : weeks > 4 ? 'Build (geliştirme)' : weeks > 1 ? 'Peak (zirve)' : 'Taper (tazelenme)';
  return { name: state.profile.raceName || 'Yarış', daysLeft: days, weeks, phase };
}

export function gatherCoachData() {
  const todayDiet = state.diet.filter(f => f.date === currentDateStr);
  const diet = { cal: 0, p: 0, c: 0, f: 0 };
  todayDiet.forEach(f => { diet.cal += f.calories; diet.p += f.protein; diet.c += f.carbs; diet.f += f.fat; });

  const thisMon = mondayOf(currentDateStr);
  const ff = computeFitnessFatigue(1);
  const acwr = computeAcwr();
  let weekTss = 0;
  for (let i = 0; i < 7; i++) weekTss += dailyLoadOn(addDaysStr(thisMon, i));
  const p = state.profile;

  return {
    diet,
    body: state.holisticLogs[currentDateStr] || {},
    avg7: {
      sleep: avgOf(holisticValues('sleep', 0, 6)),
      score: avgOf(holisticValues('sleepScore', 0, 6)),
      hrv: avgOf(holisticValues('hrv', 0, 6))
    },
    load: { thisWeek: weekMinutes(thisMon), lastWeek: weekMinutes(addDaysStr(thisMon, -7)) },
    form: Math.round(ff.form), ctl: Math.round(ff.ctl), atl: Math.round(ff.atl),
    acwr: acwr != null ? Math.round(acwr * 100) / 100 : null,
    weekTss: Math.round(weekTss),
    race: getRaceInfo(),
    thresholds: { lthr: p.lthr || null, ftp: p.ftp || null, thresholdPace: p.thresholdPace || null, maxHr: p.maxHr || null },
    // Kişisel kullanım kararı: tüm antrenmanlar (Strava dahil, notlarıyla) AI'a verilir.
    recent: state.workouts.slice().sort((a, b) => (a.date < b.date ? 1 : -1)).slice(0, 6),
    readiness: computeReadiness()
  };
}

// Gemini için zengin rapor istem metni
export function coachReportPrompt(d) {
  const p = state.profile;
  const r = d.readiness;
  const recentTxt = d.recent.length
    ? d.recent.map(w => `- ${w.date} · ${(SPORT_META[w.sport] || { name: w.sport }).name} · ${Math.round((w.duration || 0) / 60)}dk · ${w.distance || 0}${w.sport === 'swim' ? 'm' : 'km'} · RPE ${w.rpe || '-'}/10${w.notes ? ` · not: ${w.notes}` : ''}`).join('\n')
    : 'Son antrenman kaydı yok.';

  return `Sen triatlet ve koşucular için SERT, doğrudan ve mazeret kabul etmeyen profesyonel bir antrenörsün. Türkçe; lafı dolandırma, gerçeği açıkça söyle, gevşekliği/eksiği yüzüne vur ve somut görev ver — ama aşağılama yok, sağlık önceliklidir.

${COACHING_KB}

SPORCU: ${p.name}, ${p.weight} kg
HEDEF: ${p.targetDailyCalories} kcal/gün (P:${p.targetMacros.protein} C:${p.targetMacros.carbs} Y:${p.targetMacros.fat} g)

BUGÜN DİYET: ${Math.round(d.diet.cal)} kcal · P:${Math.round(d.diet.p)}g C:${Math.round(d.diet.c)}g Y:${Math.round(d.diet.f)}g
BUGÜN VÜCUT: uyku ${d.body.sleep != null ? d.body.sleep : '-'} saat, uyku puanı ${d.body.sleepScore != null ? d.body.sleepScore : '-'}/100, HRV ${d.body.hrv != null ? d.body.hrv : '-'} ms
7 GÜN ORT.: uyku ${fmtNum(d.avg7.sleep, 1)} saat, uyku puanı ${fmtNum(d.avg7.score, 0)}, HRV ${fmtNum(d.avg7.hrv, 0)} ms
HAFTALIK YÜK: bu hafta ${d.load.thisWeek} dk (~${d.weekTss} TSS), geçen hafta ${d.load.lastWeek} dk
FORM & YÜK: Form/TSB ${d.form}, Fitness/CTL ${d.ctl}, Yorgunluk/ATL ${d.atl}${d.acwr != null ? `, ACWR ${d.acwr}` : ''}
HAZIR OLMA (hesaplanan): ${r ? `${r.label}${r.reasons.length ? ' (' + r.reasons.join(', ') + ')' : ''}` : 'veri yetersiz'}
${d.race ? `HEDEF YARIŞ: ${d.race.name} — ${d.race.daysLeft >= 0 ? d.race.daysLeft + ' gün (' + d.race.phase + ' dönemi)' : 'geçti'}` : ''}
${(d.thresholds.lthr || d.thresholds.ftp || d.thresholds.thresholdPace) ? `EŞİKLER: ${[d.thresholds.lthr ? 'LTHR ' + d.thresholds.lthr : '', d.thresholds.ftp ? 'FTP ' + d.thresholds.ftp + 'w' : '', d.thresholds.thresholdPace ? 'eşik tempo ' + d.thresholds.thresholdPace : ''].filter(Boolean).join(', ')}` : ''}

SON ANTRENMANLAR:
${recentTxt}

Bu verilere göre kısa, maddeli bir rapor yaz:
1. Beslenme: hedeflerle uyum (özellikle protein ve karbonhidrat yeterli mi?).
2. Toparlanma & yük: uyku/HRV + Form(TSB) + ACWR'ye göre hazır olma ve aşırı yüklenme riski. (ACWR>1.5 ise net uyar; Form çok negatifse dinlenme öner.)
3. Bugün/yarın önerisi: ${d.race ? 'yarışa kalan süre ve döneme (' + (d.race.phase || '-') + ') uygun, ' : ''}haftalık yük ve son RPE'lere göre yoğunluğu artır/azalt.
Gereksiz uzatma; doğrudan, uygulanabilir öneriler ver.`;
}

// Bir haftanın (Pazartesi) özeti
export function weekSummary(mondayStr) {
  const end = addDaysStr(mondayStr, 6);
  const wk = state.workouts.filter(w => w.date >= mondayStr && w.date <= end);
  let sec = 0, km = 0, tss = 0;
  wk.forEach(w => { sec += w.duration || 0; if (w.sport === 'run' || w.sport === 'bike') km += (w.distance || 0); tss += workoutLoad(w); });
  return { sessions: wk.length, min: Math.round(sec / 60), km: Math.round(km * 10) / 10, tss: Math.round(tss) };
}

export function weeklyLocalReport(lw, tw, d) {
  let s = `### 📊 Haftalık Rapor\n\n`;
  s += `**Geçen hafta:** ${lw.sessions} antrenman · ${lw.min} dk · ${lw.km} km · ${lw.tss} TSS\n`;
  s += `**Bu hafta:** ${tw.sessions} antrenman · ${tw.tss} TSS\n`;
  s += `**Form (TSB):** ${d.form}${d.acwr != null ? ` · ACWR ${d.acwr}` : ''}\n\n`;
  if (d.acwr != null && d.acwr > 1.5) s += `⚠️ ACWR yüksek (${d.acwr}) — yükü birkaç gün hafiflet, sakatlık riski.\n`;
  else if (d.form > 5) s += `Tazesin; bu hafta kaliteli/yoğun bir seans ekleyebilirsin.\n`;
  else if (d.form < -15) s += `Form düşük; bu hafta toparlanmaya ağırlık ver.\n`;
  else s += `Denge iyi; planına devam et, haftalık yükü %10'dan fazla artırma.\n`;
  return s;
}

export function generateWeeklyReport() {
  const container = document.getElementById('ai-chat-output');
  const loader = document.createElement('div');
  loader.className = 'ai-message message-bot loader-msg';
  loader.style.padding = '8px 12px';
  loader.innerHTML = 'Haftalık rapor hazırlanıyor...';
  container.appendChild(loader);
  container.scrollTop = container.scrollHeight;

  const p = state.profile;
  const d = gatherCoachData();
  const thisMon = mondayOf(currentDateStr);
  const lw = weekSummary(addDaysStr(thisMon, -7));
  const tw = weekSummary(thisMon);

  const prompt = `Sen SERT, doğrudan ve mazeret kabul etmeyen bir antrenörsün. Türkçe, kısa ve maddeli yaz; eksiği/gevşekliği açıkça söyle, net görev ver — ama yapıcı ve sağlık öncelikli.
${COACHING_KB}
SPORCU: ${p.name}, ${p.weight} kg
GEÇEN HAFTA: ${lw.sessions} antrenman · ${lw.min} dk · ${lw.km} km · ${lw.tss} TSS
BU HAFTA (şu ana dek): ${tw.sessions} antrenman · ${tw.min} dk · ${tw.tss} TSS
FORM: Form/TSB ${d.form}, CTL ${d.ctl}, ATL ${d.atl}${d.acwr != null ? ', ACWR ' + d.acwr : ''}; hazır olma ${d.readiness ? d.readiness.label : '-'}
${d.race ? `HEDEF YARIŞ: ${d.race.name} — ${d.race.daysLeft} gün (${d.race.phase})` : ''}
Şunları yaz:
1) Geçen haftanın kısa değerlendirmesi (hacim ve yük dengeli miydi?).
2) Bu hafta için odak: forma, ACWR'ye${d.race ? ', yarış dönemine' : ''} göre kaç antrenman, hangi yoğunluk, ne kadar dinlenme.
Kısa ve doğrudan uygulanabilir.`;

  if (aiKey()) {
    callLLM('', prompt)
      .then(reply => { loader.remove(); appendChatMessage('bot', reply); })
      .catch(() => { loader.remove(); appendChatMessage('bot', weeklyLocalReport(lw, tw, d)); });
  } else {
    setTimeout(() => { loader.remove(); appendChatMessage('bot', weeklyLocalReport(lw, tw, d)); }, 800);
  }
}

export function generateCoachReport() {
  const container = document.getElementById('ai-chat-output');

  const loader = document.createElement('div');
  loader.className = 'ai-message message-bot loader-msg';
  loader.style.padding = '8px 12px';
  loader.innerHTML = 'Verileriniz inceleniyor, rapor hazırlanıyor...';
  container.appendChild(loader);
  container.scrollTop = container.scrollHeight;

  const data = gatherCoachData();

  if (aiKey()) {
    callLLM('', coachReportPrompt(data))
      .then(reply => { loader.remove(); appendChatMessage('bot', reply); })
      .catch(err => {
        console.error("AI hatası, yerel moda geçiliyor", err);
        loader.remove();
        generateLocalReport(data, `${AI_PROVIDERS[aiProvider()].label} bağlantısı kurulamadı, yerel analiz:\n\n`);
      });
  } else {
    setTimeout(() => { loader.remove(); generateLocalReport(data); }, 1200);
  }
}

export async function callGeminiAPI(apiKey, promptText) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${aiModel()}:generateContent?key=${apiKey}`;
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      contents: [{
        parts: [{
          text: promptText
        }]
      }]
    })
  });

  if (!response.ok) {
    throw new Error(`Gemini API HTTP hatası! Statü: ${response.status}`);
  }

  const data = await response.json();

  if (data.candidates && data.candidates[0] && data.candidates[0].content && data.candidates[0].content.parts[0]) {
    return data.candidates[0].content.parts[0].text;
  } else {
    throw new Error("API yanıt formatı geçersiz.");
  }
}

// Çoklu sağlayıcı tek-metin çağrısı (Gemini/Claude/OpenAI) — rapor + tool'suz sohbet için
export async function callLLM(systemText, userText) {
  const provider = aiProvider();
  const key = aiKey();
  const model = aiModel();
  if (!key) throw new Error('API anahtarı girilmemiş');

  if (provider === 'claude') {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': key,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true'
      },
      body: JSON.stringify({ model, max_tokens: 1024, system: systemText || undefined, messages: [{ role: 'user', content: userText }] })
    });
    if (!res.ok) throw new Error('Claude HTTP ' + res.status);
    const d = await res.json();
    return (d.content && d.content[0] && d.content[0].text) || '';
  }

  if (provider === 'openai') {
    const messages = [];
    if (systemText) messages.push({ role: 'system', content: systemText });
    messages.push({ role: 'user', content: userText });
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'Authorization': 'Bearer ' + key },
      body: JSON.stringify({ model, messages })
    });
    if (!res.ok) throw new Error('OpenAI HTTP ' + res.status);
    const d = await res.json();
    return (d.choices && d.choices[0] && d.choices[0].message && d.choices[0].message.content) || '';
  }

  // gemini (varsayılan)
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`;
  const body = { contents: [{ role: 'user', parts: [{ text: userText }] }] };
  if (systemText) body.systemInstruction = { parts: [{ text: systemText }] };
  const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  if (!res.ok) throw new Error('Gemini HTTP ' + res.status);
  const d = await res.json();
  const parts = d.candidates && d.candidates[0] && d.candidates[0].content && d.candidates[0].content.parts;
  return (parts && parts.map(p => p.text).filter(Boolean).join('\n')) || '';
}

export function generateLocalReport(d, prefixText = "") {
  const p = state.profile;
  let report = prefixText || "";
  report += `### 🤖 TriTrack Koç Raporu — ${p.name}\n\n`;

  // 0. Hazır olma durumu
  if (d.readiness) {
    report += `**${d.readiness.emoji} Bugünkü Hazır Olma: ${d.readiness.label}**\n`;
    if (d.readiness.reasons.length) report += `- Dikkat: ${d.readiness.reasons.join(', ')}.\n`;
    report += `\n`;
  }

  // 1. Beslenme
  report += `**1. Beslenme:**\n`;
  const calDef = p.targetDailyCalories - d.diet.cal;
  if (d.diet.cal === 0) {
    report += `- Bugün besin girişi yok. Performans için öğünlerini kaydet.\n`;
  } else {
    if (Math.abs(calDef) < 200) report += `- Enerji dengesi mükemmel (${Math.round(d.diet.cal)} kcal).\n`;
    else if (calDef > 200) report += `- Hedefin ${Math.round(calDef)} kcal altındasın. Dayanıklılık için karbonhidratı artır.\n`;
    else report += `- Hedefin ${Math.round(-calDef)} kcal üstündesin. Kilo kontrolünde porsiyona dikkat.\n`;

    if (d.diet.p < p.targetMacros.protein * 0.8) report += `- Protein yetersiz (${Math.round(d.diet.p)}/${p.targetMacros.protein}g). Sonraki öğüne tavuk/yumurta/whey ekle.\n`;
    else report += `- Protein yeterli (${Math.round(d.diet.p)}g) 👍\n`;
  }

  // 2. Toparlanma
  report += `\n**2. Toparlanma:**\n`;
  const b = d.body;
  if (typeof b.sleep === 'number') {
    report += `- Uyku: ${b.sleep} saat${b.sleep < 7 ? ' — kısa, 8 saate çıkmaya çalış.' : ' 👍'}${typeof b.sleepScore === 'number' ? ` (puan ${b.sleepScore}/100)` : ''}\n`;
  } else if (typeof b.sleepScore === 'number') {
    report += `- Uyku puanı: ${b.sleepScore}/100. Süreyi de girersen analiz güçlenir.\n`;
  } else {
    report += `- Uyku verisi girilmedi.\n`;
  }
  if (typeof b.hrv === 'number') {
    const base = avgOf(holisticValues('hrv', 1, 14));
    if (base && b.hrv < base * 0.9) report += `- HRV ${b.hrv} ms — ortalamanın (${Math.round(base)}) altında, yorgunluk işareti.\n`;
    else report += `- HRV ${b.hrv} ms — stabil, yüklere hazır.\n`;
  }

  // 3. Antrenman önerisi
  report += `\n**3. Antrenman Önerisi:**\n`;
  const avgRpe = d.recent.length ? d.recent.reduce((a, w) => a + (w.rpe || 0), 0) / d.recent.length : 0;
  const loadDelta = d.load.lastWeek ? Math.round((d.load.thisWeek - d.load.lastWeek) / d.load.lastWeek * 100) : null;

  if (d.readiness && d.readiness.label === 'Dinlen') {
    report += `🔴 Toparlanman bugün düşük. Yoğun çalışma yerine aktif dinlenme (kolay yürüyüş/sürüş) öneririm.\n`;
  } else if (avgRpe > 7) {
    report += `💪 Son antrenman zorluğun yüksek (ort. RPE ${Math.round(avgRpe * 10) / 10}). Bir antrenmanı mobilite/esnemeye ayır.\n`;
  } else {
    report += `🚀 Durum iyi görünüyor. Planına sadık kal.\n`;
  }
  if (loadDelta !== null) {
    if (loadDelta > 30) report += `- Haftalık yük geçen haftaya göre %${loadDelta} arttı — ani artış sakatlık riski, kademeli ilerle.\n`;
    else if (loadDelta < -30) report += `- Haftalık yük %${Math.abs(loadDelta)} azaldı — dinlenme haftasıysa harika.\n`;
  }

  appendChatMessage('bot', report);
}

export function handleCoachChat(userText) {
  appendChatMessage('user', userText);

  const container = document.getElementById('ai-chat-output');
  const loader = document.createElement('div');
  loader.className = 'ai-message message-bot loader-msg';
  loader.style.padding = '8px 12px';
  loader.innerHTML = 'Antrenörünüz düşünüyor...';
  container.appendChild(loader);
  container.scrollTop = container.scrollHeight;

  const key = aiKey();

  if (key && aiSupportsTools()) {
    // Gemini: araç (function calling) destekli agent — okuma + (onaylı) yazma
    runAssistantAgent(key, userText, loader)
      .then(reply => {
        loader.remove();
        if (reply) appendChatMessage('bot', reply);
      })
      .catch(err => {
        console.error("Asistan hatası", err);
        loader.remove();
        appendChatMessage('bot', "Üzgünüm, bağlantıda sorun oldu: " + err.message + ". Profil'den API anahtarını/sağlayıcıyı kontrol et.");
      });
  } else if (key) {
    // Claude/OpenAI: tool yok → metin tavsiyesi (kayıt için Gemini gerekir)
    aiChatTurns.push({ role: 'user', text: userText });
    const hist = aiChatTurns.slice(-8).map(t => `${t.role === 'user' ? 'Sporcu' : 'Koç'}: ${t.text}`).join('\n');
    callLLM(assistantSystemPrompt(), hist + '\nKoç:')
      .then(reply => {
        loader.remove();
        appendChatMessage('bot', reply);
        aiChatTurns.push({ role: 'model', text: reply });
        if (aiChatTurns.length > 16) aiChatTurns = aiChatTurns.slice(-16);
      })
      .catch(err => {
        loader.remove();
        appendChatMessage('bot', `Bağlantı sorunu: ${err.message}. (Not: otomatik kayıt yalnız Gemini'de çalışır; Claude/OpenAI tavsiye verir.)`);
      });
  } else {
    setTimeout(() => {
      loader.remove();
      let reply = "Çevrimdışı moddasınız. AI Antrenör ile serbest sohbet edebilmek için Profil sekmesinden kendi **Gemini API Anahtarınızı** girmelisiniz.";

      const q = userText.toLowerCase();
      if (q.includes("koşu") || q.includes("kosu") || q.includes("pace") || q.includes("tempo")) {
        reply = "Koşu antrenmanlarında gelişmek için haftalık mesafenizi birden %10'dan fazla artırmamaya dikkat edin. Koşulardan sonra protein ve karbonhidrat depolarını hızla doldurmalısınız.";
      } else if (q.includes("bisiklet") || q.includes("watt") || q.includes("pedal")) {
        reply = "Bisiklette aero pozisyonda kalabilmek için core (karın/bel) bölgesi gücü kritiktir. Antrenman programınıza haftada 1-2 gün core egzersizleri eklemelisiniz.";
      } else if (q.includes("yüzme") || q.includes("havuz") || q.includes("swim")) {
        reply = "Yüzmede teknik çok önemlidir. Mesafe yapmaktan ziyade kulaç verimliliğini (SWOLF) artırmaya ve nefes kontrol egzersizlerine odaklanmalısınız.";
      } else if (q.includes("ne yemeliyim") || q.includes("yemek") || q.includes("beslenme") || q.includes("diyet")) {
        reply = "Yoğun antrenman günlerinden önce yulaf, makarna, pirinç gibi kompleks karbonhidratlar tüketin. Antrenman sonrasında ise toparlanmayı hızlandırmak için 3:1 oranında karbonhidrat-protein öğünü alın.";
      } else if (q.includes("uyku") || q.includes("hrv") || q.includes("toparlan") || q.includes("dinlen") || q.includes("yorgun") || q.includes("hazır")) {
        const rd = computeReadiness();
        reply = rd
          ? `Bugünkü hazır olma durumun: ${rd.emoji} ${rd.label}. ${rd.reasons.length ? 'Dikkat: ' + rd.reasons.join(', ') + '. ' : ''}HRV ortalamanın altındaysa veya uyku puanın düşükse o gün yoğunluğu azalt, aktif dinlenme yap.`
          : "Toparlanmayı takip için her sabah uyku süreni, uyku puanını ve HRV'ni gir. Bu değerler düşükse o gün hafif antrenman yap.";
      }

      appendChatMessage('bot', reply);
    }, 1000);
  }
}

// ==========================================
// 9.5. AI ASİSTAN ARAÇLARI (GEMINI FUNCTION CALLING)
// ==========================================

// --- Eylem (yazma) çalıştırıcıları: state'i günceller, kaydeder, ekranı yeniler ---
export function aiAddWorkout(a) {
  const date = a.date || currentDateStr;
  const durationSec = a.durationMin ? Math.round(a.durationMin * 60) : 0;
  const w = {
    id: generateId('w_'),
    date, sport: a.sport, duration: durationSec,
    rpe: (a.rpe != null) ? a.rpe : 5,
    notes: a.notes || ''
  };
  if (a.hr != null) w.hr = a.hr;
  if (a.sport === 'swim') { w.distance = a.distance || 0; w.pace = computePacePer100m(a.distance || 0, durationSec); }
  else if (a.sport === 'bike') { w.distance = a.distance || 0; w.pace = computeSpeed(a.distance || 0, durationSec); }
  else if (a.sport === 'fitness') { w.exercises = []; }
  else { w.distance = a.distance || 0; w.pace = computePacePerKm(a.distance || 0, durationSec); }
  state.workouts.push(w);
  saveState(); renderTodayView();
  return { ok: true, message: `${(SPORT_META[a.sport] || {}).name || a.sport} antrenmanı ${date} tarihine eklendi.` };
}

export function aiAddPlan(a) {
  const plan = {
    id: generateId('p_'),
    date: a.date || currentDateStr, sport: a.sport,
    targetDistance: (a.targetDistance != null) ? a.targetDistance : null,
    targetDuration: (a.targetDurationMin != null) ? a.targetDurationMin : null,
    details: a.details || '', completed: false
  };
  state.plans.push(plan);
  saveState(); renderProgramView(); renderTodayView();
  return { ok: true, message: `${(SPORT_META[a.sport] || {}).name || a.sport} planı ${plan.date} tarihine eklendi.` };
}

export function aiAddWeekPlan(a) {
  const items = Array.isArray(a.items) ? a.items : [];
  if (items.length === 0) return { error: 'Plan öğesi yok.' };
  const weekStart = a.haftaBaslangic ? mondayOf(a.haftaBaslangic) : mondayOf(currentDateStr);
  let added = 0;
  items.forEach(it => {
    if (it.sport == null || it.gun == null) return;
    state.plans.push({
      id: generateId('p_'),
      date: addDaysStr(weekStart, Math.max(0, Math.min(6, it.gun))),
      sport: it.sport,
      targetDistance: it.mesafe != null ? it.mesafe : null,
      targetDuration: it.sure != null ? it.sure : null,
      details: it.detay || '', completed: false
    });
    added++;
  });
  saveState(); renderProgramView(); renderTodayView();
  return { ok: true, message: `${added} antrenman ${weekStart} haftasına eklendi.` };
}

export function aiSetBody(a) {
  const date = a.date || currentDateStr;
  const log = state.holisticLogs[date] || (state.holisticLogs[date] = {});
  if (a.sleep != null) log.sleep = a.sleep;
  if (a.sleepScore != null) log.sleepScore = a.sleepScore;
  if (a.hrv != null) log.hrv = a.hrv;
  if (a.weight != null) { log.weight = a.weight; state.profile.weight = a.weight; }
  saveState(); renderTodayView();
  return { ok: true, message: `${date} vücut durumu kaydedildi.` };
}

export function aiAddFood(a) {
  const food = {
    id: generateId('fd_'),
    date: a.date || currentDateStr, meal: a.meal || 'snack', name: a.name || 'Besin',
    calories: a.calories || 0, protein: a.protein || 0, carbs: a.carbs || 0, fat: a.fat || 0,
    quantity: 1, unit: 'piece'
  };
  state.diet.push(food);
  saveState(); refreshDietUI();
  return { ok: true, message: `"${food.name}" tüketilenlere eklendi.` };
}

export function aiUpdateGoals(a) {
  if (a.calories != null) state.profile.targetDailyCalories = a.calories;
  if (!state.profile.targetMacros) state.profile.targetMacros = {};
  if (a.protein != null) state.profile.targetMacros.protein = a.protein;
  if (a.carbs != null) state.profile.targetMacros.carbs = a.carbs;
  if (a.fat != null) state.profile.targetMacros.fat = a.fat;
  saveState(); renderTodayView();
  return { ok: true, message: 'Hedefler güncellendi.' };
}

// --- Okuma çalıştırıcısı (onay gerektirmez) ---
export function aiGetDay(a) {
  const date = a.date || currentDateStr;
  const workouts = state.workouts.filter(w => w.date === date)
    .map(w => ({ sport: w.sport, dakika: Math.round((w.duration || 0) / 60), mesafe: w.distance || 0, rpe: w.rpe, not: w.notes || '' }));
  const dietItems = state.diet.filter(f => f.date === date);
  const dietTot = dietItems.reduce((s, f) => ({ cal: s.cal + f.calories, p: s.p + f.protein }), { cal: 0, p: 0 });
  const body = state.holisticLogs[date] || {};
  const plans = state.plans.filter(p => p.date === date).map(p => ({ sport: p.sport, detay: p.details, tamamlandi: p.completed }));
  return { tarih: date, antrenmanlar: workouts, diyetKcal: Math.round(dietTot.cal), diyetProtein: Math.round(dietTot.p), vucut: body, planlar: plans };
}

// --- Araç kayıt defteri (Gemini declarations + çalıştırıcı + onay özeti) ---
export const AI_TOOLS = [
  {
    name: 'antrenmanEkle', write: true, run: aiAddWorkout,
    summary: a => `🏋️ ${(SPORT_META[a.sport] || {}).name || a.sport}${a.distance ? ' · ' + (a.sport === 'swim' ? a.distance + 'm' : a.distance + 'km') : ''}${a.durationMin ? ' · ' + a.durationMin + 'dk' : ''} · ${a.date || 'bugün'} — yapılan olarak eklensin mi?`,
    declaration: {
      name: 'antrenmanEkle', description: 'Yapılan (tamamlanmış) bir antrenmanı kaydeder.',
      parameters: {
        type: 'object', properties: {
          sport: { type: 'string', enum: ['run', 'bike', 'swim', 'fitness'], description: 'Branş' },
          date: { type: 'string', description: 'YYYY-MM-DD; verilmezse bugün' },
          distance: { type: 'number', description: 'Mesafe — koşu/bisiklet km, yüzme metre' },
          durationMin: { type: 'number', description: 'Süre (dakika)' },
          hr: { type: 'number', description: 'Ortalama nabız' },
          rpe: { type: 'number', description: 'Zorluk 1-10' },
          notes: { type: 'string', description: 'Not' }
        }, required: ['sport']
      }
    }
  },
  {
    name: 'antrenmanPlaniEkle', write: true, run: aiAddPlan,
    summary: a => `📅 Plan: ${(SPORT_META[a.sport] || {}).name || a.sport}${a.targetDistance ? ' · ' + a.targetDistance : ''}${a.details ? ' · ' + a.details : ''} · ${a.date || 'bugün'} — eklensin mi?`,
    declaration: {
      name: 'antrenmanPlaniEkle', description: 'İleri/bugün için bir antrenman planı ekler.',
      parameters: {
        type: 'object', properties: {
          sport: { type: 'string', enum: ['run', 'bike', 'swim', 'fitness'] },
          date: { type: 'string', description: 'YYYY-MM-DD; verilmezse bugün' },
          targetDistance: { type: 'number', description: 'Hedef mesafe (koşu/bisiklet km, yüzme metre)' },
          targetDurationMin: { type: 'number', description: 'Hedef süre (dakika)' },
          details: { type: 'string', description: 'Plan detayı, örn. "5x1000m tempo"' }
        }, required: ['sport']
      }
    }
  },
  {
    name: 'haftalikPlanEkle', write: true, run: aiAddWeekPlan,
    summary: a => `📅 ${(a.items || []).length} antrenmanlık haftalık plan eklensin mi?`,
    declaration: {
      name: 'haftalikPlanEkle',
      description: 'Bir haftaya birden çok antrenman planı ekler (haftalık program). Yarış tarihine, döneme ve forma göre dengeli kur; dinlenme günleri bırak.',
      parameters: {
        type: 'object', properties: {
          haftaBaslangic: { type: 'string', description: 'YYYY-MM-DD (haftanın herhangi bir günü); verilmezse bu hafta' },
          items: {
            type: 'array', description: 'Antrenmanlar',
            items: {
              type: 'object', properties: {
                gun: { type: 'number', description: '0=Pazartesi ... 6=Pazar' },
                sport: { type: 'string', enum: ['run', 'bike', 'swim', 'fitness'] },
                mesafe: { type: 'number', description: 'koşu/bisiklet km, yüzme m' },
                sure: { type: 'number', description: 'dakika' },
                detay: { type: 'string', description: 'kısa açıklama, örn. "5x1000m tempo"' }
              }, required: ['gun', 'sport']
            }
          }
        }, required: ['items']
      }
    }
  },
  {
    name: 'vucutDurumuKaydet', write: true, run: aiSetBody,
    summary: a => `🩺 ${a.date || 'bugün'}: ${[a.sleep != null ? 'uyku ' + a.sleep + 'sa' : '', a.sleepScore != null ? 'puan ' + a.sleepScore : '', a.hrv != null ? 'HRV ' + a.hrv : '', a.weight != null ? a.weight + 'kg' : ''].filter(Boolean).join(', ')} — kaydedilsin mi?`,
    declaration: {
      name: 'vucutDurumuKaydet', description: 'Bir günün uyku, uyku puanı, HRV ve/veya kilo değerini kaydeder.',
      parameters: {
        type: 'object', properties: {
          date: { type: 'string', description: 'YYYY-MM-DD; verilmezse bugün' },
          sleep: { type: 'number', description: 'Uyku saati' },
          sleepScore: { type: 'number', description: 'Uyku puanı 0-100' },
          hrv: { type: 'number', description: 'HRV (ms)' },
          weight: { type: 'number', description: 'Kilo (kg)' }
        }, required: []
      }
    }
  },
  {
    name: 'besinEkle', write: true, run: aiAddFood,
    summary: a => `🍽 ${a.name || 'Besin'} · ${a.calories || 0}kcal${a.protein ? ' · P' + a.protein : ''} · ${a.date || 'bugün'} — tüketilenlere eklensin mi?`,
    declaration: {
      name: 'besinEkle', description: 'Tüketilen bir besini günlüğe ekler.',
      parameters: {
        type: 'object', properties: {
          name: { type: 'string', description: 'Besin adı' },
          meal: { type: 'string', enum: ['breakfast', 'lunch', 'dinner', 'snack'], description: 'Öğün' },
          calories: { type: 'number' }, protein: { type: 'number' }, carbs: { type: 'number' }, fat: { type: 'number' },
          date: { type: 'string', description: 'YYYY-MM-DD; verilmezse bugün' }
        }, required: ['name']
      }
    }
  },
  {
    name: 'hedefGuncelle', write: true, run: aiUpdateGoals,
    summary: a => `🎯 Hedef: ${[a.calories != null ? a.calories + 'kcal' : '', a.protein != null ? 'P' + a.protein : '', a.carbs != null ? 'K' + a.carbs : '', a.fat != null ? 'Y' + a.fat : ''].filter(Boolean).join(', ')} — güncellensin mi?`,
    declaration: {
      name: 'hedefGuncelle', description: 'Günlük kalori ve makro hedeflerini günceller.',
      parameters: {
        type: 'object', properties: {
          calories: { type: 'number' }, protein: { type: 'number' }, carbs: { type: 'number' }, fat: { type: 'number' }
        }, required: []
      }
    }
  },
  {
    name: 'gunVerisiniGetir', write: false, run: aiGetDay,
    declaration: {
      name: 'gunVerisiniGetir', description: 'Belirli bir günün antrenman, diyet, vücut ve plan verilerini getirir.',
      parameters: {
        type: 'object', properties: {
          date: { type: 'string', description: 'YYYY-MM-DD; verilmezse bugün' }
        }, required: []
      }
    }
  }
];

export function assistantSystemPrompt() {
  const d = gatherCoachData();
  const p = state.profile;
  return `Sen ${p.name || 'sporcu'} için SERT, doğrudan ve mazeret kabul etmeyen bir triatlon/koşu antrenörüsün. Türkçe konuş; lafı dolandırma, gerçeği açıkça söyle, tembelliği/bahaneyi yüzüne vur ve net görev ver — ama asla aşağılama; sertliğin sporcuyu hedefe taşımak için. Sağlık ve sakatlık riski önceliklidir: aşırı yüklenme/yorgunluk varsa net "dur/dinlen" de. Hedef yarış varsa o tarihe ve döneme göre yönlendir.
${COACHING_KB}
Bugünün tarihi: ${currentDateStr}.
Kullanıcı bir şey eklemeni/kaydetmeni isterse uygun ARACI çağır (antrenmanEkle, antrenmanPlaniEkle, haftalikPlanEkle, vucutDurumuKaydet, besinEkle, hedefGuncelle). Haftalık program istenirse haftalikPlanEkle ile tüm haftayı tek seferde ekle. Geçmiş veri lazımsa gunVerisiniGetir aracını kullan.
Kurallar: Tarih verilmezse bugünü kullan. Yüzme mesafesi METRE, koşu/bisiklet KM. Emin değilsen kullanıcıya sor; uydurma.
Güncel durum: bugün uyku ${d.body.sleep != null ? d.body.sleep : '-'}/puan ${d.body.sleepScore != null ? d.body.sleepScore : '-'}, HRV ${d.body.hrv != null ? d.body.hrv : '-'}; bu hafta ${d.weekTss} TSS; Form/TSB ${d.form}${d.acwr != null ? ', ACWR ' + d.acwr : ''}; hazır olma ${d.readiness ? d.readiness.label : '-'}${d.race ? `; hedef yarış ${d.race.name} ${d.race.daysLeft} gün (${d.race.phase})` : ''}.
Tavsiye verirken bu verileri (form, ACWR, yarışa kalan süre/dönem) dikkate al. Sadece spor, antrenman, beslenme, uyku ve toparlanma konularında yardım et.`;
}

export async function geminiGenerate(apiKey, contents, systemText, tools) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${aiModel()}:generateContent?key=${apiKey}`;
  const body = { contents };
  if (systemText) body.systemInstruction = { parts: [{ text: systemText }] };
  if (tools) body.tools = tools;
  const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  if (!res.ok) throw new Error('Gemini HTTP ' + res.status);
  const data = await res.json();
  if (!data.candidates || !data.candidates[0]) throw new Error('Geçersiz yanıt');
  return data.candidates[0];
}

// Sohbette onay kartı göster; Promise<boolean> döndürür
export function aiConfirmAction(summaryText) {
  return new Promise(resolve => {
    const container = document.getElementById('ai-chat-output');
    const chip = document.createElement('div');
    chip.className = 'ai-confirm-chip';
    chip.innerHTML = `
      <div class="ai-confirm-text">${escapeHtml(summaryText)}</div>
      <div class="ai-confirm-actions">
        <button class="btn btn-primary ai-confirm-yes" style="padding:6px 14px; font-size:12px;">✅ Onayla</button>
        <button class="btn btn-ghost ai-confirm-no" style="padding:6px 14px; font-size:12px;">✖ Vazgeç</button>
      </div>`;
    container.appendChild(chip);
    container.scrollTop = container.scrollHeight;
    const done = (label, val) => {
      chip.querySelector('.ai-confirm-actions').innerHTML = `<span class="text-xs text-muted">${label}</span>`;
      resolve(val);
    };
    chip.querySelector('.ai-confirm-yes').addEventListener('click', () => done('✅ Onaylandı', true));
    chip.querySelector('.ai-confirm-no').addEventListener('click', () => done('✖ Vazgeçildi', false));
  });
}

// Sohbet hafızası (oturum boyunca son turlar; bağlamlı konuşma için)
export let aiChatTurns = [];

// Agent döngüsü: model → (araç çağrısı → onay/çalıştır → sonuç) → final metin
export async function runAssistantAgent(apiKey, userText, loader) {
  const sys = assistantSystemPrompt();
  const tools = [{ functionDeclarations: AI_TOOLS.map(t => t.declaration) }];
  const contents = [];
  aiChatTurns.slice(-8).forEach(t => contents.push({ role: t.role, parts: [{ text: t.text }] }));
  contents.push({ role: 'user', parts: [{ text: userText }] });
  aiChatTurns.push({ role: 'user', text: userText });

  for (let step = 0; step < 6; step++) {
    if (loader && !loader.isConnected) {
      document.getElementById('ai-chat-output').appendChild(loader);
    }
    const cand = await geminiGenerate(apiKey, contents, sys, tools);
    const parts = (cand.content && cand.content.parts) || [];
    const fcPart = parts.find(p => p.functionCall);

    if (!fcPart) {
      const text = parts.map(p => p.text).filter(Boolean).join('\n').trim() || 'Tamam.';
      aiChatTurns.push({ role: 'model', text });
      if (aiChatTurns.length > 16) aiChatTurns = aiChatTurns.slice(-16);
      return text;
    }

    contents.push(cand.content); // modelin araç çağrısı turu
    const fc = fcPart.functionCall;
    const tool = AI_TOOLS.find(t => t.name === fc.name);
    const args = fc.args || {};
    let result;

    if (!tool) {
      result = { error: 'Bilinmeyen araç: ' + fc.name };
    } else if (tool.write) {
      if (loader) loader.remove(); // "düşünüyor"u gizle, onay kartını göster
      const ok = await aiConfirmAction(tool.summary(args));
      if (ok) {
        try { result = tool.run(args); showToast(result.message || 'Eklendi ✅'); }
        catch (e) { result = { error: e.message }; }
      } else {
        result = { cancelled: true, message: 'Kullanıcı bu işlemi onaylamadı.' };
      }
    } else {
      try { result = tool.run(args); } catch (e) { result = { error: e.message }; }
    }

    contents.push({ role: 'user', parts: [{ functionResponse: { name: fc.name, response: result } }] });
  }
  return 'İşlem çok uzadı, lütfen tekrar dener misin?';
}

