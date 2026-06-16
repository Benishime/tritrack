// TriTrack - Triatlon ve Koşu Takip Uygulaması
// Ana Uygulama Mantığı (JavaScript)

// ==========================================
// 1. STATE YÖNETİMİ & BAŞLANGIÇ VERİLERİ
// ==========================================

let state = {
  profile: {
    name: "Triatlet Sporcu",
    weight: 75.0,
    targetDailyCalories: 2600,
    targetMacros: { protein: 160, carbs: 320, fat: 75 },
    geminiApiKey: ""
  },
  holisticLogs: {}, // 'YYYY-MM-DD': { sleep: 8, hrv: 70, weight: 75 }
  plans: [],        // { id, date, sport, targetDistance, targetDuration, details, completed }
  dietPlans: [],    // { id, date, meal, name, calories, protein, carbs, fat, quantity, unit, completed }
  workouts: [],     // { id, date, sport, duration, distance, pace, hr, rpe, power, cadence, poolLength, exercises, notes }
  diet: []          // { id, date, meal, name, calories, protein, carbs, fat, quantity, unit }
};

// Tarih Formatlayıcı Yardımcı Fonksiyon
function formatDate(dateObj) {
  const year = dateObj.getFullYear();
  const month = String(dateObj.getMonth() + 1).padStart(2, '0');
  const day = String(dateObj.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// Bugünün Tarih Değişkeni (State'deki geçerli gün)
let currentDateStr = formatDate(new Date());

// Düzenlenmekte olan antrenmanın id'si (null = yeni kayıt modu)
let editingWorkoutId = null;

// İlk açılış mı? (true ise onboarding sihirbazı gösterilir)
let needsOnboarding = false;

// Verileri LocalStorage'dan Çek
function loadState() {
  const savedState = localStorage.getItem('tritrack_state');
  if (savedState) {
    try {
      state = JSON.parse(savedState);
      // Geriye dönük uyumluluk veya boş alan kontrolleri
      if (!state.profile) state.profile = {};
      if (!state.holisticLogs) state.holisticLogs = {};
      if (!state.plans) state.plans = [];
      if (!state.dietPlans) state.dietPlans = [];
      if (!state.workouts) state.workouts = [];
      if (!state.diet) state.diet = [];
    } catch (e) {
      console.error("Kayıtlı veri yüklenirken hata oluştu, boş başlatılıyor.", e);
      initEmptyState();
    }
  } else {
    // İlk açılış: boş state + onboarding sihirbazı
    initEmptyState();
  }
}

// Boş bir başlangıç state'i kur ve onboarding'i işaretle
function initEmptyState() {
  state = {
    profile: {
      name: "",
      weight: null,
      targetDailyCalories: 2500,
      targetMacros: { protein: 150, carbs: 300, fat: 70 },
      geminiApiKey: ""
    },
    holisticLogs: {},
    plans: [],
    dietPlans: [],
    workouts: [],
    diet: []
  };
  needsOnboarding = true;
}

// Verileri LocalStorage'a Kaydet
function saveState() {
  localStorage.setItem('tritrack_state', JSON.stringify(state));
}

// ==========================================
// 2. SPA GÖRÜNÜM NAVİGASYONU & BAŞLANGIÇ TETİKLEYİCİLERİ
// ==========================================

document.addEventListener('DOMContentLoaded', () => {
  loadState();
  initNavigation();
  initTheme();
  initTodayView();
  initProgramView();
  initDietView();
  initWorkoutLogView();
  initProfileView();
  initDataManagement();
  initOnboarding();
  registerServiceWorker();

  if (needsOnboarding) showOnboarding();
});

function initNavigation() {
  const navItems = document.querySelectorAll('.bottom-nav .bottom-nav-item');
  const views = document.querySelectorAll('.app-content .view-section');

  // Header'daki profil ikonu → Profil ve Ayarlar görünümü (alt menüde değil)
  const profileBtn = document.getElementById('profile-open-btn');
  if (profileBtn) {
    profileBtn.addEventListener('click', () => {
      navItems.forEach(nav => nav.classList.remove('active'));
      profileBtn.classList.add('active');
      views.forEach(view => {
        view.classList.remove('active');
        if (view.id === 'view-profile') view.classList.add('active');
      });
      refreshActiveView('profile');
    });
  }

  // Alt menüye basıldığında profil ikonunun aktifliğini kaldır
  navItems.forEach(item => item.addEventListener('click', () => {
    if (profileBtn) profileBtn.classList.remove('active');
  }));

  navItems.forEach(item => {
    item.addEventListener('click', () => {
      const targetViewId = `view-${item.getAttribute('data-view')}`;
      
      navItems.forEach(nav => nav.classList.remove('active'));
      item.classList.add('active');

      views.forEach(view => {
        view.classList.remove('active');
        if (view.id === targetViewId) {
          view.classList.add('active');
          refreshActiveView(item.getAttribute('data-view'));
        }
      });
    });
  });
}

function refreshActiveView(viewName) {
  switch (viewName) {
    case 'today':
      renderTodayView();
      break;
    case 'program':
      renderProgramView();
      break;
    case 'diet':
      // Aktif panele göre render et (günlük takip / haftalık plan)
      if (document.getElementById('diet-weekly')?.classList.contains('active')) {
        renderWeeklyDietView();
      } else {
        renderDietView();
      }
      break;
    case 'log':
      resetWorkoutForms();
      break;
    case 'profile':
      renderProfileView();
      break;
    case 'assistant':
      renderProfileView(); // AI durum rozetini güncelle
      break;
    case 'analysis':
      renderAnalysisView();
      break;
  }
}

// ==========================================
// 3. TEMA YÖNETİMİ (LIGHT / DARK TEMA)
// ==========================================

function initTheme() {
  const themeToggleBtn = document.getElementById('theme-toggle');
  const savedTheme = localStorage.getItem('tritrack_theme') || 'auto';
  
  applyTheme(savedTheme);

  themeToggleBtn.addEventListener('click', () => {
    const currentTheme = document.body.className;
    let nextTheme = 'theme-dark';
    
    if (currentTheme.includes('theme-dark')) {
      nextTheme = 'theme-light';
    } else {
      nextTheme = 'theme-dark';
    }
    
    applyTheme(nextTheme);
  });
}

function applyTheme(theme) {
  document.body.className = '';
  
  if (theme === 'auto') {
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    document.body.classList.add(prefersDark ? 'theme-dark' : 'theme-light');
    localStorage.setItem('tritrack_theme', 'auto');
  } else {
    document.body.classList.add(theme);
    localStorage.setItem('tritrack_theme', theme);
  }
}

// ==========================================
// 4. BUGÜN (DASHBOARD) GÖRÜNÜMÜ YÖNETİMİ
// ==========================================

function initTodayView() {
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
    showToast("Vücut durumu başarıyla kaydedildi!");
    renderTodayView();
  });

  document.getElementById('quick-add-plan-btn').addEventListener('click', () => openPlanModal(currentDateStr));
  document.getElementById('go-to-log-btn').addEventListener('click', () => {
    document.querySelector('.bottom-nav [data-view="log"]').click();
  });

  renderTodayView();
}

function changeCurrentDate(daysOffset) {
  const d = new Date(currentDateStr);
  d.setDate(d.getDate() + daysOffset);
  currentDateStr = formatDate(d);
  renderTodayView();
}

function renderTodayView() {
  const dateObj = new Date(currentDateStr);
  const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
  document.getElementById('current-date-title').innerText = dateObj.toLocaleDateString('tr-TR', options);

  const bodyLog = state.holisticLogs[currentDateStr] || {};
  document.getElementById('input-sleep').value = bodyLog.sleep || '';
  document.getElementById('input-sleep-score').value = bodyLog.sleepScore || '';
  document.getElementById('input-hrv').value = bodyLog.hrv || '';
  document.getElementById('input-weight').value = bodyLog.weight || state.profile.weight || '';

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
      planItem.className = `checklist-item ${isCompleted ? 'completed' : ''} border-highlight-diet`;
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

      card.querySelector('.delete-workout-btn').addEventListener('click', () => {
        if(confirm("Bu antrenman kaydını silmek istediğinize emin misiniz?")) {
          state.workouts = state.workouts.filter(w => w.id !== workout.id);
          saveState();
          renderTodayView();
          showToast("Antrenman kaydı silindi.");
        }
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
function toggleDietPlanCompleted(plan, isChecked) {
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
  renderTodayView();
}

function triggerQuickLog(plan) {
  document.querySelector('.bottom-nav [data-view="log"]').click();
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

function updateDietSummaryDOM() {
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

  const targetCal = state.profile.targetDailyCalories || 2500;
  const targetP = state.profile.targetMacros.protein || 150;
  const targetC = state.profile.targetMacros.carbs || 300;
  const targetF = state.profile.targetMacros.fat || 70;

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

// ==========================================
// 5. PROGRAM PLANLAMA (WEEKLY SCHEDULER) GÖRÜNÜMÜ
// ==========================================

function initProgramView() {
  const addBtn = document.getElementById('add-planned-workout-btn');
  const modal = document.getElementById('modal-plan');
  const closeBtn = document.getElementById('close-modal-plan');
  const form = document.getElementById('form-plan-workout');

  addBtn.addEventListener('click', () => openPlanModal(currentDateStr));
  closeBtn.addEventListener('click', () => modal.classList.remove('open'));

  // Branşa göre mesafe birimi etiketi (yüzme → metre)
  document.getElementById('plan-sport').addEventListener('change', updatePlanDistanceLabel);

  modal.addEventListener('click', (e) => {
    if (e.target === modal) modal.classList.remove('open');
  });

  form.addEventListener('submit', (e) => {
    e.preventDefault();

    const date = document.getElementById('plan-date').value;
    const sport = document.getElementById('plan-sport').value;
    const targetDistance = parseFloat(document.getElementById('plan-target-distance').value) || null;
    const targetDuration = parseInt(document.getElementById('plan-target-duration').value) || null;
    const details = document.getElementById('plan-details').value;

    const newPlan = {
      id: 'p_' + Date.now(),
      date,
      sport,
      targetDistance,
      targetDuration,
      details,
      completed: false
    };

    state.plans.push(newPlan);
    saveState();
    
    modal.classList.remove('open');
    form.reset();
    showToast("Antrenman plana başarıyla eklendi!");
    
    renderProgramView();
    renderTodayView();
  });

  initBulkPlanModal();
  renderProgramView();
}

function openPlanModal(defaultDate) {
  const modal = document.getElementById('modal-plan');
  document.getElementById('plan-date').value = defaultDate;
  updatePlanDistanceLabel();
  modal.classList.add('open');
}

function updatePlanDistanceLabel() {
  const sport = document.getElementById('plan-sport').value;
  const label = document.getElementById('plan-distance-label');
  if (label) label.innerText = (sport === 'swim') ? 'Mesafe Hedefi (m)' : 'Mesafe Hedefi (km)';
}

// ---- TOPLU HAFTALIK PLAN İÇE AKTARMA ----

// Gün adı → hafta içi index (0=Pazartesi). Uzun anahtarlar önce eşleşir.
const BULK_DAY_MAP = {
  pazartesi: 0, pzt: 0, pt: 0, monday: 0, mon: 0,
  salı: 1, sali: 1, sal: 1, tuesday: 1, tue: 1,
  çarşamba: 2, carsamba: 2, çar: 2, car: 2, wednesday: 2, wed: 2,
  perşembe: 3, persembe: 3, perş: 3, pers: 3, per: 3, thursday: 3, thu: 3,
  cumartesi: 5, cmt: 5, cts: 5, saturday: 5, sat: 5,
  cuma: 4, cum: 4, friday: 4, fri: 4,
  pazar: 6, paz: 6, pz: 6, sunday: 6, sun: 6
};
const BULK_DAY_KEYS = Object.keys(BULK_DAY_MAP).sort((a, b) => b.length - a.length);
const BULK_DAY_NAMES = ['Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi', 'Pazar'];

const BULK_EXAMPLE = `Pazartesi: Koşu 10km tempo
Salı: Yüzme 1500m teknik
Çarşamba: Dinlenme
Perşembe: Bisiklet 40km Z2
Cuma: Güç 45dk core
Cumartesi: Uzun koşu 18km
Pazar: Dinlenme`;

let bulkWeekMonday = mondayOf(currentDateStr);

function initBulkPlanModal() {
  const openBtn = document.getElementById('bulk-plan-open-btn');
  const modal = document.getElementById('modal-bulk-plan');
  if (!openBtn || !modal) return;

  openBtn.addEventListener('click', () => {
    bulkWeekMonday = mondayOf(currentDateStr);
    document.getElementById('bulk-plan-input').value = '';
    document.getElementById('bulk-plan-replace').checked = false;
    updateBulkWeekLabel();
    renderBulkPreview();
    modal.classList.add('open');
  });

  document.getElementById('close-modal-bulk').addEventListener('click', () => modal.classList.remove('open'));
  modal.addEventListener('click', (e) => { if (e.target === modal) modal.classList.remove('open'); });

  document.getElementById('bulk-week-prev').addEventListener('click', () => { bulkWeekMonday = addDaysStr(bulkWeekMonday, -7); updateBulkWeekLabel(); renderBulkPreview(); });
  document.getElementById('bulk-week-next').addEventListener('click', () => { bulkWeekMonday = addDaysStr(bulkWeekMonday, 7); updateBulkWeekLabel(); renderBulkPreview(); });

  document.getElementById('bulk-plan-input').addEventListener('input', renderBulkPreview);
  document.getElementById('bulk-plan-example').addEventListener('click', () => {
    document.getElementById('bulk-plan-input').value = BULK_EXAMPLE;
    renderBulkPreview();
  });

  document.getElementById('bulk-plan-submit').addEventListener('click', submitBulkPlan);
}

function updateBulkWeekLabel() {
  const start = new Date(bulkWeekMonday);
  const end = new Date(addDaysStr(bulkWeekMonday, 6));
  const opt = { day: 'numeric', month: 'short' };
  document.getElementById('bulk-week-label').innerText =
    `${start.toLocaleDateString('tr-TR', opt)} – ${end.toLocaleDateString('tr-TR', opt)}`;
}

// Tek satırı çöz: gün + branş + mesafe/süre/not
function parseBulkLine(rawLine) {
  const line = rawLine.trim();
  if (!line) return null; // boş satır atla

  const lower = line.toLocaleLowerCase('tr');
  // Gün adı tam kelime olmalı: sonrasındaki karakter harf OLMAMALI ("Salata" → "Salı" sanılmasın)
  const dayKey = BULK_DAY_KEYS.find(k => {
    if (!lower.startsWith(k)) return false;
    const next = lower.charAt(k.length);
    return next === '' || /[^a-zçğıiöşü]/i.test(next);
  });
  if (dayKey === undefined) {
    return { error: true, raw: line };
  }

  let content = line.slice(dayKey.length).replace(/^[\s:.\-–—)]+/, '').trim();
  const dayIndex = BULK_DAY_MAP[dayKey];
  const date = addDaysStr(bulkWeekMonday, dayIndex);

  // Dinlenme günü
  if (/dinlen|rest|off\b|izin|tatil|yok/i.test(content) || content === '') {
    return { rest: true, dayIndex, date, raw: line };
  }

  const sport = detectBulkSport(content);

  // Mesafe (km veya m)
  let targetDistance = null;
  const dm = content.match(/(\d+(?:[.,]\d+)?)\s*(km|m)\b/i);
  if (dm) {
    const val = parseFloat(dm[1].replace(',', '.'));
    const unit = dm[2].toLowerCase();
    if (unit === 'km') targetDistance = val;
    else targetDistance = (sport === 'swim') ? val : Math.round((val / 1000) * 100) / 100; // m→km (yüzme hariç)
  }

  // Süre (sa + dk)
  let targetDuration = null;
  const hMatch = content.match(/(\d+)\s*(?:saat|sa|hour|hr|h)/i);
  const mMatch = content.match(/(\d+)\s*(?:dk|dak|dakika|min|mins|minute)\b/i);
  if (hMatch || mMatch) {
    targetDuration = (hMatch ? parseInt(hMatch[1]) * 60 : 0) + (mMatch ? parseInt(mMatch[1]) : 0);
  }

  return { dayIndex, date, sport, targetDistance, targetDuration, details: content, raw: line };
}

// Metinden branş tahmini (bulunamazsa 'run' varsayar, ama eşleşmeyi de bildirir)
function detectBulkSport(text) {
  const t = (text || '').toLocaleLowerCase('tr');
  if (/(yüz|yuz|swim|havuz|kulaç|kulac)/.test(t)) return 'swim';
  if (/(bisiklet|bike|cycl|ride|pedal|watt|spin)/.test(t)) return 'bike';
  if (/(güç|guc|fitness|gym|core|kuvvet|ağırlık|agirlik|strength)/.test(t)) return 'fitness';
  if (/(koş|kos|run|jog|tempo|interval|fartlek|trail|yürü|yuru|walk)/.test(t)) return 'run';
  return 'run'; // varsayılan
}

function parseBulkText(text) {
  return text.split('\n').map(parseBulkLine).filter(Boolean);
}

function renderBulkPreview() {
  const container = document.getElementById('bulk-plan-preview');
  const text = document.getElementById('bulk-plan-input').value;
  const parsed = parseBulkText(text);

  if (parsed.length === 0) {
    container.innerHTML = '<p class="text-xs text-muted" style="text-align:center; padding:8px;">Yukarıya planını yapıştır; burada önizleme çıkacak.</p>';
    return;
  }

  const workouts = parsed.filter(p => p.sport);
  const rests = parsed.filter(p => p.rest);
  const errors = parsed.filter(p => p.error);

  let html = `<div class="bulk-preview-summary">✓ ${workouts.length} antrenman · 😴 ${rests.length} dinlenme${errors.length ? ` · ⚠️ ${errors.length} anlaşılamadı` : ''}</div>`;

  parsed.forEach(p => {
    if (p.error) {
      html += `<div class="bulk-row bulk-error"><span class="bulk-day">⚠️ ?</span><span class="bulk-detail">"${escapeHtml(p.raw)}" — gün adı bulunamadı</span></div>`;
      return;
    }
    const dayName = BULK_DAY_NAMES[p.dayIndex];
    if (p.rest) {
      html += `<div class="bulk-row bulk-rest"><span class="bulk-day">${dayName}</span><span class="bulk-detail">😴 Dinlenme</span></div>`;
      return;
    }
    const meta = SPORT_META[p.sport];
    const bits = [];
    if (p.targetDistance) bits.push(p.sport === 'swim' ? `${p.targetDistance}m` : `${p.targetDistance}km`);
    if (p.targetDuration) bits.push(`${p.targetDuration}dk`);
    const extra = bits.length ? ` · ${bits.join(' · ')}` : '';
    html += `<div class="bulk-row">
      <span class="bulk-day">${dayName}</span>
      <span class="bulk-sport-chip" style="background:${meta.color}">${meta.name}</span>
      <span class="bulk-detail">${escapeHtml(p.details)}${extra}</span>
    </div>`;
  });

  container.innerHTML = html;
}

function submitBulkPlan() {
  const text = document.getElementById('bulk-plan-input').value;
  const parsed = parseBulkText(text);
  const workouts = parsed.filter(p => p.sport);

  if (workouts.length === 0) {
    showToast('Eklenecek antrenman bulunamadı. Format: "Pazartesi: Koşu 10km".', 'error');
    return;
  }

  // Bu haftanın mevcut planlarını değiştir seçeneği
  if (document.getElementById('bulk-plan-replace').checked) {
    const weekEnd = addDaysStr(bulkWeekMonday, 6);
    state.plans = state.plans.filter(p => !(p.date >= bulkWeekMonday && p.date <= weekEnd));
  }

  workouts.forEach((p, i) => {
    state.plans.push({
      id: 'p_' + Date.now() + '_' + i,
      date: p.date,
      sport: p.sport,
      targetDistance: p.targetDistance,
      targetDuration: p.targetDuration,
      details: p.details,
      completed: false
    });
  });

  saveState();
  document.getElementById('modal-bulk-plan').classList.remove('open');
  renderProgramView();
  renderTodayView();
  showToast(`${workouts.length} antrenman programa eklendi! 📋`);
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}

function renderProgramView() {
  const curr = new Date(currentDateStr);
  const startOfWeek = new Date(curr);
  const currentDay = curr.getDay();
  const distanceToMon = currentDay === 0 ? -6 : 1 - currentDay;
  startOfWeek.setDate(curr.getDate() + distanceToMon);

  const daysOfWeekNames = ["Pazartesi", "Salı", "Çarşamba", "Perşembe", "Cuma", "Cumartesi", "Pazar"];

  for (let i = 0; i < 7; i++) {
    const loopDate = new Date(startOfWeek);
    loopDate.setDate(startOfWeek.getDate() + i);
    const loopDateStr = formatDate(loopDate);

    const dayCard = document.querySelector(`.day-schedule-card[data-day="${i}"]`);
    const dayPlansContainer = document.getElementById(`day-plans-${i}`);
    
    const dayPlans = state.plans.filter(p => p.date === loopDateStr);
    
    const formattedDayTitle = `${loopDate.getDate()} ${loopDate.toLocaleDateString('tr-TR', { month: 'short' })} - ${daysOfWeekNames[i]}`;
    dayCard.querySelector('.day-header').innerHTML = `${formattedDayTitle} <span class="badge badge-blue">${dayPlans.length} Plan</span>`;

    if (dayPlans.length === 0) {
      dayPlansContainer.innerHTML = '<p class="empty-state-text-mini" style="font-size:11px; color:var(--text-muted);">Planlanan antrenman yok.</p>';
    } else {
      dayPlansContainer.innerHTML = '';
      dayPlans.forEach(plan => {
        const sportIcons = { run: '🏃', bike: '🚴', swim: '🏊', fitness: '🏋️' };
        
        const planEl = document.createElement('div');
        planEl.className = `plan-item-mini badge-${plan.sport} ${plan.completed ? 'completed' : ''}`;
        planEl.style.display = 'flex';
        planEl.style.justifyContent = 'space-between';
        planEl.style.alignItems = 'center';
        planEl.style.padding = '4px 8px';
        planEl.style.borderRadius = '6px';
        planEl.style.marginBottom = '4px';
        planEl.style.fontSize = '12px';
        planEl.innerHTML = `
          <div class="plan-mini-details">
            <strong>${sportIcons[plan.sport]} ${plan.details || 'Plan'}</strong>
            ${plan.targetDistance ? `<span>(${plan.targetDistance}km)</span>` : ''}
          </div>
          <button class="delete-plan-btn" style="border:none; background:none; cursor:pointer; font-size:14px; font-weight:bold;" data-id="${plan.id}">&times;</button>
        `;

        planEl.querySelector('.delete-plan-btn').addEventListener('click', (e) => {
          e.stopPropagation();
          if (confirm("Bu planı silmek istiyor musunuz?")) {
            state.plans = state.plans.filter(p => p.id !== plan.id);
            saveState();
            renderProgramView();
            renderTodayView();
            showToast("Plan silindi.");
          }
        });

        dayPlansContainer.appendChild(planEl);
      });
    }
  }
}

// ==========================================
// 6. GÜNLÜK DİYET TAKİBİ VE ARAMA YÖNETİMİ
// ==========================================

let activeMealSelector = 'breakfast'; // Hangi öğüne besin eklenecek

// Diyet planı eklenirken hedef gün (haftalık planlamada ileri tarih olabilir).
// Günlük takip ekranından açılınca currentDateStr'e eşitlenir.
let dietTargetDate = currentDateStr;

// Haftalık Plan görünümünde gösterilen haftanın bir günü (◀ ▶ ile gezinir)
let dietWeekAnchor = currentDateStr;

// Öğün meta bilgisi (ikon + Türkçe ad) — tek kaynak, tekrarı önler
const MEAL_META = {
  breakfast: { icon: '🍳', name: 'Kahvaltı' },
  lunch:     { icon: '🍗', name: 'Öğle' },
  dinner:    { icon: '🥗', name: 'Akşam' },
  snack:     { icon: '🍌', name: 'Atıştırmalık' }
};
const MEAL_ORDER = ['breakfast', 'lunch', 'dinner', 'snack'];

// Birimlerin gram karşılıkları (besin değerleri 100g bazlıdır)
const UNIT_GRAMS = {
  g: 1,          // 1 gram
  portion: 150,  // 1 porsiyon ≈ 150g
  plate: 300,    // 1 tabak ≈ 300g
  bowl: 250,     // 1 kase ≈ 250g
  cup: 200,      // 1 bardak / kutu ≈ 200ml/g
  handful: 30    // 1 avuç ≈ 30g
};

// Birimlerin ekranda gösterilecek Türkçe etiketleri
const UNIT_LABELS = {
  g: 'g', portion: 'porsiyon', plate: 'tabak',
  bowl: 'kase', cup: 'bardak', handful: 'avuç', piece: 'adet'
};

// Miktar + birimi okunabilir metne çevir (örn. "100 g", "1 tabak")
function formatPortion(qty, unit) {
  const label = UNIT_LABELS[unit] || unit;
  return unit === 'g' ? `${qty}${label}` : `${qty} ${label}`;
}

// Tarihi kısa, okunabilir Türkçe etikete çevir (örn. "14 Haz Cmt", "bugün", "yarın")
function shortDateLabel(dateStr) {
  if (dateStr === currentDateStr) return 'bugün';
  if (dateStr === addDaysStr(currentDateStr, 1)) return 'yarın';
  const d = new Date(dateStr);
  return d.toLocaleDateString('tr-TR', { day: 'numeric', month: 'short', weekday: 'short' });
}

// Plan eklenirken toast'ta gösterilecek hedef gün etiketi
function dietPlanTargetLabel() {
  return dietTargetDate === currentDateStr ? 'diyet' : `${shortDateLabel(dietTargetDate)}`;
}

function initDietView() {
  const modal = document.getElementById('modal-diet-add');
  const closeBtn = document.getElementById('close-modal-diet');
  const searchInput = document.getElementById('food-search-input');
  
  document.addEventListener('click', (e) => {
    if (e.target.classList.contains('add-food-to-meal-btn')) {
      const mealSection = e.target.closest('.meal-section');
      // Günlük takip ekranı: hedef gün = o anki gün
      openDietModal(mealSection.getAttribute('data-meal'), currentDateStr);
    }
  });

  closeBtn.addEventListener('click', () => modal.classList.remove('open'));
  modal.addEventListener('click', (e) => {
    if (e.target === modal) modal.classList.remove('open');
  });

  let debounceTimer;
  searchInput.addEventListener('input', (e) => {
    clearTimeout(debounceTimer);
    const query = e.target.value.trim().toLowerCase();
    
    if (query.length < 2) {
      document.getElementById('food-search-results').innerHTML = '<p class="text-xs text-muted text-center" style="padding: 10px 0;">En az 2 harf yazın...</p>';
      return;
    }

    document.getElementById('food-search-results').innerHTML = '<p class="text-xs text-muted text-center" style="padding: 10px 0;">Arama yapılıyor...</p>';

    debounceTimer = setTimeout(() => {
      searchFoods(query);
    }, 400);
  });

  // Miktar/Birim değişince seçilen besinin makrolarını canlı güncelle
  const portionQtyInput = document.getElementById('food-portion-qty');
  const portionUnitInput = document.getElementById('food-portion-unit');
  portionQtyInput.addEventListener('input', updatePortionPreview);
  portionUnitInput.addEventListener('change', () => {
    // Birim değişince mantıklı bir varsayılan miktar ata (gram için 100, diğerleri için 1)
    portionQtyInput.value = portionUnitInput.value === 'g' ? 100 : 1;
    updatePortionPreview();
  });

  const toggleManualBtn = document.getElementById('toggle-manual-food-btn');
  const manualForm = document.getElementById('form-manual-food');
  toggleManualBtn.addEventListener('click', () => {
    manualForm.classList.toggle('hidden');
  });

  // Tüketilen Ekle Butonu (Manuel Gıda Formu)
  document.getElementById('btn-manual-eat').addEventListener('click', (e) => {
    saveManualFood(e, false);
  });

  // Plana Ekle Butonu (Manuel Gıda Formu)
  document.getElementById('btn-manual-plan').addEventListener('click', (e) => {
    saveManualFood(e, true);
  });

  // Mod geçişi: Günlük Takip / Haftalık Plan
  document.querySelectorAll('.diet-segment-btn').forEach(btn => {
    btn.addEventListener('click', () => switchDietPane(btn.getAttribute('data-diet-pane')));
  });

  // Haftalık plan navigasyonu (◀ ▶)
  document.getElementById('diet-week-prev').addEventListener('click', () => {
    dietWeekAnchor = addDaysStr(dietWeekAnchor, -7);
    renderWeeklyDietView();
  });
  document.getElementById('diet-week-next').addEventListener('click', () => {
    dietWeekAnchor = addDaysStr(dietWeekAnchor, 7);
    renderWeeklyDietView();
  });

  renderDietView();
}

// Diyet sekmesindeki paneller arası geçiş (daily | weekly)
function switchDietPane(pane) {
  document.querySelectorAll('.diet-segment-btn').forEach(b =>
    b.classList.toggle('active', b.getAttribute('data-diet-pane') === pane));
  document.getElementById('diet-daily').classList.toggle('active', pane === 'daily');
  document.getElementById('diet-weekly').classList.toggle('active', pane === 'weekly');

  if (pane === 'weekly') {
    dietWeekAnchor = currentDateStr; // her açılışta o anki haftaya dön
    renderWeeklyDietView();
  } else {
    renderDietView();
  }
}

// Besin ekleme modalını belirli bir öğün + hedef gün için aç.
// Günlük takipten çağrılınca targetDate = currentDateStr (plan da tüketim de aynı güne).
// Haftalık plandan çağrılınca targetDate = seçilen gün (yalnızca plana eklenir).
function openDietModal(meal, targetDate) {
  const modal = document.getElementById('modal-diet-add');
  activeMealSelector = meal;
  dietTargetDate = targetDate || currentDateStr;

  // Arama / seçim panelini sıfırla
  document.getElementById('food-search-input').value = '';
  document.getElementById('food-search-results').innerHTML =
    '<p class="text-xs text-muted text-center" style="padding: 10px 0;">Besin aramak için yukarıya yazmaya başlayın.</p>';
  document.getElementById('food-selection-panel').classList.add('hidden');

  const manualForm = document.getElementById('form-manual-food');
  if (manualForm) manualForm.classList.add('hidden');

  // Bağlam etiketi: hangi gün + öğün için planlandığını göster
  const ctx = document.getElementById('diet-modal-context');
  if (ctx) {
    const meta = MEAL_META[meal];
    if (dietTargetDate === currentDateStr) {
      ctx.textContent = `${meta.icon} ${meta.name} — bugün için`;
    } else {
      ctx.textContent = `📅 ${shortDateLabel(dietTargetDate)} · ${meta.icon} ${meta.name} planlanıyor`;
    }
  }

  modal.classList.add('open');
}

function saveManualFood(e, isPlanned) {
  const form = document.getElementById('form-manual-food');
  if (!form.checkValidity()) {
    form.reportValidity();
    return;
  }
  e.preventDefault();

  const name = document.getElementById('manual-food-name').value;
  const cal = parseFloat(document.getElementById('manual-food-cal').value);
  const p = parseFloat(document.getElementById('manual-food-p').value);
  const c = parseFloat(document.getElementById('manual-food-c').value);
  const f = parseFloat(document.getElementById('manual-food-f').value);

  if (isPlanned) {
    const newPlan = {
      id: 'dp_' + Date.now(),
      date: dietTargetDate,
      meal: activeMealSelector,
      name: name,
      calories: cal,
      protein: p,
      carbs: c,
      fat: f,
      quantity: 100,
      unit: 'g',
      completed: false
    };
    state.dietPlans.push(newPlan);
    showToast(`"${name}" ${dietPlanTargetLabel()} planına eklendi.`);
  } else {
    const newFood = {
      id: 'fd_' + Date.now(),
      date: currentDateStr,
      meal: activeMealSelector,
      name: name,
      calories: cal,
      protein: p,
      carbs: c,
      fat: f,
      quantity: 1,
      unit: 'piece'
    };
    state.diet.push(newFood);
    showToast(`"${name}" tüketilen besinlere eklendi.`);
  }

  saveState();
  document.getElementById('modal-diet-add').classList.remove('open');
  form.reset();
  form.classList.add('hidden');
  
  renderDietView();
  renderTodayView();
}

function searchFoods(query) {
  let localMatches = [];
  if (typeof LOCAL_FOODS !== 'undefined') {
    localMatches = LOCAL_FOODS.filter(food => food.name.toLowerCase().includes(query));
  }

  const apiUrl = `https://world.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(query)}&search_simple=1&action=process&json=1&page_size=12`;

  fetch(apiUrl)
    .then(res => res.json())
    .then(data => {
      const apiMatches = data.products || [];
      renderSearchResults(localMatches, apiMatches);
    })
    .catch(err => {
      console.warn("Open Food Facts API hatası, sadece yerel sonuçlar gösterilecek.", err);
      renderSearchResults(localMatches, []);
    });
}

let selectedFoodObject = null;

function renderSearchResults(localMatches, apiMatches) {
  const container = document.getElementById('food-search-results');
  container.innerHTML = '';

  if (localMatches.length === 0 && apiMatches.length === 0) {
    container.innerHTML = '<p class="text-xs text-muted text-center" style="padding:10px 0;">Besin bulunamadı. Manuel ekleyebilirsiniz.</p>';
    return;
  }

  // Yerel Sonuçlar
  if (localMatches.length > 0) {
    const section = document.createElement('div');
    section.style.padding = '4px 8px';
    section.style.fontSize = '12px';
    section.style.fontWeight = 'bold';
    section.style.color = 'var(--text-secondary)';
    section.innerText = 'Yerel Sporcu Besinleri';
    container.appendChild(section);

    localMatches.forEach(food => {
      const item = document.createElement('div');
      item.className = 'food-result-row';
      item.innerHTML = `
        <div>
          <div style="font-size:13px; font-weight:500;">${food.name}</div>
          <div style="font-size:11px; color:var(--text-muted);">P:${food.protein}g C:${food.carbs}g F:${food.fat}g (100g)</div>
        </div>
        <div style="font-size:13px; font-weight:600; color:var(--accent-blue);">${food.calories} kcal</div>
      `;
      item.addEventListener('click', () => {
        highlightSelectedResult(container, item);
        selectFoodForPortion({
          name: food.name,
          calories: food.calories,
          protein: food.protein,
          carbs: food.carbs,
          fat: food.fat,
          isLocal: true
        });
      });
      container.appendChild(item);
    });
  }

  // API Sonuçları
  const validApiProducts = apiMatches.filter(p => {
    return p.product_name && p.nutriments && p.nutriments['energy-kcal_100g'] !== undefined;
  });

  if (validApiProducts.length > 0) {
    const section = document.createElement('div');
    section.style.padding = '8px 8px 4px 8px';
    section.style.fontSize = '12px';
    section.style.fontWeight = 'bold';
    section.style.color = 'var(--text-secondary)';
    section.innerText = 'Çevrimiçi Gıda Sonuçları';
    container.appendChild(section);

    validApiProducts.forEach(product => {
      const name = product.product_name_tr || product.product_name || product.product_name_en;
      const brand = product.brands ? ` (${product.brands})` : '';
      const fullName = name + brand;
      
      const nuts = product.nutriments;
      const cal = Math.round(nuts['energy-kcal_100g']);
      const p = Math.round((nuts.proteins_100g || 0) * 10) / 10;
      const c = Math.round((nuts.carbohydrates_100g || 0) * 10) / 10;
      const f = Math.round((nuts.fat_100g || 0) * 10) / 10;

      const item = document.createElement('div');
      item.className = 'food-result-row';
      item.innerHTML = `
        <div>
          <div style="font-size:13px; font-weight:500;">${fullName}</div>
          <div style="font-size:11px; color:var(--text-muted);">P:${p}g C:${c}g F:${f}g (100g)</div>
        </div>
        <div style="font-size:13px; font-weight:600; color:var(--accent-blue);">${cal} kcal</div>
      `;
      item.addEventListener('click', () => {
        highlightSelectedResult(container, item);
        selectFoodForPortion({
          name: fullName,
          calories: cal,
          protein: p,
          carbs: c,
          fat: f,
          isLocal: false
        });
      });
      container.appendChild(item);
    });
  }
}

function selectFoodForPortion(food) {
  selectedFoodObject = food;

  document.getElementById('selected-food-name').innerText = food.name;

  document.getElementById('food-portion-qty').value = 100;
  document.getElementById('food-portion-unit').value = "g";

  // Makro rozetlerini seçilen miktara göre canlı doldur
  updatePortionPreview();

  const selectPanel = document.getElementById('food-selection-panel');
  selectPanel.classList.remove('hidden');
  selectPanel.scrollIntoView({ behavior: 'smooth' });

  // 1. Tüketilen Ekle Buton Lojiği
  const eatBtn = document.getElementById('add-selected-food-btn');
  eatBtn.onclick = null;
  eatBtn.onclick = () => addSelectedFoodToState(false);

  // 2. Plana Ekle Buton Lojiği
  const planBtn = document.getElementById('plan-selected-food-btn');
  planBtn.onclick = null;
  planBtn.onclick = () => addSelectedFoodToState(true);
}

// Arama sonucunda seçilen satırı görsel olarak vurgula
function highlightSelectedResult(container, selectedItem) {
  container.querySelectorAll('.food-result-row').forEach(el => el.classList.remove('selected'));
  selectedItem.classList.add('selected');
}

// Seçilen miktar + birime göre makro rozetlerini canlı güncelle
function updatePortionPreview() {
  if (!selectedFoodObject) return;
  const qty = parseFloat(document.getElementById('food-portion-qty').value) || 0;
  const unit = document.getElementById('food-portion-unit').value;
  const ratio = (qty * (UNIT_GRAMS[unit] || 1)) / 100;

  document.getElementById('sel-cal').innerText = Math.round(selectedFoodObject.calories * ratio);
  document.getElementById('sel-p').innerText = Math.round(selectedFoodObject.protein * ratio * 10) / 10;
  document.getElementById('sel-c').innerText = Math.round(selectedFoodObject.carbs * ratio * 10) / 10;
  document.getElementById('sel-f').innerText = Math.round(selectedFoodObject.fat * ratio * 10) / 10;
}

function addSelectedFoodToState(isPlanned) {
  const qty = parseFloat(document.getElementById('food-portion-qty').value);
  const unit = document.getElementById('food-portion-unit').value;

  if (isNaN(qty) || qty <= 0) {
    showToast("Lütfen geçerli bir miktar girin.", 'error');
    return;
  }

  // Her birim gram karşılığına çevrilir, besin değerleri 100g bazlı hesaplanır
  const ratio = (qty * (UNIT_GRAMS[unit] || 1)) / 100;

  if (isPlanned) {
    const calculatedFood = {
      id: 'dp_' + Date.now(),
      date: dietTargetDate,
      meal: activeMealSelector,
      name: selectedFoodObject.name,
      calories: Math.round(selectedFoodObject.calories * ratio),
      protein: Math.round(selectedFoodObject.protein * ratio * 10) / 10,
      carbs: Math.round(selectedFoodObject.carbs * ratio * 10) / 10,
      fat: Math.round(selectedFoodObject.fat * ratio * 10) / 10,
      quantity: qty,
      unit: unit,
      completed: false
    };
    state.dietPlans.push(calculatedFood);
    showToast(`"${calculatedFood.name}" ${dietPlanTargetLabel()} planına eklendi.`);
  } else {
    const calculatedFood = {
      id: 'fd_' + Date.now(),
      date: currentDateStr,
      meal: activeMealSelector,
      name: selectedFoodObject.name,
      calories: Math.round(selectedFoodObject.calories * ratio),
      protein: Math.round(selectedFoodObject.protein * ratio * 10) / 10,
      carbs: Math.round(selectedFoodObject.carbs * ratio * 10) / 10,
      fat: Math.round(selectedFoodObject.fat * ratio * 10) / 10,
      quantity: qty,
      unit: unit
    };
    state.diet.push(calculatedFood);
    showToast(`"${calculatedFood.name}" tüketilen besinlere eklendi.`);
  }

  saveState();
  document.getElementById('modal-diet-add').classList.remove('open');
  
  renderDietView();
  renderTodayView();
}

function renderDietView() {
  const meals = ['breakfast', 'lunch', 'dinner', 'snack'];
  
  meals.forEach(meal => {
    const mealContainer = document.getElementById(`meal-foods-${meal}`);
    
    // Tüketilenler
    // Plandan otomatik senkronlanan (fd_sync_) öğeler "Tüketilen" listesinde TEKRAR gösterilmez;
    // zaten yukarıdaki "Diyet Planı" satırında işaretli görünüyorlar (kalori toplamına yine dahil).
    const mealFoods = state.diet.filter(f => f.date === currentDateStr && f.meal === meal && !f.id.startsWith('fd_sync_'));
    // Planlananlar (Yeni Özellik)
    const mealPlans = state.dietPlans.filter(f => f.date === currentDateStr && f.meal === meal);

    if (mealFoods.length === 0 && mealPlans.length === 0) {
      mealContainer.innerHTML = '<p class="empty-state-text-mini" style="font-size:11px; color:var(--text-muted);">Öğün planı ve giriş yapılmamış.</p>';
    } else {
      mealContainer.innerHTML = '';
      
      // Önce Planlananları listele (Transparan kart + checkbox)
      if (mealPlans.length > 0) {
        const planHeader = document.createElement('div');
        planHeader.className = 'meal-plans-title-badge';
        planHeader.innerHTML = `<span>📋 Diyet Planı</span>`;
        mealContainer.appendChild(planHeader);

        mealPlans.forEach(plan => {
          const planItem = document.createElement('div');
          planItem.className = `meal-plan-item ${plan.completed ? 'completed' : ''}`;
          planItem.innerHTML = `
            <div style="display:flex; align-items:center; gap:8px;">
              <input type="checkbox" ${plan.completed ? 'checked' : ''} data-inner-plan-id="${plan.id}" style="width:16px; height:16px; cursor:pointer;">
              <div>
                <span class="food-name">${plan.name}</span>
                <span style="display:block; font-size:10px; color:var(--text-secondary);">${formatPortion(plan.quantity, plan.unit)} | ${plan.calories}kcal | P:${plan.protein}g</span>
              </div>
            </div>
            <button class="delete-plan-food-btn" style="border:none; background:none; cursor:pointer; font-size:18px; color:var(--text-muted);" data-id="${plan.id}">&times;</button>
          `;

          // Checkbox event
          planItem.querySelector('input[type="checkbox"]').addEventListener('change', (e) => {
            toggleDietPlanCompleted(plan, e.target.checked);
            renderDietView();
          });

          // Delete plan event
          planItem.querySelector('.delete-plan-food-btn').addEventListener('click', () => {
            if (confirm("Bu planlanan diyeti silmek istiyor musunuz?")) {
              state.dietPlans = state.dietPlans.filter(p => p.id !== plan.id);
              // Tüketilenlerden de kaldır (eğer checked ise)
              state.diet = state.diet.filter(f => f.id !== 'fd_sync_' + plan.id);
              saveState();
              renderDietView();
              renderTodayView();
              showToast("Diyet planı silindi.");
            }
          });

          mealContainer.appendChild(planItem);
        });
      }

      // Sonra Tüketilenleri listele (Normal kart)
      if (mealFoods.length > 0) {
        const foodsHeader = document.createElement('div');
        foodsHeader.style.fontSize = '12px';
        foodsHeader.style.fontWeight = '600';
        foodsHeader.style.color = 'var(--text-primary)';
        foodsHeader.style.margin = '10px 0 6px 0';
        foodsHeader.innerText = '🍽 Tüketilen Gıdalar';
        mealContainer.appendChild(foodsHeader);

        mealFoods.forEach(food => {
          const item = document.createElement('div');
          item.className = 'meal-food-item';
          item.style.display = 'flex';
          item.style.justifyContent = 'space-between';
          item.style.alignItems = 'center';
          item.style.padding = '8px 12px';
          item.style.borderRadius = '10px';
          item.style.backgroundColor = 'var(--bg-secondary)';
          item.style.marginBottom = '6px';
          item.style.border = '1px solid var(--card-border)';
          item.innerHTML = `
            <div>
              <span class="food-name" style="font-weight:500;">${food.name}</span>
              <span class="food-details" style="display:block; font-size:10px; color:var(--text-secondary);">${formatPortion(food.quantity, food.unit)} | P:${food.protein}g C:${food.carbs}g F:${food.fat}g</span>
            </div>
            <div style="display:flex; align-items:center; gap:8px;">
              <span class="food-calories" style="font-size:12px; font-weight:600; color:var(--text-primary);">${food.calories} kcal</span>
              <button class="delete-food-btn" style="border:none; background:none; cursor:pointer; font-size:18px; color:var(--text-muted);" data-id="${food.id}">&times;</button>
            </div>
          `;

          item.querySelector('.delete-food-btn').addEventListener('click', () => {
            state.diet = state.diet.filter(f => f.id !== food.id);
            // Eğer planlı bir diyet ise completed'ı kaldır
            if (food.id.startsWith('fd_sync_')) {
              const planId = food.id.replace('fd_sync_', '');
              const matchingPlan = state.dietPlans.find(p => p.id === planId);
              if (matchingPlan) matchingPlan.completed = false;
            }
            saveState();
            renderDietView();
            renderTodayView();
            showToast("Besin silindi.");
          });

          mealContainer.appendChild(item);
        });
      }
    }
  });

  updateDietSummaryDOM();
}

// ==========================================
// 6.B HAFTALIK DİYET PLANI (İLERİ TARİHLİ PLANLAMA)
// ==========================================

// Bir günün planlı öğünlerinin toplam kalorisi
function dayPlanCalories(dateStr) {
  return state.dietPlans
    .filter(p => p.date === dateStr)
    .reduce((sum, p) => sum + (p.calories || 0), 0);
}

// Haftalık plan görünümünü çiz (dietWeekAnchor haftasının Pzt–Paz'ı)
function renderWeeklyDietView() {
  const list = document.getElementById('weekly-diet-list');
  if (!list) return;

  const weekStart = mondayOf(dietWeekAnchor);
  const weekEnd = addDaysStr(weekStart, 6);

  // Başlık: tarih aralığı
  const sd = new Date(weekStart), ed = new Date(weekEnd);
  const fmt = d => d.toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' });
  document.getElementById('diet-week-title').textContent = `${fmt(sd)} – ${fmt(ed)}`;

  const dayNames = ['Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi', 'Pazar'];
  list.innerHTML = '';

  for (let i = 0; i < 7; i++) {
    const dateStr = addDaysStr(weekStart, i);
    const d = new Date(dateStr);
    const isToday = dateStr === currentDateStr;
    const kcal = Math.round(dayPlanCalories(dateStr));

    const card = document.createElement('div');
    card.className = `diet-day-card${isToday ? ' is-today' : ''}`;

    // Başlık + günlük toplam kalori
    let html = `
      <div class="diet-day-head">
        <span class="diet-day-title">${d.getDate()} ${d.toLocaleDateString('tr-TR', { month: 'short' })} · ${dayNames[i]}${isToday ? ' (bugün)' : ''}</span>
        ${kcal > 0 ? `<span class="diet-day-kcal">${kcal} kcal</span>` : ''}
      </div>`;

    // Öğün satırları
    MEAL_ORDER.forEach(meal => {
      const meta = MEAL_META[meal];
      const items = state.dietPlans.filter(p => p.date === dateStr && p.meal === meal);
      html += `
        <div class="diet-meal-row">
          <div class="diet-meal-row-head">
            <span class="meal-label">${meta.icon} ${meta.name}</span>
            <button class="diet-meal-add-btn" data-date="${dateStr}" data-meal="${meal}">+ Ekle</button>
          </div>`;
      if (items.length === 0) {
        html += `<p class="diet-meal-empty">—</p>`;
      } else {
        items.forEach(p => {
          html += `
            <div class="diet-plan-chip">
              <div>
                <span class="chip-name">${p.name}</span>
                <span class="chip-meta">${formatPortion(p.quantity, p.unit)} · ${p.calories} kcal · P:${p.protein}g</span>
              </div>
              <button class="chip-del" data-plan-id="${p.id}" aria-label="Sil">&times;</button>
            </div>`;
        });
      }
      html += `</div>`;
    });

    // Hızlı eylemler: kopyala
    html += `
      <div class="diet-day-actions">
        <button class="copy-day-tomorrow" data-date="${dateStr}">⧉ Ertesi güne kopyala</button>
        <button class="apply-day-week" data-date="${dateStr}">⇉ Tüm haftaya uygula</button>
      </div>`;

    card.innerHTML = html;

    // + Ekle → modalı o gün + öğün için aç
    card.querySelectorAll('.diet-meal-add-btn').forEach(btn => {
      btn.addEventListener('click', () =>
        openDietModal(btn.getAttribute('data-meal'), btn.getAttribute('data-date')));
    });

    // Plan kalemi sil
    card.querySelectorAll('.chip-del').forEach(btn => {
      btn.addEventListener('click', () => deleteDietPlan(btn.getAttribute('data-plan-id')));
    });

    // Günü kopyala / haftaya uygula
    card.querySelector('.copy-day-tomorrow').addEventListener('click', () => {
      copyDietDay(dateStr, addDaysStr(dateStr, 1));
    });
    card.querySelector('.apply-day-week').addEventListener('click', () => {
      applyDayToWeek(dateStr);
    });

    list.appendChild(card);
  }
}

// Bir plan kalemini sil (haftalık görünümden). Tamamlanmışsa tüketilenden de düşür.
function deleteDietPlan(planId) {
  const plan = state.dietPlans.find(p => p.id === planId);
  if (!plan) return;
  state.dietPlans = state.dietPlans.filter(p => p.id !== planId);
  state.diet = state.diet.filter(f => f.id !== 'fd_sync_' + planId);
  saveState();
  renderWeeklyDietView();
  renderTodayView();
  showToast("Plan kalemi silindi.");
}

// Bir günün planlı öğünlerini hedef güne klonla (tüketilenlere dokunmaz)
function copyDietDay(fromDate, toDate) {
  const items = state.dietPlans.filter(p => p.date === fromDate);
  if (items.length === 0) {
    showToast("Kopyalanacak plan yok.");
    return;
  }
  items.forEach((p, idx) => {
    state.dietPlans.push({
      ...p,
      id: 'dp_' + Date.now() + '_' + idx,
      date: toDate,
      completed: false
    });
  });
  saveState();
  renderWeeklyDietView();
  renderTodayView();
  showToast(`${items.length} öğün ${shortDateLabel(toDate)} gününe kopyalandı.`);
}

// Bir günün planını aynı haftanın diğer günlerine uygula (önce o günleri temizler)
function applyDayToWeek(fromDate) {
  const source = state.dietPlans.filter(p => p.date === fromDate);
  if (source.length === 0) {
    showToast("Önce bu güne öğün ekle.");
    return;
  }
  if (!confirm("Bu günün planı haftanın diğer 6 gününe kopyalanacak.\nO günlerdeki mevcut planlar silinecek. Devam edilsin mi?")) return;

  const weekStart = mondayOf(fromDate);
  for (let i = 0; i < 7; i++) {
    const dateStr = addDaysStr(weekStart, i);
    if (dateStr === fromDate) continue;
    // Hedef günün eski planlarını ve onlara bağlı tüketilenleri temizle
    const oldIds = state.dietPlans.filter(p => p.date === dateStr).map(p => p.id);
    state.dietPlans = state.dietPlans.filter(p => p.date !== dateStr);
    state.diet = state.diet.filter(f => !oldIds.some(id => f.id === 'fd_sync_' + id));
    // Kaynağı klonla
    source.forEach((p, idx) => {
      state.dietPlans.push({
        ...p,
        id: 'dp_' + Date.now() + '_' + i + '_' + idx,
        date: dateStr,
        completed: false
      });
    });
  }
  saveState();
  renderWeeklyDietView();
  renderTodayView();
  showToast("Plan tüm haftaya uygulandı ✅");
}

// ==========================================
// 7. ANTRENMAN KAYIT (WORKOUT LOGGER) YÖNETİMİ
// ==========================================

function initWorkoutLogView() {
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
      id: 'w_' + Date.now(),
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
      id: 'w_' + Date.now(),
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
      id: 'w_' + Date.now(),
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
      id: 'w_' + Date.now(),
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

function saveWorkoutAndRoute(workout) {
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

const WORKOUT_SUBMIT_LABELS = {
  run: 'Koşu Antrenmanını Kaydet',
  bike: 'Bisiklet Antrenmanını Kaydet',
  swim: 'Yüzme Antrenmanını Kaydet',
  fitness: 'Fitness Antrenmanını Kaydet'
};

function workoutSubmitBtn(sport) {
  return document.querySelector(`#form-log-${sport} button[type="submit"]`);
}

function resetWorkoutForms() {
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
function buildExerciseRow(ex) {
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
function prefillWorkoutForm(w) {
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
function startEditWorkout(w) {
  document.querySelector('.bottom-nav [data-view="log"]').click(); // resetWorkoutForms çalışır (editingWorkoutId=null)
  const tab = document.querySelector(`.sport-tab-btn[data-sport="${w.sport}"]`);
  if (tab) tab.click();

  prefillWorkoutForm(w);
  editingWorkoutId = w.id; // reset'ten SONRA ayarla

  const btn = workoutSubmitBtn(w.sport);
  if (btn) btn.innerText = '✓ Antrenmanı Güncelle';

  showToast('Düzenleme modu — kaydedince güncellenecek.');
}

// ==========================================
// 8. PROFİL AYARLARI VE YAPAY ZEKA ANTRENÖRÜ
// ==========================================

function initProfileView() {
  const settingsForm = document.getElementById('form-settings');
  
  document.getElementById('settings-name').value = state.profile.name || '';
  document.getElementById('settings-weight').value = state.profile.weight || '';
  document.getElementById('settings-calories').value = state.profile.targetDailyCalories || 2500;
  document.getElementById('settings-p-target').value = state.profile.targetMacros.protein || 150;
  document.getElementById('settings-c-target').value = state.profile.targetMacros.carbs || 300;
  document.getElementById('settings-f-target').value = state.profile.targetMacros.fat || 70;
  document.getElementById('settings-gemini-key').value = state.profile.geminiApiKey || '';

  updateAiBadge();

  settingsForm.addEventListener('submit', (e) => {
    e.preventDefault();
    
    state.profile.name = document.getElementById('settings-name').value;
    state.profile.weight = parseFloat(document.getElementById('settings-weight').value);
    state.profile.targetDailyCalories = parseInt(document.getElementById('settings-calories').value);
    state.profile.targetMacros.protein = parseInt(document.getElementById('settings-p-target').value);
    state.profile.targetMacros.carbs = parseInt(document.getElementById('settings-c-target').value);
    state.profile.targetMacros.fat = parseInt(document.getElementById('settings-f-target').value);
    state.profile.geminiApiKey = document.getElementById('settings-gemini-key').value;

    saveState();
    showToast("Profil ayarları kaydedildi.");
    updateAiBadge();
    renderTodayView();
  });

  initWorkoutImport();

  const analyzeBtn = document.getElementById('ai-analyze-btn');
  const sendBtn = document.getElementById('ai-send-btn');
  const chatInput = document.getElementById('ai-chat-input');
  
  analyzeBtn.addEventListener('click', () => {
    generateCoachReport();
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

function updateAiBadge() {
  const badge = document.getElementById('ai-status-badge');
  if (state.profile.geminiApiKey) {
    badge.innerText = "Gemini Bulut Modu";
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

function renderProfileView() {
  updateAiBadge();
}

// ==========================================
// 9. GEMINI AI ANTRENÖR ZEKASI (CLOUD & LOCAL)
// ==========================================

function appendChatMessage(sender, text) {
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
function renderMarkdownLite(text) {
  return escapeHtml(text)
    .replace(/^###\s+(.*)$/gm, '<strong>$1</strong>')
    .replace(/^##\s+(.*)$/gm, '<strong>$1</strong>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/^\s*[-*]\s+/gm, '• ')
    .replace(/\n/g, '<br>');
}

// Güncel Gemini modeli (gerekirse buradan değiştir)
const GEMINI_MODEL = 'gemini-2.5-flash';

function fmtNum(v, dec) {
  if (v == null) return '-';
  const k = Math.pow(10, dec);
  return Math.round(v * k) / k;
}

// Belirli bir haftanın (Pazartesi başlangıçlı) toplam antrenman dakikası
function weekMinutes(monday) {
  const end = addDaysStr(monday, 6);
  return Math.round(state.workouts
    .filter(w => w.date >= monday && w.date <= end)
    .reduce((a, w) => a + (w.duration || 0) / 60, 0));
}

// Bugünün "hazır olma" durumu: uyku süresi + uyku puanı + HRV (14 günlük baz ile)
function computeReadiness() {
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
function gatherCoachData() {
  const todayDiet = state.diet.filter(f => f.date === currentDateStr);
  const diet = { cal: 0, p: 0, c: 0, f: 0 };
  todayDiet.forEach(f => { diet.cal += f.calories; diet.p += f.protein; diet.c += f.carbs; diet.f += f.fat; });

  const thisMon = mondayOf(currentDateStr);
  return {
    diet,
    body: state.holisticLogs[currentDateStr] || {},
    avg7: {
      sleep: avgOf(holisticValues('sleep', 0, 6)),
      score: avgOf(holisticValues('sleepScore', 0, 6)),
      hrv: avgOf(holisticValues('hrv', 0, 6))
    },
    load: { thisWeek: weekMinutes(thisMon), lastWeek: weekMinutes(addDaysStr(thisMon, -7)) },
    recent: state.workouts.slice().sort((a, b) => (a.date < b.date ? 1 : -1)).slice(0, 6),
    readiness: computeReadiness()
  };
}

// Gemini için zengin rapor istem metni
function coachReportPrompt(d) {
  const p = state.profile;
  const r = d.readiness;
  const recentTxt = d.recent.length
    ? d.recent.map(w => `- ${w.date} · ${(SPORT_META[w.sport] || { name: w.sport }).name} · ${Math.round((w.duration || 0) / 60)}dk · ${w.distance || 0}${w.sport === 'swim' ? 'm' : 'km'} · RPE ${w.rpe || '-'}/10${w.notes ? ` · not: ${w.notes}` : ''}`).join('\n')
    : 'Son antrenman kaydı yok.';

  return `Sen triatlet ve koşucular için profesyonel bir yapay zeka antrenörüsün. Türkçe, samimi ama net konuş.

SPORCU: ${p.name}, ${p.weight} kg
HEDEF: ${p.targetDailyCalories} kcal/gün (P:${p.targetMacros.protein} C:${p.targetMacros.carbs} Y:${p.targetMacros.fat} g)

BUGÜN DİYET: ${Math.round(d.diet.cal)} kcal · P:${Math.round(d.diet.p)}g C:${Math.round(d.diet.c)}g Y:${Math.round(d.diet.f)}g
BUGÜN VÜCUT: uyku ${d.body.sleep != null ? d.body.sleep : '-'} saat, uyku puanı ${d.body.sleepScore != null ? d.body.sleepScore : '-'}/100, HRV ${d.body.hrv != null ? d.body.hrv : '-'} ms
7 GÜN ORT.: uyku ${fmtNum(d.avg7.sleep, 1)} saat, uyku puanı ${fmtNum(d.avg7.score, 0)}, HRV ${fmtNum(d.avg7.hrv, 0)} ms
HAFTALIK YÜK: bu hafta ${d.load.thisWeek} dk, geçen hafta ${d.load.lastWeek} dk
HAZIR OLMA (hesaplanan): ${r ? `${r.label}${r.reasons.length ? ' (' + r.reasons.join(', ') + ')' : ''}` : 'veri yetersiz'}

SON ANTRENMANLAR:
${recentTxt}

Bu verilere göre kısa, maddeli bir rapor yaz:
1. Beslenme: hedeflerle uyum (özellikle protein ve karbonhidrat yeterli mi?).
2. Toparlanma: uyku süresi+puanı ve HRV'ye göre hazır olma, aşırı antrenman riski.
3. Bugün/yarın önerisi: haftalık yük değişimi ve son RPE'lere göre yoğunluğu artır/azalt.
Gereksiz uzatma; doğrudan, uygulanabilir öneriler ver.`;
}

function generateCoachReport() {
  const container = document.getElementById('ai-chat-output');

  const loader = document.createElement('div');
  loader.className = 'ai-message message-bot loader-msg';
  loader.style.padding = '8px 12px';
  loader.innerHTML = 'Verileriniz inceleniyor, rapor hazırlanıyor...';
  container.appendChild(loader);
  container.scrollTop = container.scrollHeight;

  const data = gatherCoachData();
  const apiKey = state.profile.geminiApiKey;

  if (apiKey) {
    callGeminiAPI(apiKey, coachReportPrompt(data))
      .then(reply => { loader.remove(); appendChatMessage('bot', reply); })
      .catch(err => {
        console.error("Gemini API hatası, yerel moda geçiliyor", err);
        loader.remove();
        generateLocalReport(data, "Gemini bağlantısı kurulamadı, yerel analiz:\n\n");
      });
  } else {
    setTimeout(() => { loader.remove(); generateLocalReport(data); }, 1200);
  }
}

async function callGeminiAPI(apiKey, promptText) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`;
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

function generateLocalReport(d, prefixText = "") {
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

function handleCoachChat(userText) {
  appendChatMessage('user', userText);

  const container = document.getElementById('ai-chat-output');
  const loader = document.createElement('div');
  loader.className = 'ai-message message-bot loader-msg';
  loader.style.padding = '8px 12px';
  loader.innerHTML = 'Antrenörünüz düşünüyor...';
  container.appendChild(loader);
  container.scrollTop = container.scrollHeight;

  const apiKey = state.profile.geminiApiKey;

  if (apiKey) {
    const d = gatherCoachData();
    const ctx = `Sporcunun güncel durumu — Bugün: uyku ${d.body.sleep != null ? d.body.sleep + 's' : '-'}, uyku puanı ${d.body.sleepScore != null ? d.body.sleepScore : '-'}, HRV ${d.body.hrv != null ? d.body.hrv + 'ms' : '-'}, diyet ${Math.round(d.diet.cal)}kcal/P${Math.round(d.diet.p)}g. Bu hafta yük ${d.load.thisWeek}dk (geçen hafta ${d.load.lastWeek}dk). Hazır olma: ${d.readiness ? d.readiness.label : '-'}.`;

    const systemPrompt = `Sen ${state.profile.name} adlı sporcunun triatlon ve koşu antrenörüsün.
Sadece spor, antrenman (yüzme/bisiklet/koşu/güç), sporcu beslenmesi, diyet, uyku ve toparlanma konularına cevap ver.
Alakasız sorularda kibarca sadece antrenör olduğunu belirt. Türkçe konuş; kısa, motive edici ve net ol. Mümkünse sporcunun güncel verisine atıfta bulun.`;

    const chatHistoryContext = `${systemPrompt}\n\n${ctx}\n\nKullanıcı Sorusu: ${userText}\nCevap:`;

    callGeminiAPI(apiKey, chatHistoryContext)
      .then(reply => {
        loader.remove();
        appendChatMessage('bot', reply);
      })
      .catch(err => {
        console.error("Chat Gemini API hatası", err);
        loader.remove();
        appendChatMessage('bot', "Üzgünüm, API anahtarınız ile bağlantı kurulurken bir sorun oluştu. Lütfen profil sayfasından anahtarınızı kontrol edin.");
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
// 10. VERİ YÖNETİMİ (YEDEKLEME / GERİ YÜKLEME / SIFIRLAMA)
// ==========================================

function initDataManagement() {
  const exportBtn = document.getElementById('export-data-btn');
  const importBtn = document.getElementById('import-data-btn');
  const importInput = document.getElementById('import-file-input');
  const resetBtn = document.getElementById('reset-data-btn');

  if (!exportBtn) return; // Profil görünümü yoksa atla

  exportBtn.addEventListener('click', exportData);
  importBtn.addEventListener('click', () => importInput.click());
  importInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) importData(file);
    e.target.value = ''; // aynı dosyanın tekrar seçilebilmesi için sıfırla
  });
  resetBtn.addEventListener('click', resetAllData);
}

// Tüm state'i tarihli bir JSON dosyası olarak indir
function exportData() {
  const dataStr = JSON.stringify(state, null, 2);
  const blob = new Blob([dataStr], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `tritrack-yedek-${formatDate(new Date())}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  showToast("Yedek dosyası indirildi 📤");
}

// Yedek JSON dosyasını oku, doğrula ve geri yükle
function importData(file) {
  const reader = new FileReader();

  reader.onload = (e) => {
    let imported;
    try {
      imported = JSON.parse(e.target.result);
    } catch (err) {
      showToast("Dosya okunamadı. Lütfen geçerli bir TriTrack (.json) yedek dosyası seçin.", 'error');
      return;
    }

    if (!isValidStateShape(imported)) {
      showToast("Geçersiz yedek dosyası. Beklenen TriTrack veri yapısı bulunamadı.", 'error');
      return;
    }

    if (!confirm("Mevcut tüm verileriniz bu yedek dosyasındaki verilerle değiştirilecek. Devam edilsin mi?")) {
      return;
    }

    // Güvenlik: geri yükleme öncesi mevcut veriyi acil yedeğe al
    try {
      localStorage.setItem('tritrack_state_backup', JSON.stringify(state));
    } catch (err) {
      console.warn("Acil yedek alınamadı.", err);
    }

    state = normalizeState(imported);
    saveState();

    showToast("Veriler başarıyla geri yüklendi ✅");
    setTimeout(() => location.reload(), 1000);
  };

  reader.onerror = () => showToast("Dosya okunurken bir hata oluştu.", 'error');
  reader.readAsText(file);
}

// İçe aktarılan nesnenin temel TriTrack şemasına uyup uymadığını kontrol et
function isValidStateShape(obj) {
  return obj && typeof obj === 'object'
    && typeof obj.profile === 'object' && obj.profile !== null
    && Array.isArray(obj.workouts)
    && Array.isArray(obj.diet);
}

// Eksik alanları tamamlayarak güvenli bir state nesnesi döndür (geriye dönük uyumluluk)
function normalizeState(obj) {
  return {
    profile: obj.profile || {},
    holisticLogs: obj.holisticLogs || {},
    plans: Array.isArray(obj.plans) ? obj.plans : [],
    dietPlans: Array.isArray(obj.dietPlans) ? obj.dietPlans : [],
    workouts: Array.isArray(obj.workouts) ? obj.workouts : [],
    diet: Array.isArray(obj.diet) ? obj.diet : []
  };
}

// Tüm verileri çift onayla kalıcı olarak sil
function resetAllData() {
  if (!confirm("TÜM verileriniz (antrenmanlar, diyet, planlar, profil) kalıcı olarak silinecek. Bu işlem geri alınamaz.\n\nDevam etmek istiyor musunuz?")) return;
  if (!confirm("Son uyarı: Önce yedek aldığınızdan emin olun.\n\nSilmek için Tamam'a basın.")) return;

  localStorage.removeItem('tritrack_state');
  localStorage.removeItem('tritrack_state_backup');
  showToast("Tüm veriler silindi. Yeniden başlatılıyor...");
  setTimeout(() => location.reload(), 1200);
}

// ==========================================
// 11. ANTRENMAN İÇE AKTARMA (GPX / TCX DOSYALARI)
// ==========================================

function initWorkoutImport() {
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
function handleWorkoutFiles(files) {
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

function finishImport(added, skipped, failed) {
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
function parseGPX(xmlText) {
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

  // Spor türü tahmini (<type> + isim)
  const typeEl = doc.getElementsByTagName('type')[0];
  const nameEl = doc.getElementsByTagName('name')[0];
  const rawType = (typeEl ? typeEl.textContent : '') + ' ' + (nameEl ? nameEl.textContent : '');

  return {
    sport: guessSport(rawType),
    startTime, duration, distanceM, avgHr,
    name: nameEl ? nameEl.textContent.trim() : ''
  };
}

// TCX dosyasını ayrıştır (yapısal: Lap/TotalTimeSeconds/DistanceMeters)
function parseTCX(xmlText) {
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
function addImportedWorkout(p) {
  const date = formatDate(p.startTime);
  const distKm = p.distanceM / 1000;
  const importKey = `${date}_${p.sport}_${p.duration}_${Math.round(p.distanceM)}`;

  if (state.workouts.some(w => w.importKey === importKey)) return 'skipped';

  const workout = {
    id: 'w_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7),
    date,
    sport: p.sport,
    duration: p.duration,
    rpe: 5,
    importKey,
    notes: `İçe aktarıldı${p.name ? ' · ' + p.name : ''}`
  };

  if (p.sport === 'swim') {
    workout.distance = Math.round(p.distanceM); // yüzmede metre
    workout.pace = computePacePer100m(p.distanceM, p.duration);
  } else if (p.sport === 'bike') {
    workout.distance = Math.round(distKm * 100) / 100;
    workout.pace = computeSpeed(distKm, p.duration);
  } else {
    workout.distance = Math.round(distKm * 100) / 100;
    workout.pace = computePacePerKm(distKm, p.duration);
  }
  if (p.avgHr) workout.hr = p.avgHr;

  state.workouts.push(workout);
  return 'added';
}

// İki GPS noktası arasındaki mesafe (metre)
function haversine(lat1, lon1, lat2, lon2) {
  const R = 6371000;
  const toRad = d => d * Math.PI / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 +
            Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

// Spor türünü metinden tahmin et
function guessSport(text) {
  const t = (text || '').toLowerCase();
  if (/(swim|yüz|yuz|pool|havuz)/.test(t)) return 'swim';
  if (/(bike|cycl|ride|bisiklet|biking)/.test(t)) return 'bike';
  if (/(run|koş|kos|jog|trail|walk|hike|yürü|yuru)/.test(t)) return 'run';
  return 'run'; // varsayılan
}

// Pace / hız yardımcıları (:60 taşmasını da engeller)
function formatPace(paceDecimalMin, unitLabel) {
  let m = Math.floor(paceDecimalMin);
  let s = Math.round((paceDecimalMin - m) * 60);
  if (s === 60) { m += 1; s = 0; }
  return `${m}:${String(s).padStart(2, '0')} ${unitLabel}`;
}
function computePacePerKm(km, durationSec) {
  if (km <= 0 || durationSec <= 0) return '-';
  return formatPace((durationSec / 60) / km, '/km');
}
function computePacePer100m(meters, durationSec) {
  if (meters <= 0 || durationSec <= 0) return '-';
  return formatPace((durationSec / 60) / (meters / 100), '/100m');
}
function computeSpeed(km, durationSec) {
  if (durationSec <= 0) return '-';
  return `${Math.round((km / (durationSec / 3600)) * 100) / 100} km/sa`;
}

// ==========================================
// 12. ANALİZ & İSTATİSTİK GÖRÜNÜMÜ (SAF SVG GRAFİKLER)
// ==========================================

const SPORT_META = {
  run:     { name: 'Koşu',     color: 'var(--color-kosu)' },
  bike:    { name: 'Bisiklet', color: 'var(--color-bisiklet)' },
  swim:    { name: 'Yüzme',    color: 'var(--color-yuzme)' },
  fitness: { name: 'Güç',      color: 'var(--color-fitness)' }
};
const SPORT_ORDER = ['run', 'bike', 'swim', 'fitness'];

// Verilen tarihin haftasının Pazartesi'sini döndür (YYYY-MM-DD)
function mondayOf(dateStr) {
  const d = new Date(dateStr);
  const day = d.getDay(); // 0=Pazar
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return formatDate(d);
}

function addDaysStr(dateStr, n) {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + n);
  return formatDate(d);
}

function renderAnalysisView() {
  renderAnalysisSummary();
  renderWeeklyLoadChart();
  renderSportDistChart();
  renderSleepChart();
  renderHrvChart();
}

// Son N günün holistic loglarını {label, value} dizisine çevir
function collectDailySeries(field, days) {
  const out = [];
  for (let i = days - 1; i >= 0; i--) {
    const ds = addDaysStr(currentDateStr, -i);
    const d = new Date(ds);
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
function buildLineChartSVG(series, opts) {
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
function renderSleepChart() {
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
function renderHrvChart() {
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

// --- Glanceable başlık yardımcıları ---
function glanceTop(valueHTML, unit, sub, trend) {
  const t = trend ? `<span class="glance-trend ${trend.tone}">${trend.text}</span>` : '';
  return `<div class="glance-header">
    <div>
      <span class="glance-value">${valueHTML}</span>${unit ? `<span class="glance-unit">${unit}</span>` : ''}
      <div class="glance-sub">${sub}</div>
    </div>${t}
  </div>`;
}
function glanceInsight(text) {
  return `<div class="glance-insight">${text}</div>`;
}
function setGlance(prefix, topHTML, insightText) {
  const top = document.getElementById(`glance-${prefix}-top`);
  const ins = document.getElementById(`glance-${prefix}-insight`);
  if (top) top.innerHTML = topHTML;
  if (ins) ins.innerHTML = glanceInsight(insightText);
}
// goodUp: true=artış iyi, false=artış kötü, null=nötr (gri renk)
function makeTrend(curr, prev, goodUp, fmt) {
  if (prev == null || curr == null || (prev === 0 && curr === 0)) return null;
  const diff = curr - prev;
  if (Math.abs(diff) < 0.05) return { text: '→ sabit', tone: 'flat' };
  const arrow = diff > 0 ? '▲' : '▼';
  let tone = 'flat';
  if (goodUp !== null) tone = ((diff > 0) === goodUp) ? 'up' : 'down';
  return { text: `${arrow} ${fmt(Math.abs(diff))}`, tone };
}
// holistic alanından gün aralığındaki değerler (offset 0 = currentDate)
function holisticValues(field, fromOffset, toOffset) {
  const arr = [];
  for (let i = fromOffset; i <= toOffset; i++) {
    const log = state.holisticLogs[addDaysStr(currentDateStr, -i)] || {};
    if (typeof log[field] === 'number') arr.push(log[field]);
  }
  return arr;
}
function avgOf(arr) { return arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : null; }
function fmtMinutes(min) {
  const h = Math.floor(min / 60), m = Math.round(min % 60);
  return h > 0 ? `${h}s ${m}dk` : `${m}dk`;
}

// --- Bu Hafta Özet Kartları ---
function renderAnalysisSummary() {
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
function renderWeeklyLoadChart() {
  const container = document.getElementById('chart-weekly-load');
  const legendEl = document.getElementById('chart-weekly-load-legend');
  const WEEKS = 8;
  const thisMonday = mondayOf(currentDateStr);

  const weeks = [];
  const startIndex = {};
  for (let i = WEEKS - 1; i >= 0; i--) {
    const start = addDaysStr(thisMonday, -i * 7);
    const d = new Date(start);
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
function renderSportDistChart() {
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

// ==========================================
// 13. ONBOARDING SİHİRBAZI (İLK AÇILIŞ KURULUMU)
// ==========================================

let obStep = 1;
let obActivityFactor = null;

// Mifflin-St Jeor BMR × aktivite faktörü ile kalori + sporcu makroları
function computeNutritionTargets({ weight, height, age, gender, activityFactor }) {
  const bmr = 10 * weight + 6.25 * height - 5 * age + (gender === 'male' ? 5 : -161);
  const calories = Math.round((bmr * activityFactor) / 10) * 10;
  const protein = Math.round(1.8 * weight);           // dayanıklılık sporcusu: ~1.8 g/kg
  const fat = Math.round((calories * 0.25) / 9);      // kalorinin ~%25'i yağdan
  const carbs = Math.max(0, Math.round((calories - protein * 4 - fat * 9) / 4));
  return { calories, protein, carbs, fat };
}

function initOnboarding() {
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

function showOnboarding() {
  obStep = 1;
  obRenderStep();
  document.getElementById('onboarding-overlay').classList.add('open');
}

function obRenderStep() {
  const overlay = document.getElementById('onboarding-overlay');
  overlay.querySelectorAll('.ob-step').forEach(s => { s.hidden = (parseInt(s.dataset.step) !== obStep); });
  overlay.querySelectorAll('.ob-dot').forEach(d => d.classList.toggle('active', parseInt(d.dataset.step) <= obStep));
  document.getElementById('ob-back').style.display = (obStep === 1) ? 'none' : 'block';
  document.getElementById('ob-next').innerText = (obStep === 4) ? '🚀 Başla' : 'İleri';
}

function obValidateStep() {
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

function obNext() {
  if (!obValidateStep()) return;
  if (obStep === 3) obFillSummary(); // 4. adıma geçmeden önce hesapla
  if (obStep === 4) { obFinish(); return; }
  obStep++;
  obRenderStep();
}

function obBack() {
  if (obStep > 1) { obStep--; obRenderStep(); }
}

function obFillSummary() {
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

function obFinish() {
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
    geminiApiKey: ""
  };

  needsOnboarding = false;
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

// ==========================================
// 14. YARDIMCI FONKSİYONLAR & PWA ARAÇLARI
// ==========================================

function showToast(message, type) {
  const existing = document.querySelector('.toast-notification');
  if (existing) existing.remove();

  const toast = document.createElement('div');
  toast.className = 'toast-notification' + (type === 'error' ? ' toast-error' : '');
  toast.innerText = message;
  document.body.appendChild(toast);

  setTimeout(() => {
    toast.classList.add('show');
  }, 10);

  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js')
      .then(reg => console.log('Service Worker başarıyla kaydedildi. Kapsam:', reg.scope))
      .catch(err => console.log('Service Worker kaydı başarısız:', err));
  }
}
