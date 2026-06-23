import { refreshActiveView } from './main.js';
import { escapeHtml } from './program.js';
import { currentDateStr, formatDate, parseLocalDate, saveState, state } from './state.js';
import { renderTodayView } from './today.js';
import { showConfirm, showToast } from './utils.js';
import { startEditWorkout } from './workout.js';

// ==========================================
// 12. ANALİZ & İSTATİSTİK GÖRÜNÜMÜ (SAF SVG GRAFİKLER)
// ==========================================

export const SPORT_META = {
  run: { name: 'Koşu', color: 'var(--color-kosu)' },
  bike: { name: 'Bisiklet', color: 'var(--color-bisiklet)' },
  swim: { name: 'Yüzme', color: 'var(--color-yuzme)' },
  fitness: { name: 'Güç', color: 'var(--color-fitness)' }
};
export const SPORT_ORDER = ['run', 'bike', 'swim', 'fitness'];

// Verilen tarihin haftasının Pazartesi'sini döndür (YYYY-MM-DD)
export function mondayOf(dateStr) {
  const d = parseLocalDate(dateStr);
  const day = d.getDay(); // 0=Pazar
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return formatDate(d);
}

export function addDaysStr(dateStr, n) {
  const d = parseLocalDate(dateStr);
  d.setDate(d.getDate() + n);
  return formatDate(d);
}

export function renderAnalysisView() {
  renderAnalysisSummary();
  renderWeeklyLoadChart();
  renderSportDistChart();
  renderSleepChart();
  renderHrvChart();
  renderLoadBalanceChart();   // Faz C: Form & Yük (CTL/ATL/TSB)
  renderPersonalRecords();    // Faz B: Kişisel Rekorlar
  renderHrZones();            // Faz D: Nabız Bölgeleri
  renderWeightChart();        // Faz A: Kilo Trendi
  renderCalorieChart();       // Faz A: Kalori Trendi
}

// Son N günün holistic loglarını {label, value} dizisine çevir
export function collectDailySeries(field, days) {
  const out = [];
  for (let i = days - 1; i >= 0; i--) {
    const ds = addDaysStr(currentDateStr, -i);
    const d = parseLocalDate(ds);
    const log = state.holisticLogs[ds] || {};
    out.push({
      label: `${d.getDate()}`,
      value: (typeof log[field] === 'number') ? log[field] : null
    });
  }
  return out;
}

// Bir veri serisinden tek-eksenli çizgi grafiği SVG'si üret
// opts: { color, yMin, yMax, valueSuffix }
export function buildLineChartSVG(series, opts) {
  const W = 320, H = 170, left = 30, right = 8, top = 12, bottom = 20;
  const plotW = W - left - right, plotH = H - top - bottom;
  const n = series.length;
  const xAt = i => left + (n === 1 ? plotW / 2 : (i / (n - 1)) * plotW);

  const vals = series.filter(p => p.value != null).map(p => p.value);
  let yMin = (opts.yMin != null) ? opts.yMin : Math.min(...vals);
  let yMax = (opts.yMax != null) ? opts.yMax : Math.max(...vals);
  // küçük tampon ve sıfır bölme koruması
  if (yMin === yMax) { yMin -= 1; yMax += 1; }
  const yAt = v => top + plotH - ((v - yMin) / (yMax - yMin)) * plotH;

  // y ekseni min/max etiketleri + taban çizgisi
  const grid = `
    <line x1="${left}" y1="${top}" x2="${left}" y2="${top + plotH}" style="stroke:var(--card-border)" stroke-width="1"></line>
    <line x1="${left}" y1="${top + plotH}" x2="${W - right}" y2="${top + plotH}" style="stroke:var(--card-border)" stroke-width="1"></line>
    <text x="${left - 4}" y="${top + 4}" text-anchor="end" font-size="9" style="fill:var(--text-muted)">${Math.round(yMax)}${opts.valueSuffix || ''}</text>
    <text x="${left - 4}" y="${top + plotH}" text-anchor="end" font-size="9" style="fill:var(--text-muted)">${Math.round(yMin)}${opts.valueSuffix || ''}</text>`;

  const pts = series.map((p, i) => p.value != null ? `${xAt(i).toFixed(1)},${yAt(p.value).toFixed(1)}` : null).filter(Boolean);
  const poly = pts.length > 1
    ? `<polyline points="${pts.join(' ')}" fill="none" style="stroke:${opts.color}" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"></polyline>` : '';
  const dots = series.map((p, i) => p.value != null
    ? `<circle cx="${xAt(i).toFixed(1)}" cy="${yAt(p.value).toFixed(1)}" r="2.8" style="fill:${opts.color}"></circle>` : '').join('');
  const xlabels = series.map((p, i) => (i % 3 === 0)
    ? `<text x="${xAt(i).toFixed(1)}" y="${H - 5}" text-anchor="middle" font-size="8" style="fill:var(--text-muted)">${p.label}</text>` : '').join('');

  return `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid meet">${grid}${xlabels}${poly}${dots}</svg>`;
}

// --- Uyku Trendi: süre (bar) + uyku puanı (çizgi) ---
export function renderSleepChart() {
  const container = document.getElementById('chart-sleep');
  const legendEl = document.getElementById('chart-sleep-legend');
  const DAYS = 14;

  const hours = collectDailySeries('sleep', DAYS);
  const scores = collectDailySeries('sleepScore', DAYS);

  const hasHours = hours.some(p => p.value != null);
  const hasScore = scores.some(p => p.value != null);

  // Glanceable özet: son 7 gün ort. uyku
  const cur = avgOf(holisticValues('sleep', 0, 6));
  const prev = avgOf(holisticValues('sleep', 7, 13));
  const scoreAvg = avgOf(holisticValues('sleepScore', 0, 6));
  const sleepTrend = makeTrend(cur, prev, true, d => `${d.toFixed(1)}s`);
  let sleepInsight;
  if (cur == null) sleepInsight = 'Uyku süresi henüz girilmemiş.';
  else if (cur < 7) sleepInsight = `Ortalama ${cur.toFixed(1)} saat — 7 saatin altı. Toparlanma için biraz daha uyku iyi olur.`;
  else if (cur < 8) sleepInsight = `İyi uyuyorsun (${cur.toFixed(1)} saat). 8 saate çıkmak performansa katkı sağlar.`;
  else sleepInsight = `Harika uyku süresi (${cur.toFixed(1)} saat) 👍`;
  if (scoreAvg != null) sleepInsight += ` Ort. uyku puanın ${Math.round(scoreAvg)}/100.`;
  const sleepValue = cur != null ? cur.toFixed(1) : (scoreAvg != null ? Math.round(scoreAvg) : '–');
  const sleepUnit = cur != null ? 'saat' : (scoreAvg != null ? 'puan' : 'saat');
  setGlance('sleep', glanceTop(sleepValue, sleepUnit, 'son 7 gün ort.', sleepTrend), sleepInsight);

  if (!hasHours && !hasScore) {
    container.innerHTML = '<p class="chart-empty">Henüz uyku verisi girilmemiş.</p>';
    legendEl.innerHTML = '';
    return;
  }

  const W = 320, H = 170, left = 30, right = 30, top = 12, bottom = 20;
  const plotW = W - left - right, plotH = H - top - bottom;
  const n = DAYS;
  const slot = plotW / n;
  const barW = Math.min(16, slot * 0.55);

  // Sol eksen: uyku saati (0 → max(10, en yüksek))
  const sleepMax = Math.max(10, ...hours.filter(p => p.value != null).map(p => p.value));
  const yBar = v => top + plotH - (v / sleepMax) * plotH;
  // Sağ eksen: uyku puanı (0–100)
  const yScore = v => top + plotH - (v / 100) * plotH;
  const xAt = i => left + slot * (i + 0.5);

  let bars = '';
  hours.forEach((p, i) => {
    if (p.value != null) {
      const y = yBar(p.value);
      bars += `<rect x="${(xAt(i) - barW / 2).toFixed(1)}" y="${y.toFixed(1)}" width="${barW.toFixed(1)}" height="${(top + plotH - y).toFixed(1)}" rx="2" style="fill:var(--accent-blue); opacity:0.35"></rect>`;
    }
  });

  const scorePts = scores.map((p, i) => p.value != null ? `${xAt(i).toFixed(1)},${yScore(p.value).toFixed(1)}` : null).filter(Boolean);
  const scoreLine = scorePts.length > 1
    ? `<polyline points="${scorePts.join(' ')}" fill="none" style="stroke:var(--color-bisiklet)" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"></polyline>` : '';
  const scoreDots = scores.map((p, i) => p.value != null
    ? `<circle cx="${xAt(i).toFixed(1)}" cy="${yScore(p.value).toFixed(1)}" r="2.8" style="fill:var(--color-bisiklet)"></circle>` : '').join('');

  const axes = `
    <line x1="${left}" y1="${top + plotH}" x2="${W - right}" y2="${top + plotH}" style="stroke:var(--card-border)" stroke-width="1"></line>
    <text x="${left - 4}" y="${top + 4}" text-anchor="end" font-size="9" style="fill:var(--text-muted)">${Math.round(sleepMax)}s</text>
    <text x="${left - 4}" y="${top + plotH}" text-anchor="end" font-size="9" style="fill:var(--text-muted)">0</text>
    <text x="${W - right + 4}" y="${top + 4}" text-anchor="start" font-size="9" style="fill:var(--text-muted)">100</text>
    <text x="${W - right + 4}" y="${top + plotH}" text-anchor="start" font-size="9" style="fill:var(--text-muted)">0</text>`;

  const xlabels = hours.map((p, i) => (i % 3 === 0)
    ? `<text x="${xAt(i).toFixed(1)}" y="${H - 5}" text-anchor="middle" font-size="8" style="fill:var(--text-muted)">${p.label}</text>` : '').join('');

  container.innerHTML = `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid meet">${axes}${xlabels}${bars}${scoreLine}${scoreDots}</svg>`;
  legendEl.innerHTML = `
    <div class="chart-legend-item"><span class="chart-legend-dot" style="background:var(--accent-blue); opacity:0.5"></span>Uyku Süresi (saat)</div>
    <div class="chart-legend-item"><span class="chart-legend-dot" style="background:var(--color-bisiklet)"></span>Uyku Puanı (0–100)</div>`;
}

// --- HRV Trendi: tek temiz çizgi ---
export function renderHrvChart() {
  const container = document.getElementById('chart-hrv');
  const series = collectDailySeries('hrv', 14);

  // Glanceable özet: son 7 gün ort. HRV
  const cur = avgOf(holisticValues('hrv', 0, 6));
  const prev = avgOf(holisticValues('hrv', 7, 13));
  const hrvTrend = makeTrend(cur, prev, true, d => `${Math.round(d)}ms`);
  let hrvInsight;
  if (cur == null) hrvInsight = 'Henüz HRV verisi yok. Sabah ölçümünü girersen toparlanmanı izleyebilirim.';
  else if (prev != null && cur < prev * 0.92) hrvInsight = `HRV düşüyor (ort. ${Math.round(cur)} ms) — yorgunluk işareti olabilir, yoğunluğu azaltmayı düşün.`;
  else if (prev != null && cur > prev * 1.08) hrvInsight = `HRV yükseliyor (ort. ${Math.round(cur)} ms) — vücudun yüke iyi adapte oluyor 👍`;
  else hrvInsight = `HRV stabil seyrediyor (ort. ${Math.round(cur)} ms).`;
  setGlance('hrv', glanceTop(cur != null ? Math.round(cur) : '–', 'ms', 'son 7 gün ort.', hrvTrend), hrvInsight);

  if (!series.some(p => p.value != null)) {
    container.innerHTML = '<p class="chart-empty">Henüz HRV verisi girilmemiş.</p>';
    return;
  }

  container.innerHTML = buildLineChartSVG(series, { color: 'var(--color-yuzme)', valueSuffix: '' });
}

// ============ FAZ A: KİLO & KALORİ TREND GRAFİKLERİ ============

// --- Kilo Trendi (son 30 gün çizgi) ---
export function renderWeightChart() {
  const container = document.getElementById('chart-weight');
  if (!container) return;
  const series = collectDailySeries('weight', 30);

  const cur = avgOf(holisticValues('weight', 0, 6));
  const prev = avgOf(holisticValues('weight', 7, 13));
  const trend = makeTrend(cur, prev, null, d => `${d.toFixed(1)}kg`); // nötr: artış/azalış hedefe göre değişir
  let insight;
  if (cur == null) insight = 'Henüz kilo girilmemiş. Günlük Vücut Durumu kartından girebilirsin.';
  else if (prev == null) insight = `Güncel kilon ${cur.toFixed(1)} kg. Trendi görmek için birkaç gün daha gir.`;
  else {
    const diff = cur - prev;
    if (Math.abs(diff) < 0.2) insight = `Kilon stabil (~${cur.toFixed(1)} kg).`;
    else insight = `Son haftada ${diff > 0 ? '+' : ''}${diff.toFixed(1)} kg (ort. ${cur.toFixed(1)} kg).`;
  }

  // Kilo hedefi + projeksiyon
  const goal = state.profile.weightGoal;
  if (cur != null && typeof goal === 'number' && goal > 0) {
    const remaining = cur - goal; // + : fazla, − : alman lazım
    const absRem = Math.abs(remaining);
    if (absRem < 0.3) insight += ` 🎯 Hedefine (${goal} kg) ulaştın!`;
    else {
      insight += ` Hedef ${goal} kg → ${absRem.toFixed(1)} kg ${remaining > 0 ? 'vermen' : 'alman'} gerek.`;
      if (prev != null) {
        const weekly = cur - prev;
        const toward = (remaining > 0 && weekly < -0.05) || (remaining < 0 && weekly > 0.05);
        if (toward) insight += ` Bu hızla ~${Math.ceil(absRem / Math.abs(weekly))} hafta.`;
        else if (Math.abs(weekly) >= 0.05) insight += ' (Trend şu an ters yönde.)';
      }
    }
  }
  setGlance('weight', glanceTop(cur != null ? cur.toFixed(1) : '–', 'kg', 'son 7 gün ort.', trend), insight);

  if (!series.some(p => p.value != null)) {
    container.innerHTML = '<p class="chart-empty">Henüz kilo verisi girilmemiş.</p>';
    return;
  }
  container.innerHTML = buildLineChartSVG(series, { color: 'var(--accent-blue)', valueSuffix: '' });
}

// Son N günün günlük tüketilen kalori toplamını {label, value} dizisine çevir
export function collectCalorieSeries(days) {
  const out = [];
  for (let i = days - 1; i >= 0; i--) {
    const ds = addDaysStr(currentDateStr, -i);
    const d = parseLocalDate(ds);
    const total = state.diet
      .filter(f => f.date === ds)
      .reduce((s, f) => s + (f.calories || 0), 0);
    out.push({ label: `${d.getDate()}`, value: total > 0 ? Math.round(total) : null });
  }
  return out;
}

// Bir gün aralığındaki günlük kalori toplamları (offset 0 = currentDate)
export function calorieValues(fromOffset, toOffset) {
  const arr = [];
  for (let i = fromOffset; i <= toOffset; i++) {
    const ds = addDaysStr(currentDateStr, -i);
    const total = state.diet.filter(f => f.date === ds).reduce((s, f) => s + (f.calories || 0), 0);
    if (total > 0) arr.push(Math.round(total));
  }
  return arr;
}

// --- Kalori Trendi (son 14 gün çizgi) ---
export function renderCalorieChart() {
  const container = document.getElementById('chart-calories');
  if (!container) return;
  const series = collectCalorieSeries(14);

  const cur = avgOf(calorieValues(0, 6));
  const prev = avgOf(calorieValues(7, 13));
  const target = state.profile.targetDailyCalories || null;
  const trend = makeTrend(cur, prev, null, d => `${Math.round(d)} kcal`);
  let insight;
  if (cur == null) insight = 'Henüz besin girişi yok. Diyet sekmesinden ekleyebilirsin.';
  else if (target) {
    const diff = Math.round(cur - target);
    if (Math.abs(diff) < 150) insight = `Ort. ${Math.round(cur)} kcal — hedefine (${target}) çok yakınsın 👍`;
    else if (diff < 0) insight = `Ort. ${Math.round(cur)} kcal, hedefin ${Math.abs(diff)} kcal altında.`;
    else insight = `Ort. ${Math.round(cur)} kcal, hedefin ${diff} kcal üzerinde.`;
  } else insight = `Son 7 gün ort. ${Math.round(cur)} kcal.`;
  setGlance('calories', glanceTop(cur != null ? Math.round(cur) : '–', 'kcal', 'son 7 gün ort.', trend), insight);

  if (!series.some(p => p.value != null)) {
    container.innerHTML = '<p class="chart-empty">Henüz kalori verisi yok.</p>';
    return;
  }
  container.innerHTML = buildLineChartSVG(series, { color: 'var(--color-kosu)', yMin: 0, valueSuffix: '' });
}

// ============ FAZ B: KİŞİSEL REKORLAR (PR) ============

// Antrenmanlardan kişisel rekorları türet (eksik veriye dayanıklı)
export function computePersonalRecords() {
  const ws = state.workouts || [];
  const runs = ws.filter(w => w.sport === 'run' && w.distance > 0 && w.duration > 0);
  const bikes = ws.filter(w => w.sport === 'bike' && w.distance > 0 && w.duration > 0);

  const recs = [];

  // En uzun koşu
  const longestRun = runs.reduce((a, b) => (b.distance > (a?.distance || 0) ? b : a), null);
  if (longestRun) recs.push({ value: `${Math.round(longestRun.distance * 10) / 10} km`, label: '🏃 En Uzun Koşu' });

  // Koşuda en iyi tempo (mesafe ≥ 3 km kayıtlar arasında en düşük dk/km)
  const pacedRuns = runs.filter(w => w.distance >= 3).map(w => ({ pace: (w.duration / 60) / w.distance, w }));
  const bestPace = pacedRuns.reduce((a, b) => (b.pace < (a?.pace ?? Infinity) ? b : a), null);
  if (bestPace) {
    const m = Math.floor(bestPace.pace), s = Math.round((bestPace.pace - m) * 60);
    recs.push({ value: `${m}:${String(s).padStart(2, '0')}`, label: '⚡ En İyi Tempo (dk/km)' });
  }

  // En uzun bisiklet
  const longestBike = bikes.reduce((a, b) => (b.distance > (a?.distance || 0) ? b : a), null);
  if (longestBike) recs.push({ value: `${Math.round(longestBike.distance * 10) / 10} km`, label: '🚴 En Uzun Sürüş' });

  // Bisiklette en yüksek hız (km/sa)
  const fastestBike = bikes.reduce((a, b) => {
    const sp = b.distance / (b.duration / 3600);
    return (sp > (a?.speed || 0) ? { speed: sp, w: b } : a);
  }, null);
  if (fastestBike) recs.push({ value: `${Math.round(fastestBike.speed * 10) / 10} km/sa`, label: '💨 En Hızlı Sürüş' });

  // En uzun süreli tek antrenman (tüm branşlar)
  const longestDur = ws.reduce((a, b) => ((b.duration || 0) > (a?.duration || 0) ? b : a), null);
  if (longestDur && longestDur.duration > 0) recs.push({ value: fmtMinutes(longestDur.duration / 60), label: '⏱️ En Uzun Antrenman' });

  // En yüksek tek hafta toplam km (koşu+bisiklet)
  const weekKm = {};
  ws.forEach(w => {
    if ((w.sport === 'run' || w.sport === 'bike') && w.distance > 0) {
      const mon = mondayOf(w.date);
      weekKm[mon] = (weekKm[mon] || 0) + w.distance;
    }
  });
  const bestWeek = Object.values(weekKm).reduce((a, b) => Math.max(a, b), 0);
  if (bestWeek > 0) recs.push({ value: `${Math.round(bestWeek * 10) / 10} km`, label: '📅 En Yüksek Haftalık Mesafe' });

  return recs;
}

export function renderPersonalRecords() {
  const grid = document.getElementById('pr-grid');
  if (!grid) return;
  const recs = computePersonalRecords();
  if (recs.length === 0) {
    grid.innerHTML = '<p class="chart-empty">Mesafe/süre içeren antrenman ekledikçe rekorların burada birikir 🏅</p>';
    return;
  }
  grid.innerHTML = recs.map(r => `
    <div class="analysis-stat-card">
      <div class="stat-value">${r.value}</div>
      <div class="stat-label">${r.label}</div>
    </div>`).join('');
}

// ============ FAZ C: ANTRENMAN YÜKÜ (CTL / ATL / TSB) ============

// "m:ss" tempo metnini saniye/km'ye çevir (eşik tempo için)
export function paceStrToSec(str) {
  if (!str) return null;
  const m = String(str).trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return null;
  return parseInt(m[1]) * 60 + parseInt(m[2]);
}

// Antrenmanın yoğunluk faktörü (IF) — eşik verisi varsa branşa göre; yoksa null
export function workoutIF(w) {
  const p = state.profile;
  // Bisiklet: güç/FTP
  if (w.sport === 'bike' && p.ftp && typeof w.power === 'number' && w.power > 0) return w.power / p.ftp;
  // Koşu: eşik tempo / ort. tempo (hızlı = yüksek IF)
  if (w.sport === 'run' && p.thresholdPace && (w.distance || 0) > 0 && (w.duration || 0) > 0) {
    const thr = paceStrToSec(p.thresholdPace);
    const avg = (w.duration) / w.distance; // sn/km
    if (thr && avg > 0) return thr / avg;
  }
  // Genel: ort. nabız / LTHR
  if (p.lthr && typeof w.hr === 'number' && w.hr > 0) return w.hr / p.lthr;
  return null;
}

// Antrenman yükü (TSS ölçeğinde): süre(saat) × IF² × 100.
// Eşik yoksa IF ≈ RPE/10 ile aynı ölçekte tahmin → CTL/ATL tutarlı kalır.
export function workoutLoad(w) {
  const hours = (w.duration || 0) / 3600;
  if (hours <= 0) return 0;
  let intf = workoutIF(w);
  if (intf == null) intf = (typeof w.rpe === 'number' ? w.rpe : 5) / 10;
  intf = Math.max(0.3, Math.min(1.5, intf));
  return hours * intf * intf * 100;
}

// Bir günün toplam antrenman yükü (TSS)
export function dailyLoadOn(dateStr) {
  return state.workouts
    .filter(w => w.date === dateStr)
    .reduce((sum, w) => sum + workoutLoad(w), 0);
}

// Akut:Kronik İş Yükü Oranı (ACWR) — son 7g yük / 28g haftalık ort. yük
export function computeAcwr() {
  let acute = 0, chronic = 0;
  for (let i = 0; i < 28; i++) {
    const d = dailyLoadOn(addDaysStr(currentDateStr, -i));
    chronic += d;
    if (i < 7) acute += d;
  }
  chronic = chronic / 4; // 28 gün → haftalık ortalama
  if (chronic <= 0) return null;
  return acute / chronic;
}

// EWMA ile Fitness (CTL, 42g), Yorgunluk (ATL, 7g), Form (TSB = dünkü CTL−ATL)
// Son `tailDays` günü {label, ctl, atl} dizisi olarak döndürür + güncel form değeri
export function computeFitnessFatigue(tailDays = 28) {
  const HISTORY = 90; // ısınma için yeterli geçmiş
  const ctlK = 2 / (42 + 1), atlK = 2 / (7 + 1);
  let ctl = 0, atl = 0;
  let prevCtl = 0, prevAtl = 0;
  const out = [];
  for (let i = HISTORY - 1; i >= 0; i--) {
    const ds = addDaysStr(currentDateStr, -i);
    const load = dailyLoadOn(ds);
    prevCtl = ctl; prevAtl = atl;
    ctl = ctl + (load - ctl) * ctlK;
    atl = atl + (load - atl) * atlK;
    if (i < tailDays) {
      const d = parseLocalDate(ds);
      out.push({ label: `${d.getDate()}`, ctl, atl, form: prevCtl - prevAtl });
    }
  }
  const todayForm = prevCtl - prevAtl; // son günün başındaki form
  return { series: out, form: todayForm, ctl, atl };
}

// İki seri (CTL + ATL) çizgi grafiği — renderSleepChart desenini taklit eder
export function renderLoadBalanceChart() {
  const container = document.getElementById('chart-load-balance');
  const legendEl = document.getElementById('chart-load-balance-legend');
  if (!container) return;

  const { series, form } = computeFitnessFatigue(28);
  const hasLoad = series.some(p => p.ctl > 0.5 || p.atl > 0.5);

  // Glance: güncel Form değeri + yorum
  const formRounded = Math.round(form);
  let tone = 'flat', insight;
  if (!hasLoad) { insight = 'Yük hesabı için birkaç antrenman kaydet (RPE + süre).'; }
  else if (form > 5) { tone = 'up'; insight = `Form +${formRounded}: tazesin, yoğun/yarış antrenmanına hazırsın 💪`; }
  else if (form >= -10) { insight = `Form ${formRounded}: dengedesin, planına devam.`; }
  else if (form >= -20) { tone = 'down'; insight = `Form ${formRounded}: yorgunluk birikiyor, yoğunluğu biraz azalt.`; }
  else { tone = 'down'; insight = `Form ${formRounded}: belirgin yorgunluk — toparlanma/dinlenme günü iyi olur.`; }

  // ACWR (akut:kronik yük oranı) — sakatlık/yüklenme uyarısı
  if (hasLoad) {
    const acwr = computeAcwr();
    if (acwr != null) {
      if (acwr > 1.5) insight += ` ⚠️ ACWR ${acwr.toFixed(2)}: yük çok hızlı arttı, sakatlık riski — birkaç gün hafifle.`;
      else if (acwr > 1.3) insight += ` ACWR ${acwr.toFixed(2)}: yük artıyor, dikkatli ilerle.`;
      else if (acwr < 0.8) insight += ` ACWR ${acwr.toFixed(2)}: yük düşük (toparlanma/detren).`;
      else insight += ` ACWR ${acwr.toFixed(2)}: güvenli aralıkta 👍`;
    }
  }
  setGlance('loadbal', glanceTop(hasLoad ? (form > 0 ? `+${formRounded}` : `${formRounded}`) : '–', 'form', 'CTL − ATL (TSS)', tone === 'flat' ? null : { text: tone === 'up' ? '▲ taze' : '▼ yorgun', tone }), insight);

  if (!hasLoad) {
    container.innerHTML = '<p class="chart-empty">Henüz yük verisi yok.</p>';
    legendEl.innerHTML = '';
    return;
  }

  const W = 320, H = 170, left = 30, right = 8, top = 12, bottom = 20;
  const plotW = W - left - right, plotH = H - top - bottom;
  const n = series.length;
  const xAt = i => left + (n === 1 ? plotW / 2 : (i / (n - 1)) * plotW);
  const maxV = Math.max(1, ...series.map(p => Math.max(p.ctl, p.atl)));
  const yAt = v => top + plotH - (v / maxV) * plotH;

  const line = (key, color) => {
    const pts = series.map((p, i) => `${xAt(i).toFixed(1)},${yAt(p[key]).toFixed(1)}`).join(' ');
    return `<polyline points="${pts}" fill="none" style="stroke:${color}" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"></polyline>`;
  };
  const axis = `
    <line x1="${left}" y1="${top + plotH}" x2="${W - right}" y2="${top + plotH}" style="stroke:var(--card-border)" stroke-width="1"></line>
    <text x="${left - 4}" y="${top + 6}" text-anchor="end" font-size="9" style="fill:var(--text-muted)">${Math.round(maxV)}</text>
    <text x="${left - 4}" y="${top + plotH}" text-anchor="end" font-size="9" style="fill:var(--text-muted)">0</text>`;
  const xlabels = series.map((p, i) => (i % 4 === 0)
    ? `<text x="${xAt(i).toFixed(1)}" y="${H - 5}" text-anchor="middle" font-size="8" style="fill:var(--text-muted)">${p.label}</text>` : '').join('');

  container.innerHTML = `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid meet">${axis}${xlabels}${line('ctl', 'var(--accent-blue)')}${line('atl', 'var(--color-kosu)')}</svg>`;
  legendEl.innerHTML = `
    <div class="chart-legend-item"><span class="chart-legend-dot" style="background:var(--accent-blue)"></span>Fitness (CTL · 42g)</div>
    <div class="chart-legend-item"><span class="chart-legend-dot" style="background:var(--color-kosu)"></span>Yorgunluk (ATL · 7g)</div>`;
}

// ============ FAZ D: NABIZ BÖLGELERİ (HR ZONES) ============

// Nabzı maxHr'ye göre Z1–Z5'e ata
export function hrZoneOf(hr, maxHr) {
  const pct = hr / maxHr;
  if (pct < 0.60) return 0; // Z1
  if (pct < 0.70) return 1; // Z2
  if (pct < 0.80) return 2; // Z3
  if (pct < 0.90) return 3; // Z4
  return 4;                 // Z5
}

// Nabzı LTHR'ye (eşik nabzı) göre Z1–Z5'e ata (Friel benzeri 5 bölge — daha gerçekçi)
export function hrZoneOfLthr(hr, lthr) {
  const pct = hr / lthr;
  if (pct < 0.81) return 0; // Z1
  if (pct < 0.90) return 1; // Z2
  if (pct < 0.94) return 2; // Z3
  if (pct < 1.00) return 3; // Z4 (eşik)
  return 4;                 // Z5
}

export const HR_ZONE_META = [
  { name: 'Z1 Toparlanma', color: '#3b82f6' },
  { name: 'Z2 Dayanıklılık', color: '#10b981' },
  { name: 'Z3 Tempo', color: '#f59e0b' },
  { name: 'Z4 Eşik', color: '#f97316' },
  { name: 'Z5 Maksimum', color: '#ef4444' }
];

// --- Nabız Bölgeleri: süreye göre Z1–Z5 dağılımı (yatay barlar) ---
// Yoğunluk faktörünü (IF) güç/tempo bölgesine ata (Coggan benzeri)
export function ifZone(intf) {
  if (intf < 0.55) return 0; // Z1
  if (intf < 0.75) return 1; // Z2
  if (intf < 0.90) return 2; // Z3
  if (intf < 1.05) return 3; // Z4
  return 4;                  // Z5
}

// Antrenmanın yoğunluk bölgesi — branşa göre doğru ölçü:
// bisiklet→güç/FTP, koşu→tempo/eşik-tempo, diğer→nabız/LTHR(veya maxHR)
export function workoutZone(w) {
  const p = state.profile;
  if (w.sport === 'bike' && p.ftp && typeof w.power === 'number' && w.power > 0) return ifZone(w.power / p.ftp);
  if (w.sport === 'run' && p.thresholdPace && (w.distance || 0) > 0 && (w.duration || 0) > 0) {
    const thr = paceStrToSec(p.thresholdPace), avg = w.duration / w.distance;
    if (thr && avg > 0) return ifZone(thr / avg);
  }
  if (typeof w.hr === 'number' && w.hr > 0) {
    if (p.lthr) return hrZoneOfLthr(w.hr, p.lthr);
    return hrZoneOf(w.hr, p.maxHr || 190);
  }
  return null;
}

// GPS noktalarından mini rota SVG'si (en-boy korunur)
export function buildRouteSVG(pts) {
  const W = 300, H = 170, pad = 10;
  const lats = pts.map(p => p.lat), lons = pts.map(p => p.lon);
  const minLat = Math.min(...lats), maxLat = Math.max(...lats);
  const minLon = Math.min(...lons), maxLon = Math.max(...lons);
  const dLat = (maxLat - minLat) || 1e-6, dLon = (maxLon - minLon) || 1e-6;
  const s = Math.min((W - 2 * pad) / dLon, (H - 2 * pad) / dLat);
  const ox = pad + ((W - 2 * pad) - dLon * s) / 2;
  const oy = pad + ((H - 2 * pad) - dLat * s) / 2;
  const xy = pts.map(p => `${(ox + (p.lon - minLon) * s).toFixed(1)},${(oy + (maxLat - p.lat) * s).toFixed(1)}`).join(' ');
  return `<svg viewBox="0 0 ${W} ${H}" style="width:100%; background:var(--bg-secondary); border-radius:10px;"><polyline points="${xy}" fill="none" style="stroke:var(--accent-blue)" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"></polyline></svg>`;
}

// Antrenman detay ekranını aç (özet + HR grafiği + bölgede süre + rota)
export function openWorkoutDetail(w) {
  const modal = document.getElementById('workout-detail-modal');
  if (!modal) return;
  const meta = SPORT_META[w.sport] || { name: w.sport };
  const icons = { run: '🏃', bike: '🚴', swim: '🏊', fitness: '🏋️' };
  document.getElementById('wd-title').textContent = `${icons[w.sport] || ''} ${meta.name} · ${w.date}`;

  const intf = workoutIF(w);
  const tss = Math.round(workoutLoad(w));
  const distTxt = w.sport === 'swim' ? (w.distance ? `${w.distance} m` : '–') : (w.distance ? `${w.distance} km` : '–');
  const stats = [
    ['Süre', fmtMinutes((w.duration || 0) / 60)],
    ['Mesafe', distTxt],
    [w.sport === 'bike' ? 'Hız' : 'Tempo', w.pace || '–'],
    ['Ort. Nabız', w.hr ? `${w.hr} bpm` : '–'],
    w.power ? ['Güç', `${w.power} W`] : null,
    ['RPE', w.rpe ? `${w.rpe}/10` : '–'],
    ['TSS', tss > 0 ? tss : '–'],
    intf != null ? ['IF', intf.toFixed(2)] : null
  ].filter(Boolean);

  let html = `<div class="wd-stats">` + stats.map(s =>
    `<div class="wd-stat"><div class="wd-stat-v">${s[1]}</div><div class="wd-stat-l">${s[0]}</div></div>`).join('') + `</div>`;

  const track = w.track || [];
  const hrPts = track.filter(p => typeof p.hr === 'number');
  if (hrPts.length > 1) {
    html += `<div class="card-title" style="margin-top:14px;">❤️ Nabız</div>` +
      buildLineChartSVG(hrPts.map(p => ({ label: '', value: p.hr })), { color: 'var(--color-kosu)', valueSuffix: '' });
    const lthr = state.profile.lthr;
    const zoneOf = (hr) => (lthr ? hrZoneOfLthr(hr, lthr) : hrZoneOf(hr, state.profile.maxHr || 190));
    const cnt = [0, 0, 0, 0, 0];
    hrPts.forEach(p => cnt[zoneOf(p.hr)]++);
    html += `<div class="card-title" style="margin-top:10px;">Bölgede süre</div>` + HR_ZONE_META.map((z, i) => {
      const pct = Math.round(cnt[i] / hrPts.length * 100);
      return `<div class="hr-zone-row"><span class="hr-zone-label">${z.name}</span><div class="hr-zone-track"><div class="hr-zone-fill" style="width:${pct}%; background:${z.color};"></div></div><span class="hr-zone-pct">${pct}%</span></div>`;
    }).join('');
  }

  const gps = track.filter(p => typeof p.lat === 'number' && typeof p.lon === 'number');
  if (gps.length > 2) html += `<div class="card-title" style="margin-top:14px;">🗺️ Rota</div>` + buildRouteSVG(gps);

  if (w.notes) html += `<p class="text-sm text-muted" style="margin-top:12px; font-style:italic;">"${escapeHtml(w.notes)}"</p>`;
  if (track.length === 0) html += `<p class="text-xs text-muted" style="margin-top:12px;">Detaylı iz (HR/GPS) yok. GPX içe aktarılan seanslarda nabız grafiği + rota görünür.</p>`;

  html += `<div style="display:flex; gap:8px; margin-top:16px;">
    <button id="wd-edit" class="btn btn-secondary" style="flex:1; padding:10px;">✏️ Düzenle</button>
    <button id="wd-delete" class="btn btn-ghost" style="flex:1; padding:10px; color:#ef4444; border-color:rgba(239,68,68,0.3);">🗑️ Sil</button>
  </div>`;

  document.getElementById('wd-body').innerHTML = html;
  const close = () => modal.classList.remove('open');
  document.getElementById('wd-close').onclick = close;
  modal.onclick = (e) => { if (e.target === modal) close(); };

  document.getElementById('wd-edit').onclick = () => { close(); startEditWorkout(w); };
  document.getElementById('wd-delete').onclick = async () => {
    if (await showConfirm('Bu antrenman kaydını silmek istediğine emin misin?', { title: 'Antrenmanı sil', okText: 'Sil', danger: true })) {
      state.workouts = state.workouts.filter(x => x.id !== w.id);
      // Bu kayda bağlı plan tamamlanmasını geri al (plan tekrar yapılacaklara dönsün)
      state.plans.forEach(pl => { if (pl.loggedWorkoutId === w.id) { pl.completed = false; delete pl.loggedWorkoutId; } });
      saveState();
      close();
      renderTodayView();
      const av = document.querySelector('.bottom-nav-item.active');
      if (av && typeof refreshActiveView === 'function') refreshActiveView(av.getAttribute('data-view'));
      showToast('Antrenman silindi.');
    }
  };

  modal.classList.add('open');
}

export function renderHrZones() {
  const container = document.getElementById('chart-hr-zones');
  if (!container) return;
  const p = state.profile;
  const hasThresholds = !!(p.lthr || p.ftp || p.thresholdPace);

  const DAYS = 28;
  const since = addDaysStr(currentDateStr, -(DAYS - 1));
  const zoneSec = [0, 0, 0, 0, 0];
  state.workouts.forEach(w => {
    if (w.date >= since && w.date <= currentDateStr && (w.duration || 0) > 0) {
      const z = workoutZone(w);
      if (z != null) zoneSec[z] += w.duration;
    }
  });
  const total = zoneSec.reduce((a, b) => a + b, 0);

  if (total === 0) {
    setGlance('hrzone', glanceTop('–', '', `son ${DAYS} gün`, null), '');
    container.innerHTML = '<p class="chart-empty">Bölge için nabız/güç/tempo verisi yok. GPX içe aktar veya kayıtta gir.</p>';
    return;
  }

  // Glance: en çok zaman geçirilen bölge
  const domIdx = zoneSec.indexOf(Math.max(...zoneSec));
  const domPct = Math.round((zoneSec[domIdx] / total) * 100);
  const lowPct = Math.round(((zoneSec[0] + zoneSec[1]) / total) * 100);
  setGlance('hrzone',
    glanceTop(HR_ZONE_META[domIdx].name.split(' ')[0], '', `%${domPct} · en çok bölge (HR/güç/tempo)`, null),
    `Son ${DAYS} gün ağırlığı ${HR_ZONE_META[domIdx].name}; düşük yoğunluk (Z1–Z2) %${lowPct}.` +
    (hasThresholds ? '' : ' İpucu: Ayarlar\'a LTHR/FTP/eşik tempo girersen bölgeler branşa göre daha doğru hesaplanır.'));

  container.innerHTML = HR_ZONE_META.map((z, i) => {
    const pct = Math.round((zoneSec[i] / total) * 100);
    return `
      <div class="hr-zone-row">
        <span class="hr-zone-label">${z.name}</span>
        <div class="hr-zone-track"><div class="hr-zone-fill" style="width:${pct}%; background:${z.color};"></div></div>
        <span class="hr-zone-pct">${pct}%</span>
      </div>`;
  }).join('');
}

// --- Glanceable başlık yardımcıları ---
export function glanceTop(valueHTML, unit, sub, trend) {
  const t = trend ? `<span class="glance-trend ${trend.tone}">${trend.text}</span>` : '';
  return `<div class="glance-header">
    <div>
      <span class="glance-value">${valueHTML}</span>${unit ? `<span class="glance-unit">${unit}</span>` : ''}
      <div class="glance-sub">${sub}</div>
    </div>${t}
  </div>`;
}
export function glanceInsight(text) {
  return `<div class="glance-insight">${text}</div>`;
}
export function setGlance(prefix, topHTML, insightText) {
  const top = document.getElementById(`glance-${prefix}-top`);
  const ins = document.getElementById(`glance-${prefix}-insight`);
  if (top) top.innerHTML = topHTML;
  if (ins) ins.innerHTML = glanceInsight(insightText);
}
// goodUp: true=artış iyi, false=artış kötü, null=nötr (gri renk)
export function makeTrend(curr, prev, goodUp, fmt) {
  if (prev == null || curr == null || (prev === 0 && curr === 0)) return null;
  const diff = curr - prev;
  if (Math.abs(diff) < 0.05) return { text: '→ sabit', tone: 'flat' };
  const arrow = diff > 0 ? '▲' : '▼';
  let tone = 'flat';
  if (goodUp !== null) tone = ((diff > 0) === goodUp) ? 'up' : 'down';
  return { text: `${arrow} ${fmt(Math.abs(diff))}`, tone };
}
// holistic alanından gün aralığındaki değerler (offset 0 = currentDate)
export function holisticValues(field, fromOffset, toOffset) {
  const arr = [];
  for (let i = fromOffset; i <= toOffset; i++) {
    const log = state.holisticLogs[addDaysStr(currentDateStr, -i)] || {};
    if (typeof log[field] === 'number') arr.push(log[field]);
  }
  return arr;
}
export function avgOf(arr) { return arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : null; }
export function fmtMinutes(min) {
  const h = Math.floor(min / 60), m = Math.round(min % 60);
  return h > 0 ? `${h}s ${m}dk` : `${m}dk`;
}

// --- Bu Hafta Özet Kartları ---
export function renderAnalysisSummary() {
  const weekStart = mondayOf(currentDateStr);
  const weekEnd = addDaysStr(weekStart, 6);
  const weekWorkouts = state.workouts.filter(w => w.date >= weekStart && w.date <= weekEnd);

  let totalSec = 0, totalKm = 0, rpeSum = 0, rpeCount = 0;
  weekWorkouts.forEach(w => {
    totalSec += w.duration || 0;
    if (w.sport === 'run' || w.sport === 'bike') totalKm += (w.distance || 0);
    if (typeof w.rpe === 'number') { rpeSum += w.rpe; rpeCount++; }
  });

  const h = Math.floor(totalSec / 3600);
  const m = Math.round((totalSec % 3600) / 60);
  const durStr = h > 0 ? `${h}s ${m}dk` : `${m}dk`;
  const avgRpe = rpeCount ? (Math.round((rpeSum / rpeCount) * 10) / 10) : '–';

  const cards = [
    { value: durStr, label: 'Bu Hafta Süre' },
    { value: `${Math.round(totalKm * 10) / 10} km`, label: 'Mesafe (koşu+bisiklet)' },
    { value: weekWorkouts.length, label: 'Antrenman Sayısı' },
    { value: avgRpe, label: 'Ortalama RPE' }
  ];

  document.getElementById('analysis-summary').innerHTML = cards.map(c => `
    <div class="analysis-stat-card">
      <div class="stat-value">${c.value}</div>
      <div class="stat-label">${c.label}</div>
    </div>`).join('');
}

// --- Haftalık Antrenman Yükü (Stacked Bar, son 8 hafta) ---
export function renderWeeklyLoadChart() {
  const container = document.getElementById('chart-weekly-load');
  const legendEl = document.getElementById('chart-weekly-load-legend');
  const WEEKS = 8;
  const thisMonday = mondayOf(currentDateStr);

  const weeks = [];
  const startIndex = {};
  for (let i = WEEKS - 1; i >= 0; i--) {
    const start = addDaysStr(thisMonday, -i * 7);
    const d = parseLocalDate(start);
    weeks.push({ start, label: `${d.getDate()}/${d.getMonth() + 1}`, totals: { run: 0, bike: 0, swim: 0, fitness: 0 } });
  }
  weeks.forEach((w, idx) => { startIndex[w.start] = idx; });

  state.workouts.forEach(w => {
    const mon = mondayOf(w.date);
    if (mon in startIndex) {
      const sp = (weeks[0].totals[w.sport] !== undefined) ? w.sport : 'fitness';
      weeks[startIndex[mon]].totals[sp] += (w.duration || 0) / 60; // dakika
    }
  });

  const weekSum = w => SPORT_ORDER.reduce((a, sp) => a + w.totals[sp], 0);
  const maxTotal = Math.max(...weeks.map(weekSum));

  // Glanceable özet: bu hafta vs geçen hafta
  const currWeekMin = weekSum(weeks[weeks.length - 1]);
  const prevWeekMin = weekSum(weeks[weeks.length - 2]);
  const loadTrend = makeTrend(currWeekMin, prevWeekMin, null, d => `${Math.round(d)}dk`);
  let loadInsight;
  if (currWeekMin === 0) loadInsight = 'Bu hafta henüz antrenman kaydın yok.';
  else if (!prevWeekMin) loadInsight = 'Bu hafta antrenmana başladın 💪';
  else {
    const pct = Math.round((currWeekMin - prevWeekMin) / prevWeekMin * 100);
    if (pct > 30) loadInsight = `Yük geçen haftaya göre %${pct} arttı — toparlanmaya dikkat et.`;
    else if (pct < -30) loadInsight = `Bu hafta yük %${Math.abs(pct)} daha hafif; iyi bir dinlenme haftası.`;
    else loadInsight = 'İstikrarlı bir antrenman haftası 👍';
  }
  setGlance('load', glanceTop(fmtMinutes(currWeekMin), '', 'bu hafta toplam süre', loadTrend), loadInsight);

  const present = SPORT_ORDER.filter(sp => weeks.some(w => w.totals[sp] > 0));
  if (present.length === 0) {
    container.innerHTML = '<p class="chart-empty">Bu aralıkta antrenman verisi yok.</p>';
    legendEl.innerHTML = '';
    return;
  }

  const W = 320, H = 200, left = 30, right = 8, top = 12, bottom = 26;
  const plotW = W - left - right, plotH = H - top - bottom;
  const slot = plotW / weeks.length;
  const barW = Math.min(26, slot * 0.6);

  let bars = '';
  weeks.forEach((wk, i) => {
    const cx = left + slot * (i + 0.5);
    let yCursor = top + plotH;
    SPORT_ORDER.forEach(sp => {
      const val = wk.totals[sp];
      if (val > 0) {
        const hgt = (val / maxTotal) * plotH;
        yCursor -= hgt;
        bars += `<rect x="${(cx - barW / 2).toFixed(1)}" y="${yCursor.toFixed(1)}" width="${barW.toFixed(1)}" height="${hgt.toFixed(1)}" rx="2" style="fill:${SPORT_META[sp].color}"></rect>`;
      }
    });
    bars += `<text x="${cx.toFixed(1)}" y="${H - bottom + 14}" text-anchor="middle" font-size="9" style="fill:var(--text-muted)">${wk.label}</text>`;
  });

  const axis = `<line x1="${left}" y1="${top + plotH}" x2="${W - right}" y2="${top + plotH}" style="stroke:var(--card-border)" stroke-width="1"></line>
    <text x="${left - 4}" y="${top + 6}" text-anchor="end" font-size="9" style="fill:var(--text-muted)">${Math.round(maxTotal)}dk</text>`;

  container.innerHTML = `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid meet">${axis}${bars}</svg>`;
  legendEl.innerHTML = present.map(sp =>
    `<div class="chart-legend-item"><span class="chart-legend-dot" style="background:${SPORT_META[sp].color}"></span>${SPORT_META[sp].name}</div>`
  ).join('');
}

// --- Branş Dağılımı (Donut) ---
export function renderSportDistChart() {
  const container = document.getElementById('chart-sport-dist');
  const totals = { run: 0, bike: 0, swim: 0, fitness: 0 };
  state.workouts.forEach(w => {
    const sp = (totals[w.sport] !== undefined) ? w.sport : 'fitness';
    totals[sp] += (w.duration || 0);
  });
  const grand = SPORT_ORDER.reduce((a, sp) => a + totals[sp], 0);

  if (grand <= 0) {
    container.innerHTML = '<p class="chart-empty">Henüz antrenman kaydı yok.</p>';
    setGlance('dist', glanceTop('—', '', 'henüz veri yok', null),
      'İlk antrenmanını ekleyince branş dağılımın burada görünecek.');
    return;
  }

  const present = SPORT_ORDER.filter(sp => totals[sp] > 0);

  // Glanceable özet: en sık yapılan branş
  const dominant = present.reduce((a, b) => totals[b] > totals[a] ? b : a, present[0]);
  const domPct = Math.round((totals[dominant] / grand) * 100);
  const missing = SPORT_ORDER.filter(sp => totals[sp] === 0).map(sp => SPORT_META[sp].name);
  let distInsight;
  if (domPct >= 70) distInsight = `Ağırlıklı ${SPORT_META[dominant].name} (%${domPct}). Diğer branşlara da zaman ayırmak dengeni artırır.`;
  else if (present.length >= 3) distInsight = 'Branşların dengeli dağılmış 👍';
  else distInsight = `Antrenmanların ${SPORT_META[dominant].name} ağırlıklı.`;
  if (missing.length) distInsight += ` Hiç yapılmayan: ${missing.join(', ')}.`;
  setGlance('dist', glanceTop(SPORT_META[dominant].name, '', `%${domPct} · en sık branş`, null), distInsight);

  const size = 150, stroke = 24, r = (size - stroke) / 2, cx = size / 2, cy = size / 2;
  const C = 2 * Math.PI * r;

  let acc = 0, segs = '';
  present.forEach(sp => {
    const len = (totals[sp] / grand) * C;
    segs += `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" style="stroke:${SPORT_META[sp].color}" stroke-width="${stroke}" stroke-dasharray="${len.toFixed(2)} ${(C - len).toFixed(2)}" stroke-dashoffset="${(-acc).toFixed(2)}" transform="rotate(-90 ${cx} ${cy})"></circle>`;
    acc += len;
  });

  const hours = Math.round((grand / 3600) * 10) / 10;
  const center = `<text x="${cx}" y="${cy - 2}" text-anchor="middle" font-size="22" font-weight="700" style="fill:var(--text-primary)">${hours}</text>
    <text x="${cx}" y="${cy + 15}" text-anchor="middle" font-size="10" style="fill:var(--text-muted)">saat</text>`;

  const svg = `<svg viewBox="0 0 ${size} ${size}" style="width:${size}px; max-width:45%;">${segs}${center}</svg>`;
  const legend = `<div style="display:flex; flex-direction:column; gap:8px;">` + present.map(sp => {
    const pct = Math.round((totals[sp] / grand) * 100);
    return `<div class="chart-legend-item"><span class="chart-legend-dot" style="background:${SPORT_META[sp].color}"></span>${SPORT_META[sp].name} · ${pct}%</div>`;
  }).join('') + `</div>`;

  container.innerHTML = svg + legend;
}

