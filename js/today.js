import { addDaysStr, fmtMinutes, mondayOf, openWorkoutDetail, workoutLoad } from './analysis.js';
import { MEAL_META, refreshDietUI } from './diet.js';
import { navigateToView } from './main.js';
import { openPlanModal } from './program.js';
import { currentDateStr, formatDate, parseLocalDate, saveState, setCurrentDateStr, state } from './state.js';
import { showConfirm, showToast } from './utils.js';
import { startEditWorkout } from './workout.js';

// ==========================================
// 4. BUGÜN (DASHBOARD) GÖRÜNÜMÜ YÖNETİMİ
// ==========================================

export function initTodayView() {
  document.getElementById('prev-day').addEventListener('click', () => changeCurrentDate(-1));
  document.getElementById('next-day').addEventListener('click', () => changeCurrentDate(1));

  document.getElementById('save-holistic-btn').addEventListener('click', () => {
    const sleep = parseFloat(document.getElementById('input-sleep').value);
    const sleepScore = parseInt(document.getElementById('input-sleep-score').value);
    const hrv = parseInt(document.getElementById('input-hrv').value);
    const weight = parseFloat(document.getElementById('input-weight').value);

    // En az bir alan dolu olmalı (boş kayıt yapma)
    if (isNaN(sleep) && isNaN(sleepScore) && isNaN(hrv) && isNaN(weight)) {
      showToast("En az bir değer gir (uyku, puan, HRV veya kilo).", "error");
      return;
    }

    if (!state.holisticLogs[currentDateStr]) {
      state.holisticLogs[currentDateStr] = {};
    }

    if (!isNaN(sleep)) state.holisticLogs[currentDateStr].sleep = sleep;
    if (!isNaN(sleepScore)) state.holisticLogs[currentDateStr].sleepScore = sleepScore;
    if (!isNaN(hrv)) state.holisticLogs[currentDateStr].hrv = hrv;
    if (!isNaN(weight)) {
      state.holisticLogs[currentDateStr].weight = weight;
      state.profile.weight = weight;
    }

    saveState();
    holisticEditMode = false; // kayıttan sonra özet görünümüne dön
    showToast("Vücut durumu başarıyla kaydedildi!");
    renderTodayView();
  });

  const editHolisticBtn = document.getElementById('edit-holistic-btn');
  if (editHolisticBtn) editHolisticBtn.addEventListener('click', () => {
    holisticEditMode = true;
    renderTodayView();
  });

  document.getElementById('quick-add-plan-btn').addEventListener('click', () => openPlanModal(currentDateStr));
  document.getElementById('go-to-log-btn').addEventListener('click', () => {
    navigateToView('log');
  });

  const waterAdd = document.getElementById('water-add-btn');
  if (waterAdd) waterAdd.addEventListener('click', () => changeWater(250));
  const waterReset = document.getElementById('water-reset-btn');
  if (waterReset) waterReset.addEventListener('click', () => changeWater(null));

  renderTodayView();
}

// Su miktarını güncelle (deltaMl=null → sıfırla)
export function changeWater(deltaMl) {
  if (!state.holisticLogs[currentDateStr]) state.holisticLogs[currentDateStr] = {};
  const cur = state.holisticLogs[currentDateStr].water || 0;
  state.holisticLogs[currentDateStr].water = (deltaMl == null) ? 0 : Math.max(0, cur + deltaMl);
  saveState();
  renderWaterCard();
}

// Bugünün su kartını çiz (bardak = 250 ml)
export function renderWaterCard() {
  const dots = document.getElementById('water-dots');
  const summary = document.getElementById('water-summary');
  if (!dots || !summary) return;
  const ml = (state.holisticLogs[currentDateStr] || {}).water || 0;
  const goal = state.profile.waterGoal || 2500;
  const glass = 250;
  const have = Math.round(ml / glass);
  const goalGlasses = Math.max(1, Math.round(goal / glass));
  summary.textContent = `${ml} / ${goal} ml`;
  let html = '';
  for (let i = 0; i < Math.max(goalGlasses, have); i++) {
    html += `<span style="font-size:20px; opacity:${i < have ? 1 : 0.3};">💧</span>`;
  }
  dots.innerHTML = html;
}

// Uzun seans (≥90 dk) varsa yakıtlama önerisi göster
export function renderFuelingTip() {
  const card = document.getElementById('fueling-card');
  const text = document.getElementById('fueling-text');
  if (!card || !text) return;
  const doneMax = state.workouts.filter(w => w.date === currentDateStr).reduce((m, w) => Math.max(m, (w.duration || 0) / 60), 0);
  const planMax = state.plans.filter(p => p.date === currentDateStr).reduce((m, p) => Math.max(m, p.targetDuration || 0), 0);
  const longest = Math.max(doneMax, planMax);
  if (longest < 90) { card.classList.add('hidden'); return; }
  const wkg = state.profile.weight || 70;
  text.innerHTML = `Bugün ~${Math.round(longest)} dk'lık uzun bir seans var.<br>` +
    `• <strong>Sırasında:</strong> saatte 60–90 g karbonhidrat (jel/içecek/muz) + düzenli su.<br>` +
    `• <strong>Sonrası (ilk 30–60 dk):</strong> ~${Math.round(wkg * 1.0)} g karbonhidrat + ~${Math.round(wkg * 0.3)} g protein ile toparlanmayı hızlandır.`;
  card.classList.remove('hidden');
}

// Hedef yarış geri sayımı + dönem (faz) önerisi
export function renderRaceCard() {
  const card = document.getElementById('race-card');
  if (!card) return;
  const date = state.profile.raceDate;
  if (!date) { card.classList.add('hidden'); return; }
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const race = parseLocalDate(date); race.setHours(0, 0, 0, 0);
  const days = Math.round((race - today) / 86400000);
  document.getElementById('race-name').textContent = state.profile.raceName || 'Hedef yarış';
  const daysEl = document.getElementById('race-days');
  const phaseEl = document.getElementById('race-phase');
  if (days < 0) {
    daysEl.textContent = '✓';
    phaseEl.textContent = `${Math.abs(days)} gün önce geçti — yeni hedef belirle`;
  } else {
    daysEl.textContent = days;
    const weeks = Math.max(1, Math.ceil(days / 7));
    let phase;
    if (weeks > 12) phase = 'Temel (Base) — hacim kur';
    else if (weeks > 4) phase = 'Geliştirme (Build) — yoğunluğu artır';
    else if (weeks > 1) phase = 'Zirve (Peak) — kaliteyi koru';
    else phase = 'Tapering — dinlen, tazelen';
    phaseEl.textContent = `~${weeks} hafta · ${phase}`;
  }
  card.classList.remove('hidden');
}

// Streak (ardışık antrenman günü) + bu haftanın özeti
export function renderStreakRecap() {
  const streakEl = document.getElementById('streak-text');
  const recap = document.getElementById('recap-stats');
  if (!streakEl || !recap) return;
  const has = (ds) => state.workouts.some(w => w.date === ds);
  let streak = 0;
  const offset = has(currentDateStr) ? 0 : (has(addDaysStr(currentDateStr, -1)) ? 1 : null);
  if (offset !== null) {
    for (let i = offset; i < 400; i++) { if (has(addDaysStr(currentDateStr, -i))) streak++; else break; }
  }
  streakEl.textContent = streak > 0 ? `${streak} gün seri` : 'Seri yok — bugün başla!';

  const weekStart = mondayOf(currentDateStr), weekEnd = addDaysStr(weekStart, 6);
  const wk = state.workouts.filter(w => w.date >= weekStart && w.date <= weekEnd);
  let sec = 0, km = 0, tss = 0;
  wk.forEach(w => { sec += w.duration || 0; if (w.sport === 'run' || w.sport === 'bike') km += (w.distance || 0); tss += workoutLoad(w); });
  const cards = [
    { value: wk.length, label: 'Antrenman' },
    { value: fmtMinutes(sec / 60), label: 'Süre' },
    { value: `${Math.round(km * 10) / 10} km`, label: 'Mesafe' },
    { value: Math.round(tss), label: 'TSS' }
  ];
  recap.innerHTML = cards.map(c => `<div class="analysis-stat-card"><div class="stat-value">${c.value}</div><div class="stat-label">${c.label}</div></div>`).join('');
}

export function changeCurrentDate(daysOffset) {
  const d = parseLocalDate(currentDateStr);
  d.setDate(d.getDate() + daysOffset);
  setCurrentDateStr(formatDate(d));
  holisticEditMode = false; // tarih değişince özet görünümüne dön
  renderTodayView();
}

// Vücut Durumu kartı: veri girilmişse kompakt özet, yoksa/düzenlemede form göster.
export let holisticEditMode = false;
export function renderHolisticCard(bodyLog) {
  const summary = document.getElementById('holistic-summary');
  const form = document.getElementById('holistic-form');
  const title = document.getElementById('holistic-title');
  if (!summary || !form) return;

  const hasData = bodyLog && (bodyLog.sleep != null || bodyLog.sleepScore != null ||
    bodyLog.hrv != null || bodyLog.weight != null);

  if (hasData && !holisticEditMode) {
    const parts = [];
    if (bodyLog.sleep != null) parts.push(`Uyku: <b>${bodyLog.sleep} sa</b>`);
    if (bodyLog.sleepScore != null) parts.push(`Puan: <b>${bodyLog.sleepScore}</b>`);
    if (bodyLog.hrv != null) parts.push(`HRV: <b>${bodyLog.hrv} ms</b>`);
    if (bodyLog.weight != null) parts.push(`Kilo: <b>${bodyLog.weight} kg</b>`);
    document.getElementById('holistic-summary-values').innerHTML = parts.join(' · ');
    summary.style.display = '';
    form.style.display = 'none';
    if (title) title.innerHTML = '🩺 Günlük Vücut Durumu ✅';
  } else {
    summary.style.display = 'none';
    form.style.display = '';
    if (title) title.innerHTML = '🩺 Günlük Vücut Durumu';
  }
}

export function renderTodayView() {
  const dateObj = parseLocalDate(currentDateStr);
  const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
  document.getElementById('current-date-title').innerText = dateObj.toLocaleDateString('tr-TR', options);
  renderWaterCard();
  renderFuelingTip();
  renderRaceCard();
  renderStreakRecap();

  const bodyLog = state.holisticLogs[currentDateStr] || {};
  document.getElementById('input-sleep').value = bodyLog.sleep || '';
  document.getElementById('input-sleep-score').value = bodyLog.sleepScore || '';
  document.getElementById('input-hrv').value = bodyLog.hrv || '';
  document.getElementById('input-weight').value = bodyLog.weight || state.profile.weight || '';
  renderHolisticCard(bodyLog);

  // 1. Bugünün Antrenman Plan Listesi — yalnızca YAPILACAKLAR (tamamlananlar "Yapılan"a akar)
  const todayPlansList = document.getElementById('today-plans-list');
  const todayPlans = state.plans.filter(p => p.date === currentDateStr);
  const pendingPlans = todayPlans.filter(p => !p.completed);

  if (todayPlans.length === 0) {
    todayPlansList.innerHTML = '<p class="empty-state-text">Bugün için planlanmış bir antrenman yok.</p>';
  } else if (pendingPlans.length === 0) {
    todayPlansList.innerHTML = '<p class="empty-state-text">🎉 Bugünün tüm planlarını tamamladın!</p>';
  } else {
    todayPlansList.innerHTML = '';
    pendingPlans.forEach(plan => {
      const sportIcons = { run: '🏃', bike: '🚴', swim: '🏊', fitness: '🏋️' };

      const planItem = document.createElement('div');
      planItem.className = `checklist-item border-highlight-${plan.sport}`;
      planItem.innerHTML = `
        <label class="checkbox-container">
          <input type="checkbox" data-plan-id="${plan.id}">
          <span class="checkmark"></span>
          <div class="checklist-details">
            <span class="checklist-title">${sportIcons[plan.sport]} ${plan.details || 'Detay girilmedi'}</span>
            ${plan.targetDistance ? `<span class="checklist-meta">Hedef: ${plan.targetDistance} km / ${plan.targetDuration || 0} dk</span>` : plan.targetDuration ? `<span class="checklist-meta">Hedef: ${plan.targetDuration} dk</span>` : ''}
          </div>
        </label>
        <button class="btn btn-secondary quick-log-plan-btn" style="padding: 4px 8px; border-radius:6px; font-size:11px; height:auto;">Kaydet</button>
      `;

      planItem.querySelector('input[type="checkbox"]').addEventListener('change', () => {
        plan.completed = true; // tik → tamamlandı, "Yapılan"a akar
        saveState();
        renderTodayView();
      });

      planItem.querySelector('.quick-log-plan-btn').addEventListener('click', () => triggerQuickLog(plan));

      todayPlansList.appendChild(planItem);
    });
  }

  // 2. Bugünün Diyet Plan Listesi (YENİ EKLEME)
  const todayDietPlansList = document.getElementById('today-diet-plans-list');
  const todayDietPlans = state.dietPlans.filter(p => p.date === currentDateStr);

  if (todayDietPlans.length === 0) {
    todayDietPlansList.innerHTML = '<p class="empty-state-text">Bugün için planlanmış bir diyet bulunmuyor.</p>';
  } else {
    todayDietPlansList.innerHTML = '';
    todayDietPlans.forEach(plan => {
      const isCompleted = plan.completed;
      const meta = MEAL_META[plan.meal] || { icon: '🍽', name: plan.meal };

      const planItem = document.createElement('div');
      planItem.className = `checklist-item ${isCompleted ? 'completed' : ''} border-meal-${plan.meal}`;
      planItem.innerHTML = `
        <label class="checkbox-container">
          <input type="checkbox" ${isCompleted ? 'checked' : ''} data-diet-plan-id="${plan.id}">
          <span class="checkmark" style="background-color: var(--bg-tertiary);"></span>
          <div class="checklist-details">
            <span class="checklist-title">${meta.icon} ${plan.name}</span>
            <span class="checklist-meta">${meta.name} | ${plan.calories} kcal (P: ${plan.protein}g C: ${plan.carbs}g F: ${plan.fat}g)</span>
          </div>
        </label>
      `;

      planItem.querySelector('input[type="checkbox"]').addEventListener('change', (e) => {
        toggleDietPlanCompleted(plan, e.target.checked);
      });

      todayDietPlansList.appendChild(planItem);
    });
  }

  // 3. Bugün Yapılan Antrenmanlar = kaydedilen antrenmanlar + sadece tiklenen (kaydı olmayan) tamamlanmış planlar
  const todayWorkoutsList = document.getElementById('today-workouts-list');
  const todayWorkouts = state.workouts.filter(w => w.date === currentDateStr);

  // Bir plan kayda bağlıysa (Kaydet ile) burada ayrıca gösterme — çift olmasın.
  // loggedWorkoutId yoksa (eski veri) aynı branştan bir kayıt varsa "kaydedilmiş" say.
  const isPlanLogged = (plan) => plan.loggedWorkoutId
    ? todayWorkouts.some(w => w.id === plan.loggedWorkoutId)
    : todayWorkouts.some(w => w.sport === plan.sport);
  const doneOnlyPlans = todayPlans.filter(p => p.completed && !isPlanLogged(p));

  if (todayWorkouts.length === 0 && doneOnlyPlans.length === 0) {
    todayWorkoutsList.innerHTML = '<p class="empty-state-text">Henüz yapılan antrenman kaydedilmedi.</p>';
  } else {
    todayWorkoutsList.innerHTML = '';
    todayWorkouts.forEach(workout => {
      const sportIcons = { run: '🏃', bike: '🚴', swim: '🏊', fitness: '🏋️' };
      const sportNames = { run: 'Koşu', bike: 'Bisiklet', swim: 'Yüzme', fitness: 'Fitness' };
      const hours = Math.floor(workout.duration / 3600);
      const minutes = Math.floor((workout.duration % 3600) / 60);
      const seconds = workout.duration % 60;
      const durationStr = `${hours > 0 ? hours + 'sa ' : ''}${minutes}dk${seconds > 0 ? ' ' + seconds + 'sn' : ''}`;

      const card = document.createElement('div');
      card.className = `card workout-completed-card highlight-${workout.sport} no-press`;
      card.style.padding = '14px';
      card.style.marginBottom = '12px';

      let detailsHTML = '';
      if (workout.sport === 'run') {
        detailsHTML = `Mesafe: <strong>${workout.distance} km</strong> | Tempo: <strong>${workout.pace}</strong>`;
      } else if (workout.sport === 'bike') {
        detailsHTML = `Mesafe: <strong>${workout.distance} km</strong> | Güç: <strong>${workout.power || '-'} W</strong>`;
      } else if (workout.sport === 'swim') {
        detailsHTML = `Mesafe: <strong>${workout.distance} m</strong> | Tempo: <strong>${workout.pace}</strong>`;
      } else if (workout.sport === 'fitness') {
        detailsHTML = `Egzersiz Sayısı: <strong>${workout.exercises ? workout.exercises.length : 0}</strong>`;
      }

      card.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
          <div class="flex-align">
            <span class="badge badge-${workout.sport}">${sportIcons[workout.sport]} ${sportNames[workout.sport]}</span>
            <span class="text-xs text-muted">${durationStr} | RPE: ${workout.rpe}/10</span>
          </div>
          <div style="display:flex; align-items:center; gap:2px;">
            <button class="edit-workout-btn icon-tap-btn" style="font-size:16px;" title="Düzenle" data-id="${workout.id}">✏️</button>
            <button class="delete-workout-btn icon-tap-btn" style="font-size:20px;" title="Sil" data-id="${workout.id}">&times;</button>
          </div>
        </div>
        <div>
          <p class="text-sm text-secondary">${detailsHTML}</p>
          ${workout.notes ? `<p class="text-xs text-muted mt-2" style="font-style:italic;">"${workout.notes}"</p>` : ''}
        </div>
      `;

      card.querySelector('.edit-workout-btn').addEventListener('click', () => startEditWorkout(workout));

      card.querySelector('.delete-workout-btn').addEventListener('click', async () => {
        if (await showConfirm("Bu antrenman kaydını silmek istediğinize emin misiniz?", { title: 'Antrenmanı sil', okText: 'Sil', danger: true })) {
          state.workouts = state.workouts.filter(w => w.id !== workout.id);
          saveState();
          renderTodayView();
          showToast("Antrenman kaydı silindi.");
        }
      });

      // Karta dokununca detay ekranı (✏️/× butonları hariç)
      card.style.cursor = 'pointer';
      card.addEventListener('click', (e) => {
        if (e.target.closest('.edit-workout-btn') || e.target.closest('.delete-workout-btn')) return;
        openWorkoutDetail(workout);
      });

      todayWorkoutsList.appendChild(card);
    });

    // Sadece tiklenmiş (detay kaydı olmayan) tamamlanmış planlar — kompakt "tamamlandı" satırı
    doneOnlyPlans.forEach(plan => {
      const sportIcons = { run: '🏃', bike: '🚴', swim: '🏊', fitness: '🏋️' };
      const row = document.createElement('div');
      row.className = `card workout-done-row highlight-${plan.sport} no-press`;
      row.innerHTML = `
        <div class="flex-align" style="gap:8px;">
          <span style="font-size:18px;">✅</span>
          <div>
            <span class="checklist-title">${sportIcons[plan.sport] || ''} ${plan.details || 'Antrenman'}</span>
            <span class="text-xs text-muted" style="display:block;">Plan tamamlandı (detay girilmedi)</span>
          </div>
        </div>
        <button class="btn btn-ghost undo-plan-btn" style="padding:4px 8px; border-radius:6px; font-size:11px; height:auto;" data-id="${plan.id}">Geri al</button>
      `;
      row.querySelector('.undo-plan-btn').addEventListener('click', () => {
        plan.completed = false;
        delete plan.loggedWorkoutId;
        saveState();
        renderTodayView();
        showToast("Plan yapılacaklara geri alındı.");
      });
      todayWorkoutsList.appendChild(row);
    });
  }

  updateDietSummaryDOM();
}

// Diyet planını tamamlandı/tamamlanmadı yapma lojiği
export function toggleDietPlanCompleted(plan, isChecked) {
  plan.completed = isChecked;

  if (isChecked) {
    // Tüketilen diyet listesine otomatik ekle
    const consumedFood = {
      id: 'fd_sync_' + plan.id, // plan id'sine bağımlı benzersiz id
      date: plan.date,
      meal: plan.meal,
      name: plan.name,
      calories: plan.calories,
      protein: plan.protein,
      carbs: plan.carbs,
      fat: plan.fat,
      quantity: plan.quantity,
      unit: plan.unit
    };
    state.diet.push(consumedFood);
    showToast(`"${plan.name}" tüketilenlere eklendi!`);
  } else {
    // Tüketilenlerden kaldır
    state.diet = state.diet.filter(f => f.id !== 'fd_sync_' + plan.id);
    showToast(`"${plan.name}" tüketilenlerden kaldırıldı.`);
  }

  saveState();
  refreshDietUI();
}

export function triggerQuickLog(plan) {
  navigateToView('log');
  const tabBtn = document.querySelector(`.sport-tab-btn[data-sport="${plan.sport}"]`);
  if (tabBtn) tabBtn.click();

  if (plan.sport === 'run') {
    if (plan.targetDistance) document.getElementById('run-distance').value = plan.targetDistance;
    if (plan.targetDuration) {
      document.getElementById('run-duration-h').value = Math.floor(plan.targetDuration / 60);
      document.getElementById('run-duration-m').value = plan.targetDuration % 60;
      document.getElementById('run-duration-s').value = 0;
    }
    document.getElementById('run-notes').value = `Planlanan: ${plan.details}`;
  } else if (plan.sport === 'bike') {
    if (plan.targetDistance) document.getElementById('bike-distance').value = plan.targetDistance;
    if (plan.targetDuration) {
      document.getElementById('bike-duration-h').value = Math.floor(plan.targetDuration / 60);
      document.getElementById('bike-duration-m').value = plan.targetDuration % 60;
      document.getElementById('bike-duration-s').value = 0;
    }
    document.getElementById('bike-notes').value = `Planlanan: ${plan.details}`;
  } else if (plan.sport === 'swim') {
    if (plan.targetDistance) document.getElementById('swim-distance').value = plan.targetDistance;
    if (plan.targetDuration) {
      document.getElementById('swim-duration-h').value = Math.floor(plan.targetDuration / 60);
      document.getElementById('swim-duration-m').value = plan.targetDuration % 60;
      document.getElementById('swim-duration-s').value = 0;
    }
    document.getElementById('swim-notes').value = `Planlanan: ${plan.details}`;
  } else if (plan.sport === 'fitness') {
    document.getElementById('fitness-notes').value = `Planlanan: ${plan.details}`;
  }
}

export function updateDietSummaryDOM() {
  const todayFoods = state.diet.filter(f => f.date === currentDateStr);

  let totalCalories = 0;
  let totalP = 0;
  let totalC = 0;
  let totalF = 0;

  todayFoods.forEach(food => {
    totalCalories += food.calories;
    totalP += food.protein;
    totalC += food.carbs;
    totalF += food.fat;
  });

  totalCalories = Math.round(totalCalories);
  totalP = Math.round(totalP * 10) / 10;
  totalC = Math.round(totalC * 10) / 10;
  totalF = Math.round(totalF * 10) / 10;

  const macros = state.profile.targetMacros || {};
  const targetCal = state.profile.targetDailyCalories || 2500;
  const targetP = macros.protein || 150;
  const targetC = macros.carbs || 300;
  const targetF = macros.fat || 70;

  if (document.getElementById('diet-calories-consumed')) {
    document.getElementById('diet-calories-consumed').innerText = totalCalories;
    document.getElementById('diet-calories-target').innerText = targetCal;
    document.getElementById('diet-p-consumed').innerText = totalP;
    document.getElementById('diet-p-target').innerText = targetP;
    document.getElementById('diet-c-consumed').innerText = totalC;
    document.getElementById('diet-c-target').innerText = targetC;
    document.getElementById('diet-f-consumed').innerText = totalF;
    document.getElementById('diet-f-target').innerText = targetF;

    const circle = document.getElementById('diet-calories-ring');
    const radius = circle.r.baseVal.value;
    const circumference = 2 * Math.PI * radius;
    circle.style.strokeDasharray = `${circumference} ${circumference}`;

    const percentage = Math.min(totalCalories / targetCal, 1);
    const offset = circumference - (percentage * circumference);
    circle.style.strokeDashoffset = offset;

    document.getElementById('diet-p-bar').style.width = `${Math.min((totalP / targetP) * 100, 100)}%`;
    document.getElementById('diet-c-bar').style.width = `${Math.min((totalC / targetC) * 100, 100)}%`;
    document.getElementById('diet-f-bar').style.width = `${Math.min((totalF / targetF) * 100, 100)}%`;
  }

  if (document.getElementById('diet-pg-consumed')) {
    document.getElementById('diet-pg-consumed').innerText = `${totalCalories} kcal`;
    document.getElementById('diet-pg-target').innerText = `${targetCal} kcal`;

    const remaining = targetCal - totalCalories;
    const remainingElement = document.getElementById('diet-pg-remaining');
    if (remaining < 0) {
      remainingElement.innerText = `+${Math.abs(remaining)} kcal`;
      remainingElement.style.color = '#ef4444';
    } else {
      remainingElement.innerText = `${remaining} kcal`;
      remainingElement.style.color = '';
    }
  }
}

