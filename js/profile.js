import { AI_PROVIDERS, aiKey, aiProvider, generateCoachReport, generateWeeklyReport, handleCoachChat } from './ai.js';
import { saveState, state } from './state.js';
import { renderTodayView } from './today.js';
import { showToast } from './utils.js';

// ==========================================
// 8. PROFİL AYARLARI VE YAPAY ZEKA ANTRENÖRÜ
// ==========================================

export function initProfileView() {
  const settingsForm = document.getElementById('form-settings');

  document.getElementById('settings-name').value = state.profile.name || '';
  document.getElementById('settings-race-name').value = state.profile.raceName || '';
  document.getElementById('settings-race-date').value = state.profile.raceDate || '';
  document.getElementById('settings-weight').value = state.profile.weight || '';
  document.getElementById('settings-calories').value = state.profile.targetDailyCalories || 2500;
  document.getElementById('settings-weight-goal').value = state.profile.weightGoal || '';
  document.getElementById('settings-p-target').value = state.profile.targetMacros.protein || 150;
  document.getElementById('settings-c-target').value = state.profile.targetMacros.carbs || 300;
  document.getElementById('settings-f-target').value = state.profile.targetMacros.fat || 70;
  document.getElementById('settings-max-hr').value = state.profile.maxHr || '';
  document.getElementById('settings-resting-hr').value = state.profile.restingHr || '';
  document.getElementById('settings-lthr').value = state.profile.lthr || '';
  document.getElementById('settings-ftp').value = state.profile.ftp || '';
  document.getElementById('settings-threshold-pace').value = state.profile.thresholdPace || '';
  // AI sağlayıcı / model / anahtar
  const aiProviderSel = document.getElementById('settings-ai-provider');
  const aiModelInp = document.getElementById('settings-ai-model');
  const aiKeyInp = document.getElementById('settings-ai-key');
  const aiKeyLabel = document.getElementById('settings-ai-key-label');
  aiProviderSel.value = state.profile.aiProvider || 'gemini';
  aiModelInp.value = state.profile.aiModel || '';
  const syncAiKeyField = () => {
    const prov = aiProviderSel.value;
    aiModelInp.placeholder = AI_PROVIDERS[prov].defaultModel;
    aiKeyLabel.textContent = prov === 'gemini' ? 'Gemini' : prov === 'claude' ? 'Claude' : 'OpenAI';
    aiKeyInp.value = state.profile[AI_PROVIDERS[prov].keyField] || '';
  };
  aiProviderSel.addEventListener('change', syncAiKeyField);
  syncAiKeyField();

  updateAiBadge();

  settingsForm.addEventListener('submit', (e) => {
    e.preventDefault();

    state.profile.name = document.getElementById('settings-name').value;
    state.profile.raceName = (document.getElementById('settings-race-name').value || '').trim() || null;
    state.profile.raceDate = document.getElementById('settings-race-date').value || null;
    state.profile.weight = parseFloat(document.getElementById('settings-weight').value);
    const wgVal = parseFloat(document.getElementById('settings-weight-goal').value);
    state.profile.weightGoal = isNaN(wgVal) ? null : wgVal;
    state.profile.targetDailyCalories = parseInt(document.getElementById('settings-calories').value);
    state.profile.targetMacros.protein = parseInt(document.getElementById('settings-p-target').value);
    state.profile.targetMacros.carbs = parseInt(document.getElementById('settings-c-target').value);
    state.profile.targetMacros.fat = parseInt(document.getElementById('settings-f-target').value);
    const numOrNull = (id) => { const v = parseInt(document.getElementById(id).value); return isNaN(v) ? null : v; };
    state.profile.maxHr = numOrNull('settings-max-hr');
    state.profile.restingHr = numOrNull('settings-resting-hr');
    state.profile.lthr = numOrNull('settings-lthr');
    state.profile.ftp = numOrNull('settings-ftp');
    state.profile.thresholdPace = (document.getElementById('settings-threshold-pace').value || '').trim() || null;
    const aiProv = document.getElementById('settings-ai-provider').value;
    state.profile.aiProvider = aiProv;
    state.profile.aiModel = (document.getElementById('settings-ai-model').value || '').trim() || null;
    state.profile[AI_PROVIDERS[aiProv].keyField] = document.getElementById('settings-ai-key').value;

    saveState();
    showToast("Profil ayarları kaydedildi.");
    updateAiBadge();
    renderTodayView();
  });

  const estBtn = document.getElementById('estimate-thresholds-btn');
  if (estBtn) estBtn.addEventListener('click', applyEstimatedThresholds);

  // Sadece performans eşiklerini kaydet (sayfanın altına inmeden)
  const saveThrBtn = document.getElementById('save-thresholds-btn');
  if (saveThrBtn) saveThrBtn.addEventListener('click', () => {
    const numOrNull = (id) => { const v = parseInt(document.getElementById(id).value); return isNaN(v) ? null : v; };
    state.profile.maxHr = numOrNull('settings-max-hr');
    state.profile.restingHr = numOrNull('settings-resting-hr');
    state.profile.lthr = numOrNull('settings-lthr');
    state.profile.ftp = numOrNull('settings-ftp');
    state.profile.thresholdPace = (document.getElementById('settings-threshold-pace').value || '').trim() || null;
    saveState();
    showToast('Performans eşikleri kaydedildi ✅');
  });

  // AI ayarlarını ayrıca kaydet (Ayarlar alt sayfası)
  const saveAiBtn = document.getElementById('save-ai-btn');
  if (saveAiBtn) saveAiBtn.addEventListener('click', () => {
    const aiProv = document.getElementById('settings-ai-provider').value;
    state.profile.aiProvider = aiProv;
    state.profile.aiModel = (document.getElementById('settings-ai-model').value || '').trim() || null;
    state.profile[AI_PROVIDERS[aiProv].keyField] = document.getElementById('settings-ai-key').value;
    saveState();
    updateAiBadge();
    showToast('AI ayarları kaydedildi ✅');
  });

  // Profil alt sayfa segment geçişi (Verilerim / Ayarlar / Strava)
  document.querySelectorAll('#profile-segment .diet-segment-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const pane = btn.getAttribute('data-ppane');
      document.querySelectorAll('#profile-segment .diet-segment-btn')
        .forEach(b => b.classList.toggle('active', b === btn));
      document.querySelectorAll('#view-profile .profile-pane')
        .forEach(p => p.classList.toggle('active', p.id === `ppane-${pane}`));
    });
  });

  const analyzeBtn = document.getElementById('ai-analyze-btn');
  const sendBtn = document.getElementById('ai-send-btn');
  const chatInput = document.getElementById('ai-chat-input');

  analyzeBtn.addEventListener('click', () => {
    generateCoachReport();
  });

  const weeklyReportBtn = document.getElementById('ai-weekly-report-btn');
  if (weeklyReportBtn) weeklyReportBtn.addEventListener('click', generateWeeklyReport);
  const weeklyPlanBtn = document.getElementById('ai-weekly-plan-btn');
  if (weeklyPlanBtn) weeklyPlanBtn.addEventListener('click', () => {
    handleCoachChat('Hedef yarışıma, güncel formuma (Form/TSB ve ACWR) ve son antrenmanlarıma göre BU HAFTA için dengeli bir antrenman planı oluştur ve haftalikPlanEkle aracıyla ekle. Dinlenme/toparlanma günleri bırak, branşları dengele.');
  });

  sendBtn.addEventListener('click', () => {
    const text = chatInput.value.trim();
    if (text) {
      handleCoachChat(text);
      chatInput.value = '';
    }
  });

  chatInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      const text = chatInput.value.trim();
      if (text) {
        handleCoachChat(text);
        chatInput.value = '';
      }
    }
  });

  renderProfileView();
}

export function updateAiBadge() {
  const badge = document.getElementById('ai-status-badge');
  if (!badge) return;
  if (aiKey()) {
    badge.innerText = AI_PROVIDERS[aiProvider()].label + ' · Bulut';
    badge.className = "badge badge-cloud";
    badge.style.backgroundColor = 'rgba(59, 130, 246, 0.15)';
    badge.style.color = 'var(--accent-blue)';
    badge.style.border = '1px solid rgba(59, 130, 246, 0.3)';
  } else {
    badge.innerText = "Yerel Mod";
    badge.className = "badge badge-local";
    badge.style.backgroundColor = 'rgba(156, 163, 175, 0.15)';
    badge.style.color = 'var(--text-secondary)';
    badge.style.border = '1px solid var(--card-border)';
  }
}

export function renderProfileView() {
  updateAiBadge();
}

// Sporcunun kendi antrenman geçmişinden eşik değerlerini tahmin et
export function estimateThresholds() {
  const ws = state.workouts || [];
  const withHr = ws.filter(w => typeof w.hr === 'number' && w.hr > 0);
  const longHr = withHr.filter(w => (w.duration || 0) >= 1200); // ≥20dk seans
  const est = {};

  // maxHR: görülen en yüksek nabız; yoksa 220−yaş
  if (withHr.length) est.maxHr = Math.max(...withHr.map(w => w.hr));
  else if (state.profile.age) est.maxHr = 220 - state.profile.age;

  // LTHR: ≥20dk seansların en yüksek ort. nabzı (≈ eşik efor); yoksa 0.90×maxHR
  if (longHr.length) est.lthr = Math.max(...longHr.map(w => w.hr));
  else { const mh = est.maxHr || state.profile.maxHr; if (mh) est.lthr = Math.round(mh * 0.90); }

  // FTP: ≥20dk bisiklet sürüşlerinin en yüksek ort. gücü × 0.95 (kaba tahmin)
  const ridePw = ws.filter(w => w.sport === 'bike' && typeof w.power === 'number' && w.power > 0 && (w.duration || 0) >= 1200).map(w => w.power);
  if (ridePw.length) est.ftp = Math.round(Math.max(...ridePw) * 0.95);

  // Eşik tempo: ≥3km koşuların en hızlı temposu (dk/km)
  const runP = ws.filter(w => w.sport === 'run' && (w.distance || 0) >= 3 && (w.duration || 0) > 0).map(w => (w.duration / 60) / w.distance);
  if (runP.length) {
    const best = Math.min(...runP);
    const m = Math.floor(best), s = Math.round((best - m) * 60);
    est.thresholdPace = `${m}:${String(s).padStart(2, '0')}`;
  }
  return est;
}

// Tahminleri ayar alanlarına yaz (state'e değil — kullanıcı kontrol edip kaydeder)
export function applyEstimatedThresholds() {
  const est = estimateThresholds();
  const filled = [];
  if (est.maxHr) { document.getElementById('settings-max-hr').value = est.maxHr; filled.push(`maxHR ${est.maxHr}`); }
  if (est.lthr) { document.getElementById('settings-lthr').value = est.lthr; filled.push(`LTHR ${est.lthr}`); }
  if (est.ftp) { document.getElementById('settings-ftp').value = est.ftp; filled.push(`FTP ${est.ftp}w`); }
  if (est.thresholdPace) { document.getElementById('settings-threshold-pace').value = est.thresholdPace; filled.push(`tempo ${est.thresholdPace}`); }
  if (filled.length === 0) {
    showToast('Tahmin için yeterli veri yok — birkaç nabızlı/güçlü antrenman ekle.', 'error');
    return;
  }
  showToast('Tahmin: ' + filled.join(' · ') + '. Kontrol edip "Ayarları Kaydet"e bas.');
}

