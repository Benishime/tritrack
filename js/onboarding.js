import { saveState, setNeedsOnboarding, state } from './state.js';
import { renderTodayView } from './today.js';
import { showToast } from './utils.js';

// ==========================================
// 13. ONBOARDING SİHİRBAZI (İLK AÇILIŞ KURULUMU)
// ==========================================

export let obStep = 1;
export let obActivityFactor = null;

// Mifflin-St Jeor BMR × aktivite faktörü ile kalori + sporcu makroları
export function computeNutritionTargets({ weight, height, age, gender, activityFactor }) {
  const bmr = 10 * weight + 6.25 * height - 5 * age + (gender === 'male' ? 5 : -161);
  const calories = Math.round((bmr * activityFactor) / 10) * 10;
  const protein = Math.round(1.8 * weight);           // dayanıklılık sporcusu: ~1.8 g/kg
  const fat = Math.round((calories * 0.25) / 9);      // kalorinin ~%25'i yağdan
  const carbs = Math.max(0, Math.round((calories - protein * 4 - fat * 9) / 4));
  return { calories, protein, carbs, fat };
}

export function initOnboarding() {
  const overlay = document.getElementById('onboarding-overlay');
  if (!overlay) return;

  overlay.querySelectorAll('.ob-intensity-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      overlay.querySelectorAll('.ob-intensity-btn').forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
      obActivityFactor = parseFloat(btn.dataset.factor);
    });
  });

  document.getElementById('ob-next').addEventListener('click', obNext);
  document.getElementById('ob-back').addEventListener('click', obBack);
}

export function showOnboarding() {
  obStep = 1;
  obRenderStep();
  document.getElementById('onboarding-overlay').classList.add('open');
}

export function obRenderStep() {
  const overlay = document.getElementById('onboarding-overlay');
  overlay.querySelectorAll('.ob-step').forEach(s => { s.hidden = (parseInt(s.dataset.step) !== obStep); });
  overlay.querySelectorAll('.ob-dot').forEach(d => d.classList.toggle('active', parseInt(d.dataset.step) <= obStep));
  document.getElementById('ob-back').style.display = (obStep === 1) ? 'none' : 'block';
  document.getElementById('ob-next').innerText = (obStep === 4) ? '🚀 Başla' : 'İleri';
}

export function obValidateStep() {
  if (obStep === 1) {
    if (!document.getElementById('ob-name').value.trim()) { showToast('Lütfen ismini gir.', 'error'); return false; }
  } else if (obStep === 2) {
    const w = parseFloat(document.getElementById('ob-weight').value);
    const h = parseFloat(document.getElementById('ob-height').value);
    const a = parseInt(document.getElementById('ob-age').value);
    if (!(w > 0) || !(h > 0) || !(a > 0)) { showToast('Lütfen kilo, boy ve yaş bilgilerini gir.', 'error'); return false; }
  } else if (obStep === 3) {
    if (!obActivityFactor) { showToast('Antrenman yoğunluğunu seç.', 'error'); return false; }
  }
  return true;
}

export function obNext() {
  if (!obValidateStep()) return;
  if (obStep === 3) obFillSummary(); // 4. adıma geçmeden önce hesapla
  if (obStep === 4) { obFinish(); return; }
  obStep++;
  obRenderStep();
}

export function obBack() {
  if (obStep > 1) { obStep--; obRenderStep(); }
}

export function obFillSummary() {
  const t = computeNutritionTargets({
    weight: parseFloat(document.getElementById('ob-weight').value),
    height: parseFloat(document.getElementById('ob-height').value),
    age: parseInt(document.getElementById('ob-age').value),
    gender: document.getElementById('ob-gender').value,
    activityFactor: obActivityFactor
  });
  document.getElementById('ob-cal').value = t.calories;
  document.getElementById('ob-protein').value = t.protein;
  document.getElementById('ob-carbs').value = t.carbs;
  document.getElementById('ob-fat').value = t.fat;
}

export function obFinish() {
  state.profile = {
    name: document.getElementById('ob-name').value.trim(),
    weight: parseFloat(document.getElementById('ob-weight').value),
    height: parseFloat(document.getElementById('ob-height').value),
    age: parseInt(document.getElementById('ob-age').value),
    gender: document.getElementById('ob-gender').value,
    activityFactor: obActivityFactor,
    targetDailyCalories: parseInt(document.getElementById('ob-cal').value) || 2500,
    targetMacros: {
      protein: parseInt(document.getElementById('ob-protein').value) || 150,
      carbs: parseInt(document.getElementById('ob-carbs').value) || 300,
      fat: parseInt(document.getElementById('ob-fat').value) || 70
    },
    raceName: (document.getElementById('ob-race-name').value || '').trim() || null,
    raceDate: document.getElementById('ob-race-date').value || null,
    geminiApiKey: ""
  };

  setNeedsOnboarding(false);
  saveState();
  document.getElementById('onboarding-overlay').classList.remove('open');

  // Profil formunu ve görünümleri yeni profile göre tazele
  document.getElementById('settings-name').value = state.profile.name;
  document.getElementById('settings-weight').value = state.profile.weight;
  document.getElementById('settings-calories').value = state.profile.targetDailyCalories;
  document.getElementById('settings-p-target').value = state.profile.targetMacros.protein;
  document.getElementById('settings-c-target').value = state.profile.targetMacros.carbs;
  document.getElementById('settings-f-target').value = state.profile.targetMacros.fat;

  renderTodayView();
  showToast(`Hoş geldin ${state.profile.name}! 🎉`);
}

