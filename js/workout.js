import { navigateToView } from './main.js';
import { currentDateStr, generateId, saveState, state } from './state.js';
import { showToast } from './utils.js';

export let editingWorkoutId = null;
// ==========================================
// 7. ANTRENMAN KAYIT (WORKOUT LOGGER) YÖNETİMİ
// ==========================================

export function initWorkoutLogView() {
  const tabs = document.querySelectorAll('.sports-tabs .sport-tab-btn');
  const forms = document.querySelectorAll('.form-card .sport-log-form');

  ['run', 'bike', 'swim', 'fitness'].forEach(sport => {
    const slider = document.getElementById(`${sport}-rpe`);
    const indicator = document.getElementById(`${sport}-rpe-val`);
    if (slider) {
      slider.addEventListener('input', (e) => {
        indicator.innerText = e.target.value;
      });
    }
  });

  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      const sport = tab.getAttribute('data-sport');

      tabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');

      forms.forEach(form => {
        form.classList.remove('active');
        if (form.id === `form-log-${sport}`) {
          form.classList.add('active');
        }
      });
    });
  });

  const addExBtn = document.getElementById('add-exercise-row-btn');
  const exContainer = document.getElementById('fitness-exercises-container');
  addExBtn.addEventListener('click', () => {
    const row = document.createElement('div');
    row.className = 'exercise-row card';
    row.style.padding = '12px';
    row.style.marginBottom = '12px';
    row.style.backgroundColor = 'var(--bg-secondary)';
    row.innerHTML = `
      <div class="form-group">
        <label class="form-label">Hareket Adı</label>
        <input type="text" class="form-control exercise-name" placeholder="Egzersiz adı" required>
      </div>
      <div class="grid-3">
        <div class="form-group">
          <label class="form-label">Set</label>
          <input type="number" class="form-control exercise-sets" min="1" value="3" required>
        </div>
        <div class="form-group">
          <label class="form-label">Tekrar</label>
          <input type="number" class="form-control exercise-reps" min="1" value="10" required>
        </div>
        <div class="form-group">
          <label class="form-label">Kilo (kg)</label>
          <input type="number" class="form-control exercise-weight" min="0" step="0.5" value="20" required>
        </div>
      </div>
      <button type="button" class="btn btn-ghost btn-remove-ex-row btn-full mt-2" style="padding:6px; border-radius:6px; font-size:12px;">Satırı Sil</button>
    `;

    row.querySelector('.btn-remove-ex-row').addEventListener('click', () => {
      row.remove();
    });

    exContainer.appendChild(row);
  });

  // Koşu Form Kayıt
  document.getElementById('form-log-run').addEventListener('submit', (e) => {
    e.preventDefault();
    const distance = parseFloat(document.getElementById('run-distance').value);
    const h = parseInt(document.getElementById('run-duration-h').value) || 0;
    const m = parseInt(document.getElementById('run-duration-m').value) || 0;
    const s = parseInt(document.getElementById('run-duration-s').value) || 0;
    const duration = (h * 3600) + (m * 60) + s;
    const hr = parseInt(document.getElementById('run-hr').value) || null;
    const rpe = parseInt(document.getElementById('run-rpe').value);
    const notes = document.getElementById('run-notes').value;

    if (duration <= 0 || distance <= 0) {
      showToast("Lütfen mesafe ve süre değerlerini girin.", 'error');
      return;
    }

    const totalMinutes = duration / 60;
    const paceDecimal = totalMinutes / distance;
    const paceMin = Math.floor(paceDecimal);
    const paceSec = Math.round((paceDecimal - paceMin) * 60);
    const paceStr = `${paceMin}:${String(paceSec).padStart(2, '0')} /km`;

    const workout = {
      id: generateId('w_'),
      date: currentDateStr,
      sport: 'run',
      duration,
      distance,
      pace: paceStr,
      hr,
      rpe,
      notes
    };

    saveWorkoutAndRoute(workout);
  });

  // Bisiklet Form Kayıt
  document.getElementById('form-log-bike').addEventListener('submit', (e) => {
    e.preventDefault();
    const distance = parseFloat(document.getElementById('bike-distance').value);
    const h = parseInt(document.getElementById('bike-duration-h').value) || 0;
    const m = parseInt(document.getElementById('bike-duration-m').value) || 0;
    const s = parseInt(document.getElementById('bike-duration-s').value) || 0;
    const duration = (h * 3600) + (m * 60) + s;
    const power = parseInt(document.getElementById('bike-power').value) || null;
    const cadence = parseInt(document.getElementById('bike-cadence').value) || null;
    const rpe = parseInt(document.getElementById('bike-rpe').value);
    const notes = document.getElementById('bike-notes').value;

    if (duration <= 0 || distance <= 0) {
      showToast("Lütfen mesafe ve süre değerlerini girin.", 'error');
      return;
    }

    const speed = Math.round((distance / (duration / 3600)) * 100) / 100;
    const paceStr = `${speed} km/sa`;

    const workout = {
      id: generateId('w_'),
      date: currentDateStr,
      sport: 'bike',
      duration,
      distance,
      pace: paceStr,
      power,
      cadence,
      rpe,
      notes
    };

    saveWorkoutAndRoute(workout);
  });

  // Yüzme Form Kayıt
  document.getElementById('form-log-swim').addEventListener('submit', (e) => {
    e.preventDefault();
    const pool = document.getElementById('swim-pool').value;
    const distance = parseInt(document.getElementById('swim-distance').value);
    const h = parseInt(document.getElementById('swim-duration-h').value) || 0;
    const m = parseInt(document.getElementById('swim-duration-m').value) || 0;
    const s = parseInt(document.getElementById('swim-duration-s').value) || 0;
    const duration = (h * 3600) + (m * 60) + s;
    const rpe = parseInt(document.getElementById('swim-rpe').value);
    const notes = document.getElementById('swim-notes').value;

    if (duration <= 0 || distance <= 0) {
      showToast("Lütfen mesafe ve süre girin.", 'error');
      return;
    }

    const portions100m = distance / 100;
    const paceDecimal = (duration / 60) / portions100m;
    const paceMin = Math.floor(paceDecimal);
    const paceSec = Math.round((paceDecimal - paceMin) * 60);
    const paceStr = `${paceMin}:${String(paceSec).padStart(2, '0')} /100m`;

    const workout = {
      id: generateId('w_'),
      date: currentDateStr,
      sport: 'swim',
      duration,
      distance,
      poolLength: pool,
      pace: paceStr,
      rpe,
      notes
    };

    saveWorkoutAndRoute(workout);
  });

  // Fitness Form Kayıt
  document.getElementById('form-log-fitness').addEventListener('submit', (e) => {
    e.preventDefault();
    const category = document.getElementById('fitness-category').value;
    const rpe = parseInt(document.getElementById('fitness-rpe').value);
    const notes = document.getElementById('fitness-notes').value;
    const fh = parseInt(document.getElementById('fitness-duration-h').value) || 0;
    const fm = parseInt(document.getElementById('fitness-duration-m').value) || 0;
    const fs = parseInt(document.getElementById('fitness-duration-s').value) || 0;
    const fitnessDuration = (fh * 3600) + (fm * 60) + fs;

    const nameInputs = document.querySelectorAll('.exercise-name');
    const setInputs = document.querySelectorAll('.exercise-sets');
    const repInputs = document.querySelectorAll('.exercise-reps');
    const weightInputs = document.querySelectorAll('.exercise-weight');

    const exercises = [];
    for (let i = 0; i < nameInputs.length; i++) {
      exercises.push({
        name: nameInputs[i].value,
        sets: parseInt(setInputs[i].value),
        reps: parseInt(repInputs[i].value),
        weight: parseFloat(weightInputs[i].value)
      });
    }

    if (exercises.length === 0) {
      showToast("En az bir egzersiz ekleyin.", 'error');
      return;
    }

    const workout = {
      id: generateId('w_'),
      date: currentDateStr,
      sport: 'fitness',
      duration: fitnessDuration > 0 ? fitnessDuration : exercises.length * 5 * 60, // girilmezse tahmin
      exercises,
      rpe,
      notes: `${category.toUpperCase()} - ${notes}`
    };

    saveWorkoutAndRoute(workout);
  });
}

export function saveWorkoutAndRoute(workout) {
  // Düzenleme modu: mevcut kaydı güncelle (plan eşleştirmesi yapma)
  if (editingWorkoutId) {
    const idx = state.workouts.findIndex(w => w.id === editingWorkoutId);
    if (idx !== -1) {
      workout.id = editingWorkoutId;
      workout.date = state.workouts[idx].date; // orijinal tarihi koru
      if (state.workouts[idx].importKey) workout.importKey = state.workouts[idx].importKey;
      state.workouts[idx] = workout;
    }
    editingWorkoutId = null;
    saveState();
    resetWorkoutForms();
    showToast("Antrenman güncellendi!");
    document.querySelector('.bottom-nav [data-view="today"]').click();
    return;
  }

  state.workouts.push(workout);

  const matchingPlan = state.plans.find(p => p.date === currentDateStr && p.sport === workout.sport && !p.completed);
  if (matchingPlan) {
    matchingPlan.completed = true;
    matchingPlan.loggedWorkoutId = workout.id; // çift gösterimi önlemek için planı kayda bağla
    showToast(`"${matchingPlan.details}" planı tamamlandı!`);
  }

  saveState();
  resetWorkoutForms();
  showToast("Antrenman başarıyla kaydedildi!");
  document.querySelector('.bottom-nav [data-view="today"]').click();
}

export const WORKOUT_SUBMIT_LABELS = {
  run: 'Koşu Antrenmanını Kaydet',
  bike: 'Bisiklet Antrenmanını Kaydet',
  swim: 'Yüzme Antrenmanını Kaydet',
  fitness: 'Fitness Antrenmanını Kaydet'
};

export function workoutSubmitBtn(sport) {
  return document.querySelector(`#form-log-${sport} button[type="submit"]`);
}

export function resetWorkoutForms() {
  editingWorkoutId = null; // düzenleme modundan çık

  document.getElementById('form-log-run').reset();
  document.getElementById('form-log-bike').reset();
  document.getElementById('form-log-swim').reset();
  document.getElementById('form-log-fitness').reset();

  // RPE göstergelerini ve kaydet butonlarını varsayılana döndür
  Object.keys(WORKOUT_SUBMIT_LABELS).forEach(sport => {
    const btn = workoutSubmitBtn(sport);
    if (btn) btn.innerText = WORKOUT_SUBMIT_LABELS[sport];
  });

  const container = document.getElementById('fitness-exercises-container');
  container.innerHTML = `
    <div class="exercise-row card" style="padding:12px; margin-bottom:12px; background-color: var(--bg-secondary);">
      <div class="form-group">
        <label class="form-label">Hareket Adı</label>
        <input type="text" class="form-control exercise-name" placeholder="Squat" required>
      </div>
      <div class="grid-3">
        <div class="form-group">
          <label class="form-label">Set</label>
          <input type="number" class="form-control exercise-sets" min="1" value="3" required>
        </div>
        <div class="form-group">
          <label class="form-label">Tekrar</label>
          <input type="number" class="form-control exercise-reps" min="1" value="10" required>
        </div>
        <div class="form-group">
          <label class="form-label">Kilo (kg)</label>
          <input type="number" class="form-control exercise-weight" min="0" step="0.5" value="40" required>
        </div>
      </div>
    </div>
  `;
}

// Tek bir egzersiz satırı oluştur (düzenleme/ekleme için, mevcut değerlerle doldurulabilir)
export function buildExerciseRow(ex) {
  const e = ex || {};
  const safeName = (e.name || '').replace(/"/g, '&quot;');
  const row = document.createElement('div');
  row.className = 'exercise-row card';
  row.style.padding = '12px';
  row.style.marginBottom = '12px';
  row.style.backgroundColor = 'var(--bg-secondary)';
  row.innerHTML = `
    <div class="form-group">
      <label class="form-label">Hareket Adı</label>
      <input type="text" class="form-control exercise-name" placeholder="Egzersiz adı" value="${safeName}" required>
    </div>
    <div class="grid-3">
      <div class="form-group"><label class="form-label">Set</label><input type="number" class="form-control exercise-sets" min="1" value="${e.sets || 3}" required></div>
      <div class="form-group"><label class="form-label">Tekrar</label><input type="number" class="form-control exercise-reps" min="1" value="${e.reps || 10}" required></div>
      <div class="form-group"><label class="form-label">Kilo (kg)</label><input type="number" class="form-control exercise-weight" min="0" step="0.5" value="${e.weight != null ? e.weight : 20}" required></div>
    </div>
    <button type="button" class="btn btn-ghost btn-remove-ex-row btn-full mt-2" style="padding:6px; border-radius:6px; font-size:12px;">Satırı Sil</button>
  `;
  row.querySelector('.btn-remove-ex-row').addEventListener('click', () => row.remove());
  return row;
}

// Kaydet formunu mevcut bir antrenmanın değerleriyle doldur
export function prefillWorkoutForm(w) {
  const setDur = (prefix) => {
    document.getElementById(`${prefix}-duration-h`).value = Math.floor((w.duration || 0) / 3600);
    document.getElementById(`${prefix}-duration-m`).value = Math.floor(((w.duration || 0) % 3600) / 60);
    document.getElementById(`${prefix}-duration-s`).value = (w.duration || 0) % 60;
  };
  const setRpe = (prefix, def) => {
    const v = (w.rpe != null) ? w.rpe : def;
    document.getElementById(`${prefix}-rpe`).value = v;
    document.getElementById(`${prefix}-rpe-val`).innerText = v;
  };

  if (w.sport === 'run') {
    document.getElementById('run-distance').value = (w.distance != null) ? w.distance : '';
    setDur('run');
    document.getElementById('run-hr').value = (w.hr != null) ? w.hr : '';
    setRpe('run', 6);
    document.getElementById('run-notes').value = w.notes || '';
  } else if (w.sport === 'bike') {
    document.getElementById('bike-distance').value = (w.distance != null) ? w.distance : '';
    setDur('bike');
    document.getElementById('bike-power').value = (w.power != null) ? w.power : '';
    document.getElementById('bike-cadence').value = (w.cadence != null) ? w.cadence : '';
    setRpe('bike', 5);
    document.getElementById('bike-notes').value = w.notes || '';
  } else if (w.sport === 'swim') {
    document.getElementById('swim-distance').value = (w.distance != null) ? w.distance : '';
    if (w.poolLength) document.getElementById('swim-pool').value = w.poolLength;
    setDur('swim');
    setRpe('swim', 7);
    document.getElementById('swim-notes').value = w.notes || '';
  } else if (w.sport === 'fitness') {
    setDur('fitness');
    setRpe('fitness', 6);
    document.getElementById('fitness-notes').value = w.notes || '';
    const container = document.getElementById('fitness-exercises-container');
    if (w.exercises && w.exercises.length) {
      container.innerHTML = '';
      w.exercises.forEach(ex => container.appendChild(buildExerciseRow(ex)));
    }
  }
}

// Bir antrenmanı düzenlemeye başla: Kaydet sekmesine geçip formu doldur
export function startEditWorkout(w) {
  navigateToView('log'); // resetWorkoutForms çalışır (editingWorkoutId=null)
  const tab = document.querySelector(`.sport-tab-btn[data-sport="${w.sport}"]`);
  if (tab) tab.click();

  prefillWorkoutForm(w);
  editingWorkoutId = w.id; // reset'ten SONRA ayarla

  const btn = workoutSubmitBtn(w.sport);
  if (btn) btn.innerText = '✓ Antrenmanı Güncelle';

  showToast('Düzenleme modu — kaydedince güncellenecek.');
}

