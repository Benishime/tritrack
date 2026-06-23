import { renderProgramView } from './program.js';
import { formatDate, generateId, saveState, state } from './state.js';
import { renderTodayView } from './today.js';
import { showToast } from './utils.js';

// ==========================================
// 11. ANTRENMAN İÇE AKTARMA (GPX / TCX DOSYALARI)
// ==========================================

export function initWorkoutImport() {
  const importBtn = document.getElementById('workout-import-btn');
  const importInput = document.getElementById('workout-import-input');
  if (!importBtn) return;

  importBtn.addEventListener('click', () => importInput.click());
  importInput.addEventListener('change', (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length) handleWorkoutFiles(files);
    e.target.value = ''; // aynı dosyanın tekrar seçilebilmesi için sıfırla
  });
}

// Seçilen dosyaları sırayla oku ve içe aktar
export function handleWorkoutFiles(files) {
  const statusEl = document.getElementById('workout-import-status');
  statusEl.innerText = `${files.length} dosya okunuyor...`;

  let added = 0, skipped = 0, failed = 0, processed = 0;

  files.forEach(file => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target.result;
        const isTcx = /\.tcx$/i.test(file.name) || text.indexOf('TrainingCenterDatabase') !== -1;
        const parsed = isTcx ? parseTCX(text) : parseGPX(text);
        if (parsed && parsed.duration > 0) {
          addImportedWorkout(parsed) === 'added' ? added++ : skipped++;
        } else {
          failed++;
        }
      } catch (err) {
        console.error("İçe aktarma hatası:", file.name, err);
        failed++;
      }
      processed++;
      if (processed === files.length) finishImport(added, skipped, failed);
    };
    reader.onerror = () => {
      failed++; processed++;
      if (processed === files.length) finishImport(added, skipped, failed);
    };
    reader.readAsText(file);
  });
}

export function finishImport(added, skipped, failed) {
  saveState();
  renderTodayView();
  renderProgramView();

  const statusEl = document.getElementById('workout-import-status');
  const parts = [];
  if (added) parts.push(`${added} eklendi`);
  if (skipped) parts.push(`${skipped} zaten vardı`);
  if (failed) parts.push(`${failed} okunamadı`);
  statusEl.innerText = parts.length ? parts.join(' · ') : "Antrenman bulunamadı.";

  if (added) showToast(`${added} antrenman içe aktarıldı ✅`);
  else if (skipped && !failed) showToast("Bu antrenmanlar zaten kayıtlı.");
  else if (failed) showToast("Bazı dosyalar okunamadı veya geçersiz.");
}

// GPX dosyasını ayrıştır (Strava, Garmin, Polar vb.)
export function parseGPX(xmlText) {
  const doc = new DOMParser().parseFromString(xmlText, 'application/xml');
  if (doc.getElementsByTagName('parsererror').length > 0) return null;

  const trkpts = Array.from(doc.getElementsByTagName('trkpt'));
  if (trkpts.length === 0) return null;

  // Zaman damgaları (süre = son - ilk)
  let times = trkpts
    .map(pt => {
      const t = pt.getElementsByTagName('time')[0];
      return t ? new Date(t.textContent) : null;
    })
    .filter(Boolean);
  if (times.length === 0) {
    const metaTime = doc.getElementsByTagName('time')[0];
    if (metaTime) times = [new Date(metaTime.textContent)];
  }
  const startTime = times.length ? times[0] : new Date();
  const endTime = times.length ? times[times.length - 1] : startTime;
  const duration = Math.max(0, Math.round((endTime - startTime) / 1000));

  // Mesafe (Haversine ile nokta nokta toplam)
  let distanceM = 0;
  for (let i = 1; i < trkpts.length; i++) {
    const lat1 = parseFloat(trkpts[i - 1].getAttribute('lat'));
    const lon1 = parseFloat(trkpts[i - 1].getAttribute('lon'));
    const lat2 = parseFloat(trkpts[i].getAttribute('lat'));
    const lon2 = parseFloat(trkpts[i].getAttribute('lon'));
    if ([lat1, lon1, lat2, lon2].some(isNaN)) continue;
    distanceM += haversine(lat1, lon1, lat2, lon2);
  }

  // Nabız (extensions içindeki hr; namespace farklı olabilir)
  const hrValues = [];
  trkpts.forEach(pt => {
    const hrEl = Array.from(pt.getElementsByTagName('*')).find(el => el.localName === 'hr');
    if (hrEl) {
      const v = parseInt(hrEl.textContent, 10);
      if (!isNaN(v)) hrValues.push(v);
    }
  });
  const avgHr = hrValues.length ? Math.round(hrValues.reduce((a, b) => a + b, 0) / hrValues.length) : null;

  // İz (track): detay ekranı için ≤120 noktaya indirgenmiş {hr, lat, lon}
  const track = [];
  const step = Math.max(1, Math.ceil(trkpts.length / 120));
  for (let i = 0; i < trkpts.length; i += step) {
    const pt = trkpts[i];
    const lat = parseFloat(pt.getAttribute('lat'));
    const lon = parseFloat(pt.getAttribute('lon'));
    const hrEl = Array.from(pt.getElementsByTagName('*')).find(el => el.localName === 'hr');
    const hr = hrEl ? parseInt(hrEl.textContent, 10) : NaN;
    const o = {};
    if (!isNaN(lat) && !isNaN(lon)) { o.lat = Math.round(lat * 1e5) / 1e5; o.lon = Math.round(lon * 1e5) / 1e5; }
    if (!isNaN(hr)) o.hr = hr;
    if (Object.keys(o).length) track.push(o);
  }

  // Spor türü tahmini (<type> + isim)
  const typeEl = doc.getElementsByTagName('type')[0];
  const nameEl = doc.getElementsByTagName('name')[0];
  const rawType = (typeEl ? typeEl.textContent : '') + ' ' + (nameEl ? nameEl.textContent : '');

  return {
    sport: guessSport(rawType),
    startTime, duration, distanceM, avgHr,
    track: track.length ? track : null,
    name: nameEl ? nameEl.textContent.trim() : ''
  };
}

// TCX dosyasını ayrıştır (yapısal: Lap/TotalTimeSeconds/DistanceMeters)
export function parseTCX(xmlText) {
  const doc = new DOMParser().parseFromString(xmlText, 'application/xml');
  if (doc.getElementsByTagName('parsererror').length > 0) return null;

  const activity = doc.getElementsByTagName('Activity')[0];
  if (!activity) return null;

  const sportAttr = activity.getAttribute('Sport') || '';
  const idEl = activity.getElementsByTagName('Id')[0];
  const startTime = idEl ? new Date(idEl.textContent) : new Date();

  let duration = 0, distanceM = 0;
  const hrAvgs = [];
  Array.from(activity.getElementsByTagName('Lap')).forEach(lap => {
    const t = lap.getElementsByTagName('TotalTimeSeconds')[0];
    const d = lap.getElementsByTagName('DistanceMeters')[0];
    if (t) duration += parseFloat(t.textContent) || 0;
    if (d) distanceM += parseFloat(d.textContent) || 0;
    const hr = lap.getElementsByTagName('AverageHeartRateBpm')[0];
    if (hr) {
      const valEl = hr.getElementsByTagName('Value')[0];
      const v = valEl ? parseInt(valEl.textContent, 10) : NaN;
      if (!isNaN(v)) hrAvgs.push(v);
    }
  });

  return {
    sport: guessSport(sportAttr),
    startTime,
    duration: Math.round(duration),
    distanceM,
    avgHr: hrAvgs.length ? Math.round(hrAvgs.reduce((a, b) => a + b, 0) / hrAvgs.length) : null,
    name: sportAttr
  };
}

// Ayrıştırılan veriyi antrenman şemasına dönüştür + tekrar eklemeyi önle
export function addImportedWorkout(p) {
  const date = formatDate(p.startTime);
  const distKm = p.distanceM / 1000;
  const importKey = `${date}_${p.sport}_${p.duration}_${Math.round(p.distanceM)}`;

  // Tekrar-ekleme önleme: Strava ise kalıcı id ile, değilse importKey ile
  if (p.stravaId && state.workouts.some(w => w.stravaId === p.stravaId)) return 'skipped';
  if (state.workouts.some(w => w.importKey === importKey)) return 'skipped';

  const workout = {
    id: generateId('w_'),
    date,
    sport: p.sport,
    duration: p.duration,
    rpe: 5,
    importKey,
    notes: `İçe aktarıldı${p.name ? ' · ' + p.name : ''}`
  };

  if (p.source) workout.source = p.source;       // 'strava' → AI prompt'undan dışlanır
  if (p.stravaId) workout.stravaId = p.stravaId;
  if (p.track) workout.track = p.track;          // detay ekranı: HR/GPS izi

  if (p.sport === 'swim') {
    workout.distance = Math.round(p.distanceM); // yüzmede metre
    workout.pace = computePacePer100m(p.distanceM, p.duration);
  } else if (p.sport === 'bike') {
    workout.distance = Math.round(distKm * 100) / 100;
    workout.pace = computeSpeed(distKm, p.duration);
    if (p.power) workout.power = Math.round(p.power);
  } else {
    workout.distance = Math.round(distKm * 100) / 100;
    workout.pace = computePacePerKm(distKm, p.duration);
  }
  if (p.avgHr) workout.hr = p.avgHr;

  state.workouts.push(workout);

  // O güne/branşa ait tamamlanmamış planı otomatik tamamla + kayda bağla.
  // (İçe aktarılan = o günün seansı; aynı branştaki ilk açık planı kapatır. Farklı branş yaptıysan plan açık kalır.)
  const match = state.plans.find(pl => pl.date === date && pl.sport === workout.sport && !pl.completed);
  if (match) { match.completed = true; match.loggedWorkoutId = workout.id; }

  return 'added';
}

// İki GPS noktası arasındaki mesafe (metre)
export function haversine(lat1, lon1, lat2, lon2) {
  const R = 6371000;
  const toRad = d => d * Math.PI / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

// Spor türünü metinden tahmin et
export function guessSport(text) {
  const t = (text || '').toLowerCase();
  if (/(swim|yüz|yuz|pool|havuz)/.test(t)) return 'swim';
  if (/(bike|cycl|ride|bisiklet|biking)/.test(t)) return 'bike';
  if (/(run|koş|kos|jog|trail|walk|hike|yürü|yuru)/.test(t)) return 'run';
  return 'run'; // varsayılan
}

// Pace / hız yardımcıları (:60 taşmasını da engeller)
export function formatPace(paceDecimalMin, unitLabel) {
  let m = Math.floor(paceDecimalMin);
  let s = Math.round((paceDecimalMin - m) * 60);
  if (s === 60) { m += 1; s = 0; }
  return `${m}:${String(s).padStart(2, '0')} ${unitLabel}`;
}
export function computePacePerKm(km, durationSec) {
  if (km <= 0 || durationSec <= 0) return '-';
  return formatPace((durationSec / 60) / km, '/km');
}
export function computePacePer100m(meters, durationSec) {
  if (meters <= 0 || durationSec <= 0) return '-';
  return formatPace((durationSec / 60) / (meters / 100), '/100m');
}
export function computeSpeed(km, durationSec) {
  if (durationSec <= 0) return '-';
  return `${Math.round((km / (durationSec / 3600)) * 100) / 100} km/sa`;
}

