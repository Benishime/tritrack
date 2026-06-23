import { renderAnalysisView } from './analysis.js';
import { addImportedWorkout, guessSport } from './importgpx.js';
import { saveState, state } from './state.js';
import { renderTodayView } from './today.js';
import { showToast } from './utils.js';

// ==========================================
// 11.B STRAVA CANLI SENKRONU (kişisel — Cloudflare Worker proxy üzerinden)
// ==========================================

// Yayınlanan Worker URL'si. Boşsa Profil'deki alandan girilebilir (state.profile.stravaProxy).
export const STRAVA_PROXY_URL = 'https://tritrack-strava-proxy.ahmettaha.workers.dev';

export function stravaProxyUrl() {
  let url = (state.profile.stravaProxy || STRAVA_PROXY_URL || '').trim().replace(/\/$/, '');
  if (url && !/^https?:\/\//i.test(url)) {
    url = 'https://' + url;
  }
  return url;
}

export function initStravaSync() {
  // OAuth dönüşü: URL fragment'ında refresh_token geldiyse yakala ve sakla
  handleStravaRedirect();

  const connectBtn = document.getElementById('strava-connect-btn');
  const syncBtn = document.getElementById('strava-sync-btn');
  const proxyInput = document.getElementById('strava-proxy-input');
  if (!connectBtn) return;

  if (proxyInput) {
    proxyInput.value = state.profile.stravaProxy || '';
    proxyInput.addEventListener('change', () => {
      state.profile.stravaProxy = proxyInput.value.trim();
      saveState();
      renderStravaStatus();
    });
  }

  connectBtn.addEventListener('click', connectStrava);
  syncBtn.addEventListener('click', syncStrava);
  renderStravaStatus();
}

export function connectStrava() {
  const proxy = stravaProxyUrl();
  if (!proxy) {
    showToast('Önce Strava Proxy URL\'sini gir (STRAVA-KURULUM.md).', 'error');
    return;
  }
  // Dönüş adresi = bu sayfanın temizlenmiş URL'si (fragment'sız)
  const returnUrl = location.origin + location.pathname;
  location.href = `${proxy}/login?return=${encodeURIComponent(returnUrl)}`;
}

// Worker'dan fragment ile dönen refresh_token'ı yakala
export function handleStravaRedirect() {
  if (!location.hash || location.hash.indexOf('strava_token=') === -1) return;
  const params = new URLSearchParams(location.hash.slice(1));
  const token = params.get('strava_token');
  const athlete = params.get('athlete');
  if (token) {
    state.profile.strava = { refreshToken: token, athleteId: athlete || null, lastSync: 0 };
    saveState();
    // fragment'ı temizle (token URL'de kalmasın)
    history.replaceState(null, '', location.origin + location.pathname);
    showToast('Strava bağlandı ✅ Şimdi "Son antrenmanları çek".');
  }
}

export async function syncStrava() {
  const proxy = stravaProxyUrl();
  const sv = state.profile.strava;
  if (!proxy) { showToast('Strava Proxy URL\'si gerekli.', 'error'); return; }
  if (!sv || !sv.refreshToken) { showToast('Önce Strava\'yı bağla.', 'error'); return; }

  const statusEl = document.getElementById('strava-status');
  if (statusEl) statusEl.textContent = 'Strava\'dan çekiliyor...';

  try {
    const res = await fetch(`${proxy}/sync`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: sv.refreshToken, after: sv.lastSync || 0 })
    });
    if (!res.ok) throw new Error('proxy ' + res.status);
    const data = await res.json();
    if (data.error) throw new Error(data.error);

    let added = 0, skipped = 0;
    (data.activities || []).forEach(act => {
      const mapped = mapStravaActivity(act);
      if (mapped && mapped.duration > 0) {
        (addImportedWorkout(mapped) === 'added') ? added++ : skipped++;
      }
    });

    // refresh_token rotasyona uğramış olabilir; güncelle + son senkron zamanını ilerlet
    if (data.refresh_token) sv.refreshToken = data.refresh_token;
    sv.lastSync = Math.floor(Date.now() / 1000);
    saveState();

    if (typeof renderTodayView === 'function') renderTodayView();
    if (typeof renderAnalysisView === 'function' && document.getElementById('view-analysis')?.classList.contains('active')) renderAnalysisView();

    renderStravaStatus();
    if (statusEl) statusEl.textContent = `${added} eklendi · ${skipped} zaten vardı`;
    showToast(added ? `${added} antrenman Strava'dan eklendi ✅` : 'Yeni antrenman yok.');
  } catch (err) {
    console.error('Strava senkron hatası', err);
    if (statusEl) statusEl.textContent = 'Senkron başarısız — proxy/bağlantıyı kontrol et.';
    showToast('Strava senkronu başarısız oldu.', 'error');
  }
}

// Strava SummaryActivity → addImportedWorkout girdisi
export function mapStravaActivity(act) {
  if (!act || !act.type) return null;
  const typeMap = {
    Run: 'run', TrailRun: 'run', VirtualRun: 'run', Walk: 'run', Hike: 'run',
    Ride: 'bike', VirtualRide: 'bike', EBikeRide: 'bike', GravelRide: 'bike', MountainBikeRide: 'bike',
    Swim: 'swim',
    Workout: 'fitness', WeightTraining: 'fitness', Crossfit: 'fitness'
  };
  const sport = typeMap[act.type] || guessSport(act.type);
  return {
    sport,
    startTime: new Date(act.start_date_local || act.start_date),
    duration: Math.round(act.moving_time || act.elapsed_time || 0),
    distanceM: act.distance || 0,
    avgHr: act.average_heartrate ? Math.round(act.average_heartrate) : null,
    power: act.average_watts || null,
    name: act.name || '',
    stravaId: String(act.id),
    source: 'strava'
  };
}

export function renderStravaStatus() {
  const statusEl = document.getElementById('strava-status');
  const syncBtn = document.getElementById('strava-sync-btn');
  const connectBtn = document.getElementById('strava-connect-btn');
  if (!statusEl) return;
  const sv = state.profile.strava;
  const connected = !!(sv && sv.refreshToken);
  if (syncBtn) syncBtn.disabled = !connected;
  if (connectBtn) connectBtn.textContent = connected ? '🟧 Strava\'yı Yeniden Bağla' : '🟧 Strava\'yı Bağla';
  if (connected) {
    const last = sv.lastSync ? new Date(sv.lastSync * 1000).toLocaleString('tr-TR') : 'henüz yok';
    statusEl.textContent = `Bağlı (sporcu ${sv.athleteId || '?'}). Son senkron: ${last}`;
  } else {
    statusEl.textContent = stravaProxyUrl() ? 'Bağlı değil.' : 'Proxy URL girilmedi (STRAVA-KURULUM.md).';
  }
}

