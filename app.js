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

// Verileri LocalStorage'a Kaydet (+ girişliyse buluta debounced push)
function saveState(localOnly) {
  state.updatedAt = Date.now();
  localStorage.setItem('tritrack_state', JSON.stringify(state));
  if (!localOnly) scheduleCloudPush();
}

// ==========================================
// 1.A KULLANICI HESABI & BULUT SENKRON (SUPABASE)
// ==========================================
// Doldurmak için: SUPABASE-KURULUM.md. Boş bırakılırsa uygulama tamamen yereldir (hesap ekranı çıkmaz).
const SUPABASE_URL = '';
const SUPABASE_ANON_KEY = '';

let sbClient = null;       // supabase client (auth açıksa)
let currentUser = null;    // girişli kullanıcı
let cloudPushTimer = null; // debounced push zamanlayıcı
let authMode = 'login';    // 'login' | 'signup'

function authEnabled() {
  return !!(SUPABASE_URL && SUPABASE_ANON_KEY && typeof supabase !== 'undefined');
}

// State'te anlamlı kullanıcı verisi var mı? (misafir→hesap taşıma kararı için)
function hasUserData(s) {
  return !!(s && ((s.workouts && s.workouts.length) || (s.diet && s.diet.length) ||
    (s.plans && s.plans.length) || (s.dietPlans && s.dietPlans.length) ||
    (s.holisticLogs && Object.keys(s.holisticLogs).length) || (s.profile && s.profile.name)));
}

// Buluta gönderilecek kopya — cihaza özel sırlar (Gemini anahtarı, Strava token) hariç
function cloudPayload(s) {
  const copy = JSON.parse(JSON.stringify(s));
  if (copy.profile) { delete copy.profile.geminiApiKey; delete copy.profile.strava; delete copy.profile.stravaProxy; }
  return copy;
}

function scheduleCloudPush() {
  if (!currentUser || !sbClient) return;
  clearTimeout(cloudPushTimer);
  cloudPushTimer = setTimeout(pushCloud, 1500);
}

async function pushCloud() {
  if (!currentUser || !sbClient) return;
  try {
    await sbClient.from('user_data').upsert({
      user_id: currentUser.id,
      data: cloudPayload(state),
      updated_at: new Date().toISOString()
    });
  } catch (e) { console.warn('Bulut push hatası', e); }
}

async function initAuth() {
  if (!authEnabled()) return; // saf yerel mod (eski davranış)
  sbClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

  initAuthUI();

  const { data: { session } } = await sbClient.auth.getSession();
  if (session && session.user) {
    await handleSignedIn(session.user);
  } else if (localStorage.getItem('tritrack_guest')) {
    hideAuthOverlay();
    if (needsOnboarding) showOnboarding();
  } else {
    showAuthOverlay();
  }

  sbClient.auth.onAuthStateChange((event, session) => {
    if (event === 'SIGNED_IN' && session && session.user && !currentUser) {
      handleSignedIn(session.user);
    } else if (event === 'SIGNED_OUT') {
      currentUser = null;
    }
  });
}

async function handleSignedIn(user) {
  currentUser = user;
  localStorage.removeItem('tritrack_guest');
  hideAuthOverlay();
  renderAccountCard();
  await pullCloud();
}

// Buluttan kullanıcının verisini çek → yereli güncelle (cihaz sırlarını koru)
async function pullCloud() {
  if (!currentUser || !sbClient) return;
  let row = null;
  try {
    const { data, error } = await sbClient
      .from('user_data').select('data, updated_at').eq('user_id', currentUser.id).maybeSingle();
    if (error) throw error;
    row = data;
  } catch (e) { console.warn('Bulut pull hatası', e); showToast('Bulut verisi alınamadı, yerel kullanılıyor.', 'error'); return; }

  // Cihaza özel sırları sakla (buluta gitmiyor, pull'da kaybolmasın)
  const localSecrets = {
    geminiApiKey: state.profile && state.profile.geminiApiKey,
    strava: state.profile && state.profile.strava,
    stravaProxy: state.profile && state.profile.stravaProxy
  };

  if (!row) {
    // Bu hesabın bulut verisi yok
    if (hasUserData(state)) {
      // Misafirken veri girilmiş → hesaba taşımayı öner
      if (await showConfirm('Bu cihazdaki verileri yeni hesabına yükleyeyim mi?', { title: 'Verileri yükle' })) {
        await pushCloud();
        showToast('Verilerin hesabına yüklendi ✅');
        return;
      }
    }
    // Sıfırdan: boş state + onboarding, sonra bulut satırı oluştur
    initEmptyState();
    saveState(true);
    showOnboarding();
    await pushCloud();
    return;
  }

  // Bulut satırı var → doğruluk kaynağı bulut (giriş anında)
  state = normalizeState(row.data || {});
  if (state.profile) {
    if (localSecrets.geminiApiKey) state.profile.geminiApiKey = localSecrets.geminiApiKey;
    if (localSecrets.strava) state.profile.strava = localSecrets.strava;
    if (localSecrets.stravaProxy) state.profile.stravaProxy = localSecrets.stravaProxy;
  }
  needsOnboarding = false;
  saveState(true);
  rerenderAfterSync();
  showToast('Veriler buluttan yüklendi ✅');
}

function rerenderAfterSync() {
  try {
    if (typeof renderTodayView === 'function') renderTodayView();
    const active = document.querySelector('.bottom-nav-item.active');
    if (active && typeof refreshActiveView === 'function') refreshActiveView(active.getAttribute('data-view'));
    if (typeof renderAccountCard === 'function') renderAccountCard();
  } catch (e) { console.warn('Yeniden render hatası', e); }
}

// --- Auth ekranı UI ---
function initAuthUI() {
  const form = document.getElementById('auth-form');
  if (!form) return;
  const toggle = document.getElementById('auth-toggle');
  const guestBtn = document.getElementById('auth-guest-btn');

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const email = document.getElementById('auth-email').value.trim();
    const pwd = document.getElementById('auth-password').value;
    if (authMode === 'login') signIn(email, pwd); else signUp(email, pwd);
  });
  if (toggle) toggle.addEventListener('click', () => setAuthMode(authMode === 'login' ? 'signup' : 'login'));
  if (guestBtn) guestBtn.addEventListener('click', continueAsGuest);
  setAuthMode('login');
}

function setAuthMode(mode) {
  authMode = mode;
  const title = document.getElementById('auth-title');
  const submit = document.getElementById('auth-submit');
  const toggle = document.getElementById('auth-toggle');
  if (title) title.textContent = mode === 'login' ? 'Giriş Yap' : 'Kayıt Ol';
  if (submit) submit.textContent = mode === 'login' ? 'Giriş Yap' : 'Kayıt Ol';
  if (toggle) toggle.textContent = mode === 'login' ? 'Hesabın yok mu? Kayıt ol' : 'Zaten hesabın var mı? Giriş yap';
  setAuthError('');
}

function setAuthError(msg) {
  const el = document.getElementById('auth-error');
  if (el) el.textContent = msg || '';
}

function setAuthBusy(busy) {
  const submit = document.getElementById('auth-submit');
  if (submit) { submit.disabled = busy; submit.style.opacity = busy ? '0.6' : '1'; }
}

function showAuthOverlay() { const o = document.getElementById('auth-overlay'); if (o) o.classList.add('open'); }
function hideAuthOverlay() { const o = document.getElementById('auth-overlay'); if (o) o.classList.remove('open'); }

async function signIn(email, pwd) {
  if (!email || !pwd) { setAuthError('E-posta ve parola gir.'); return; }
  setAuthBusy(true); setAuthError('');
  try {
    const { error } = await sbClient.auth.signInWithPassword({ email, password: pwd });
    if (error) throw error;
    // onAuthStateChange / getSession handleSignedIn'i tetikler
  } catch (e) {
    setAuthError(authErrorTr(e));
  } finally { setAuthBusy(false); }
}

async function signUp(email, pwd) {
  if (!email || pwd.length < 6) { setAuthError('Parola en az 6 karakter olmalı.'); return; }
  setAuthBusy(true); setAuthError('');
  try {
    const { data, error } = await sbClient.auth.signUp({ email, password: pwd });
    if (error) throw error;
    if (data.session && data.user) {
      await handleSignedIn(data.user);
    } else {
      // E-posta doğrulaması açık
      setAuthError('Kayıt alındı. Lütfen e-postandaki doğrulama linkine tıkla, sonra giriş yap.');
      setAuthMode('login');
    }
  } catch (e) {
    setAuthError(authErrorTr(e));
  } finally { setAuthBusy(false); }
}

async function signOut() {
  if (!sbClient) return;
  if (!(await showConfirm('Çıkış yapılsın mı? Bu cihazdaki yerel kopya temizlenecek (verilerin bulutta güvende).', { title: 'Çıkış', okText: 'Çıkış Yap', danger: true }))) return;
  try { await sbClient.auth.signOut(); } catch (e) { console.warn(e); }
  currentUser = null;
  localStorage.removeItem('tritrack_state');
  localStorage.removeItem('tritrack_guest');
  location.reload();
}

function continueAsGuest() {
  localStorage.setItem('tritrack_guest', '1');
  hideAuthOverlay();
  if (needsOnboarding) showOnboarding();
}

function authErrorTr(e) {
  const m = (e && e.message) ? e.message.toLowerCase() : '';
  if (m.includes('invalid login')) return 'E-posta veya parola hatalı.';
  if (m.includes('already registered') || m.includes('already been registered')) return 'Bu e-posta zaten kayıtlı. Giriş yapmayı dene.';
  if (m.includes('password')) return 'Parola en az 6 karakter olmalı.';
  if (m.includes('email')) return 'Geçerli bir e-posta gir.';
  if (m.includes('network') || m.includes('fetch')) return 'Bağlantı hatası. İnterneti kontrol et.';
  return 'İşlem başarısız: ' + (e && e.message ? e.message : 'bilinmeyen hata');
}

// Profil'deki hesap kartını güncelle
function renderAccountCard() {
  const card = document.getElementById('account-card');
  if (!card) return;
  if (!authEnabled()) { card.style.display = 'none'; return; }
  card.style.display = '';
  const emailEl = document.getElementById('account-email');
  const signoutBtn = document.getElementById('account-signout-btn');
  if (currentUser) {
    if (emailEl) emailEl.textContent = currentUser.email || 'Girişli';
    if (signoutBtn) { signoutBtn.style.display = ''; signoutBtn.onclick = signOut; }
  } else {
    if (emailEl) emailEl.textContent = 'Misafir (yerel mod)';
    if (signoutBtn) signoutBtn.style.display = 'none';
  }
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
  initStravaSync();
  initOnboarding();
  registerServiceWorker();

  // Auth açıksa onboarding/erişimi initAuth yönetir; değilse eski yerel davranış.
  if (authEnabled()) {
    renderAccountCard();
    initAuth();
  } else if (needsOnboarding) {
    showOnboarding();
  }
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

  const waterAdd = document.getElementById('water-add-btn');
  if (waterAdd) waterAdd.addEventListener('click', () => changeWater(250));
  const waterReset = document.getElementById('water-reset-btn');
  if (waterReset) waterReset.addEventListener('click', () => changeWater(null));

  renderTodayView();
}

// Su miktarını güncelle (deltaMl=null → sıfırla)
function changeWater(deltaMl) {
  if (!state.holisticLogs[currentDateStr]) state.holisticLogs[currentDateStr] = {};
  const cur = state.holisticLogs[currentDateStr].water || 0;
  state.holisticLogs[currentDateStr].water = (deltaMl == null) ? 0 : Math.max(0, cur + deltaMl);
  saveState();
  renderWaterCard();
}

// Bugünün su kartını çiz (bardak = 250 ml)
function renderWaterCard() {
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
function renderFuelingTip() {
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
function renderRaceCard() {
  const card = document.getElementById('race-card');
  if (!card) return;
  const date = state.profile.raceDate;
  if (!date) { card.classList.add('hidden'); return; }
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const race = new Date(date); race.setHours(0, 0, 0, 0);
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
function renderStreakRecap() {
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
  renderWaterCard();
  renderFuelingTip();
  renderRaceCard();
  renderStreakRecap();

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
  refreshDietUI();
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

    const saveTpl = document.getElementById('plan-save-template');
    if (saveTpl && saveTpl.checked) {
      saveWorkoutTemplate({ sport, targetDistance, targetDuration, details });
      saveTpl.checked = false;
    }
    saveState();

    modal.classList.remove('open');
    form.reset();
    showToast("Antrenman plana başarıyla eklendi!");

    renderProgramView();
    renderTodayView();
  });

  const calPrev = document.getElementById('cal-prev');
  const calNext = document.getElementById('cal-next');
  if (calPrev) calPrev.addEventListener('click', () => { shiftCalendarMonth(-1); });
  if (calNext) calNext.addEventListener('click', () => { shiftCalendarMonth(1); });

  initBulkPlanModal();
  renderProgramView();
}

function openPlanModal(defaultDate) {
  const modal = document.getElementById('modal-plan');
  document.getElementById('plan-date').value = defaultDate;
  const saveTpl = document.getElementById('plan-save-template');
  if (saveTpl) saveTpl.checked = false;
  renderPlanTemplates();
  updatePlanDistanceLabel();
  modal.classList.add('open');
}

// --- Antrenman şablonları ---
function saveWorkoutTemplate(t) {
  if (!state.templates) state.templates = [];
  const name = (t.details || '').trim().slice(0, 40) ||
    `${(SPORT_META[t.sport] || {}).name || t.sport}${t.targetDistance ? ' ' + t.targetDistance : ''}`;
  const existing = state.templates.find(x => x.name === name);
  if (existing) Object.assign(existing, t, { name });
  else state.templates.push({ id: 'tpl_' + Date.now(), name, sport: t.sport, targetDistance: t.targetDistance, targetDuration: t.targetDuration, details: t.details });
  showToast('Şablon kaydedildi ⭐');
}

function renderPlanTemplates() {
  const box = document.getElementById('plan-templates');
  if (!box) return;
  const tpls = state.templates || [];
  if (tpls.length === 0) { box.innerHTML = ''; return; }
  const icons = { run: '🏃', bike: '🚴', swim: '🏊', fitness: '🏋️' };
  box.innerHTML = `<div class="text-xs text-muted" style="margin-bottom:6px;">⭐ Şablonlarım (dokun → formu doldur)</div>` +
    tpls.map(t => `<button type="button" class="tpl-chip" data-id="${t.id}">${icons[t.sport] || ''} ${escapeHtml(t.name)} <span class="tpl-del" data-del="${t.id}">×</span></button>`).join('');
  box.querySelectorAll('.tpl-chip').forEach(chip => {
    chip.addEventListener('click', (e) => {
      const del = e.target.closest('.tpl-del');
      if (del) { state.templates = (state.templates || []).filter(x => x.id !== del.getAttribute('data-del')); saveState(); renderPlanTemplates(); return; }
      const t = (state.templates || []).find(x => x.id === chip.getAttribute('data-id'));
      if (!t) return;
      document.getElementById('plan-sport').value = t.sport;
      updatePlanDistanceLabel();
      document.getElementById('plan-target-distance').value = t.targetDistance || '';
      document.getElementById('plan-target-duration').value = t.targetDuration || '';
      document.getElementById('plan-details').value = t.details || '';
    });
  });
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

// --- Ay Takvimi ---
let calendarAnchor = formatDate(new Date());

function shiftCalendarMonth(delta) {
  const d = new Date(calendarAnchor);
  d.setDate(1);
  d.setMonth(d.getMonth() + delta);
  calendarAnchor = formatDate(d);
  renderCalendar();
}

function renderCalendar() {
  const grid = document.getElementById('calendar-grid');
  const title = document.getElementById('cal-title');
  if (!grid || !title) return;
  const d = new Date(calendarAnchor);
  const year = d.getFullYear(), month = d.getMonth();
  title.textContent = d.toLocaleDateString('tr-TR', { month: 'long', year: 'numeric' });
  const startW = (new Date(year, month, 1).getDay() + 6) % 7; // Pazartesi = 0
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const todayStr = formatDate(new Date());

  let html = '';
  for (let i = 0; i < startW; i++) html += `<div class="cal-cell cal-empty"></div>`;
  for (let day = 1; day <= daysInMonth; day++) {
    const ds = formatDate(new Date(year, month, day));
    const works = state.workouts.filter(w => w.date === ds);
    const plans = state.plans.filter(p => p.date === ds && !p.completed);
    const items = [
      ...works.map(w => ({ c: (SPORT_META[w.sport] || {}).color, done: true })),
      ...plans.map(p => ({ c: (SPORT_META[p.sport] || {}).color, done: false }))
    ].slice(0, 4);
    const dots = items.map(it => `<span class="cal-dot" style="background:${it.c || 'var(--text-muted)'}; opacity:${it.done ? 1 : 0.4};"></span>`).join('');
    html += `<div class="cal-cell${ds === todayStr ? ' is-today' : ''}" data-date="${ds}"><span class="cal-day">${day}</span><div class="cal-dots">${dots}</div></div>`;
  }
  grid.innerHTML = html;
  grid.querySelectorAll('.cal-cell[data-date]').forEach(cell => {
    cell.addEventListener('click', () => openPlanModal(cell.getAttribute('data-date')));
  });
}

function renderProgramView() {
  renderCalendar();
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

        planEl.querySelector('.delete-plan-btn').addEventListener('click', async (e) => {
          e.stopPropagation();
          if (await showConfirm("Bu planı silmek istiyor musunuz?", { title: 'Planı sil', okText: 'Sil', danger: true })) {
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

// Besin ekleme modalının bağlamı: 'track' (günlük tüketim) | 'plan' (haftalık plan)
let dietModalMode = 'track';

// Haftalık Plan görünümünde gösterilen haftanın bir günü (◀ ▶ ile gezinir)
let dietWeekAnchor = currentDateStr;

// Öğün meta bilgisi (ikon + Türkçe ad) — tek kaynak, tekrarı önler
const MEAL_META = {
  breakfast: { icon: '🍳', name: 'Kahvaltı' },
  lunch: { icon: '🍗', name: 'Öğle' },
  dinner: { icon: '🥗', name: 'Akşam' },
  snack: { icon: '🍌', name: 'Atıştırmalık' }
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
      openDietModal(mealSection.getAttribute('data-meal'), currentDateStr, 'track');
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
function openDietModal(meal, targetDate, mode) {
  const modal = document.getElementById('modal-diet-add');
  activeMealSelector = meal;
  dietTargetDate = targetDate || currentDateStr;
  // 'plan' = haftalık plana ekleme (yalnız "Plana Ekle"); 'track' = günlük (her ikisi)
  dietModalMode = mode || 'track';
  applyDietModalMode(dietModalMode);

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

// Modal butonlarını bağlama göre ayarla: plan modunda yalnız "Plana Ekle" görünür
function applyDietModalMode(mode) {
  const isPlan = mode === 'plan';
  const eat = document.getElementById('add-selected-food-btn');     // Tüketilen Ekle (seçim paneli)
  const plan = document.getElementById('plan-selected-food-btn');   // Plana Ekle (seçim paneli)
  const mEat = document.getElementById('btn-manual-eat');           // Tüketilen Ekle (manuel form)
  const mPlan = document.getElementById('btn-manual-plan');         // Plana Ekle (manuel form)

  if (eat) eat.style.display = isPlan ? 'none' : '';
  if (mEat) mEat.style.display = isPlan ? 'none' : '';
  // Tek buton kalınca tam genişlik kapla
  if (plan) plan.style.gridColumn = isPlan ? '1 / -1' : '';
  if (mPlan) mPlan.style.gridColumn = isPlan ? '1 / -1' : '';
  if (plan) plan.textContent = isPlan ? '🗓️ Plana Ekle' : 'Plana Ekle';
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

  refreshDietUI();
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

  refreshDietUI();
}

// Diyet UI'ını tamamen yenile (Günlük, Haftalık ve Dashboard görünümleri)
function refreshDietUI() {
  // Her görünüm bağımsız sarmalandı: biri hata verse bile diğerleri (özellikle haftalık) güncellenir
  try { renderDietView(); } catch (e) { console.error('renderDietView hatası:', e); }
  try { renderWeeklyDietView(); } catch (e) { console.error('renderWeeklyDietView hatası:', e); }
  try { renderTodayView(); } catch (e) { console.error('renderTodayView hatası:', e); }
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
          planItem.querySelector('.delete-plan-food-btn').addEventListener('click', async () => {
            if (await showConfirm("Bu planlanan diyeti silmek istiyor musunuz?", { title: 'Diyet planını sil', okText: 'Sil', danger: true })) {
              state.dietPlans = state.dietPlans.filter(p => p.id !== plan.id);
              // Tüketilenlerden de kaldır (eğer checked ise)
              state.diet = state.diet.filter(f => f.id !== 'fd_sync_' + plan.id);
              saveState();
              refreshDietUI();
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
            refreshDietUI();
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
        openDietModal(btn.getAttribute('data-meal'), btn.getAttribute('data-date'), 'plan'));
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
  refreshDietUI();
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
  refreshDietUI();
  showToast(`${items.length} öğün ${shortDateLabel(toDate)} gününe kopyalandı.`);
}

// Bir günün planını aynı haftanın diğer günlerine uygula (önce o günleri temizler)
async function applyDayToWeek(fromDate) {
  const source = state.dietPlans.filter(p => p.date === fromDate);
  if (source.length === 0) {
    showToast("Önce bu güne öğün ekle.");
    return;
  }
  if (!(await showConfirm("Bu günün planı haftanın diğer 6 gününe kopyalanacak.\nO günlerdeki mevcut planlar silinecek. Devam edilsin mi?", { title: 'Tüm haftaya uygula', okText: 'Uygula' }))) return;

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
  refreshDietUI();
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
  document.getElementById('settings-gemini-key').value = state.profile.geminiApiKey || '';

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
    state.profile.geminiApiKey = document.getElementById('settings-gemini-key').value;

    saveState();
    showToast("Profil ayarları kaydedildi.");
    updateAiBadge();
    renderTodayView();
  });

  const estBtn = document.getElementById('estimate-thresholds-btn');
  if (estBtn) estBtn.addEventListener('click', applyEstimatedThresholds);

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

// Sporcunun kendi antrenman geçmişinden eşik değerlerini tahmin et
function estimateThresholds() {
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
function applyEstimatedThresholds() {
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

// Güncel Gemini modeli (gerekirse buradan değiştir). 2026-06: 2.0 modelleri kapatıldı → 3.5-flash.
const GEMINI_MODEL = 'gemini-3.5-flash';

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
    // Strava sözleşmesi: Strava kaynaklı ham antrenman detayları 3. taraf AI'ya gönderilmez.
    // (Haftalık yük gibi kaba toplamlar gider; ayrıntılı liste yalnız kullanıcının girdiği antrenmanlar.)
    recent: state.workouts.filter(w => w.source !== 'strava').slice().sort((a, b) => (a.date < b.date ? 1 : -1)).slice(0, 6),
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
    // Araç (function calling) destekli agent: okuma + (onaylı) yazma
    runAssistantAgent(apiKey, userText, loader)
      .then(reply => {
        loader.remove();
        if (reply) appendChatMessage('bot', reply);
      })
      .catch(err => {
        console.error("Asistan hatası", err);
        loader.remove();
        appendChatMessage('bot', "Üzgünüm, bağlantıda sorun oldu: " + err.message + ". Profil'den API anahtarını kontrol et.");
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
function aiAddWorkout(a) {
  const date = a.date || currentDateStr;
  const durationSec = a.durationMin ? Math.round(a.durationMin * 60) : 0;
  const w = {
    id: 'w_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
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

function aiAddPlan(a) {
  const plan = {
    id: 'p_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
    date: a.date || currentDateStr, sport: a.sport,
    targetDistance: (a.targetDistance != null) ? a.targetDistance : null,
    targetDuration: (a.targetDurationMin != null) ? a.targetDurationMin : null,
    details: a.details || '', completed: false
  };
  state.plans.push(plan);
  saveState(); renderProgramView(); renderTodayView();
  return { ok: true, message: `${(SPORT_META[a.sport] || {}).name || a.sport} planı ${plan.date} tarihine eklendi.` };
}

function aiSetBody(a) {
  const date = a.date || currentDateStr;
  const log = state.holisticLogs[date] || (state.holisticLogs[date] = {});
  if (a.sleep != null) log.sleep = a.sleep;
  if (a.sleepScore != null) log.sleepScore = a.sleepScore;
  if (a.hrv != null) log.hrv = a.hrv;
  if (a.weight != null) { log.weight = a.weight; state.profile.weight = a.weight; }
  saveState(); renderTodayView();
  return { ok: true, message: `${date} vücut durumu kaydedildi.` };
}

function aiAddFood(a) {
  const food = {
    id: 'fd_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
    date: a.date || currentDateStr, meal: a.meal || 'snack', name: a.name || 'Besin',
    calories: a.calories || 0, protein: a.protein || 0, carbs: a.carbs || 0, fat: a.fat || 0,
    quantity: 1, unit: 'piece'
  };
  state.diet.push(food);
  saveState(); refreshDietUI();
  return { ok: true, message: `"${food.name}" tüketilenlere eklendi.` };
}

function aiUpdateGoals(a) {
  if (a.calories != null) state.profile.targetDailyCalories = a.calories;
  if (!state.profile.targetMacros) state.profile.targetMacros = {};
  if (a.protein != null) state.profile.targetMacros.protein = a.protein;
  if (a.carbs != null) state.profile.targetMacros.carbs = a.carbs;
  if (a.fat != null) state.profile.targetMacros.fat = a.fat;
  saveState(); renderTodayView();
  return { ok: true, message: 'Hedefler güncellendi.' };
}

// --- Okuma çalıştırıcısı (onay gerektirmez) ---
function aiGetDay(a) {
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
const AI_TOOLS = [
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

function assistantSystemPrompt() {
  const d = gatherCoachData();
  const p = state.profile;
  return `Sen ${p.name || 'sporcu'} için triatlon ve koşu antrenörü/asistanısın. Türkçe, kısa ve net konuş.
Bugünün tarihi: ${currentDateStr}.
Kullanıcı bir şey eklemeni/kaydetmeni isterse uygun ARACI çağır (antrenmanEkle, antrenmanPlaniEkle, vucutDurumuKaydet, besinEkle, hedefGuncelle). Geçmiş veri lazımsa gunVerisiniGetir aracını kullan.
Kurallar: Tarih verilmezse bugünü kullan. Yüzme mesafesi METRE, koşu/bisiklet KM. Emin değilsen kullanıcıya sor; uydurma.
Güncel durum: bugün uyku ${d.body.sleep != null ? d.body.sleep : '-'}/puan ${d.body.sleepScore != null ? d.body.sleepScore : '-'}, HRV ${d.body.hrv != null ? d.body.hrv : '-'}; bu hafta yük ${d.load.thisWeek}dk; hazır olma ${d.readiness ? d.readiness.label : '-'}.
Sadece spor, antrenman, beslenme, uyku ve toparlanma konularında yardım et.`;
}

async function geminiGenerate(apiKey, contents, systemText, tools) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`;
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
function aiConfirmAction(summaryText) {
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

// Agent döngüsü: model → (araç çağrısı → onay/çalıştır → sonuç) → final metin
async function runAssistantAgent(apiKey, userText, loader) {
  const sys = assistantSystemPrompt();
  const tools = [{ functionDeclarations: AI_TOOLS.map(t => t.declaration) }];
  const contents = [{ role: 'user', parts: [{ text: userText }] }];

  for (let step = 0; step < 6; step++) {
    if (loader && !loader.isConnected) {
      document.getElementById('ai-chat-output').appendChild(loader);
    }
    const cand = await geminiGenerate(apiKey, contents, sys, tools);
    const parts = (cand.content && cand.content.parts) || [];
    const fcPart = parts.find(p => p.functionCall);

    if (!fcPart) {
      const text = parts.map(p => p.text).filter(Boolean).join('\n').trim();
      return text || 'Tamam.';
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

  reader.onload = async (e) => {
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

    if (!(await showConfirm("Mevcut tüm verileriniz bu yedek dosyasındaki verilerle değiştirilecek. Devam edilsin mi?", { title: 'Veriyi geri yükle', okText: 'Geri Yükle', danger: true }))) {
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
    diet: Array.isArray(obj.diet) ? obj.diet : [],
    templates: Array.isArray(obj.templates) ? obj.templates : []
  };
}

// Tüm verileri çift onayla kalıcı olarak sil
async function resetAllData() {
  if (!(await showConfirm("TÜM verileriniz (antrenmanlar, diyet, planlar, profil) kalıcı olarak silinecek. Bu işlem geri alınamaz.\n\nDevam etmek istiyor musunuz?", { title: 'Tüm verileri sıfırla', okText: 'Devam', danger: true }))) return;
  if (!(await showConfirm("Son uyarı: Önce yedek aldığınızdan emin olun.\n\nSilmek için onayla.", { title: 'Son uyarı', okText: 'Sil', danger: true }))) return;

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

  // Tekrar-ekleme önleme: Strava ise kalıcı id ile, değilse importKey ile
  if (p.stravaId && state.workouts.some(w => w.stravaId === p.stravaId)) return 'skipped';
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
// 11.B STRAVA CANLI SENKRONU (kişisel — Cloudflare Worker proxy üzerinden)
// ==========================================

// Yayınlanan Worker URL'si. Boşsa Profil'deki alandan girilebilir (state.profile.stravaProxy).
const STRAVA_PROXY_URL = 'https://tritrack-strava-proxy.ahmettaha.workers.dev';

function stravaProxyUrl() {
  let url = (state.profile.stravaProxy || STRAVA_PROXY_URL || '').trim().replace(/\/$/, '');
  if (url && !/^https?:\/\//i.test(url)) {
    url = 'https://' + url;
  }
  return url;
}

function initStravaSync() {
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

function connectStrava() {
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
function handleStravaRedirect() {
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

async function syncStrava() {
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
function mapStravaActivity(act) {
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

function renderStravaStatus() {
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

// ==========================================
// 12. ANALİZ & İSTATİSTİK GÖRÜNÜMÜ (SAF SVG GRAFİKLER)
// ==========================================

const SPORT_META = {
  run: { name: 'Koşu', color: 'var(--color-kosu)' },
  bike: { name: 'Bisiklet', color: 'var(--color-bisiklet)' },
  swim: { name: 'Yüzme', color: 'var(--color-yuzme)' },
  fitness: { name: 'Güç', color: 'var(--color-fitness)' }
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
  renderLoadBalanceChart();   // Faz C: Form & Yük (CTL/ATL/TSB)
  renderPersonalRecords();    // Faz B: Kişisel Rekorlar
  renderHrZones();            // Faz D: Nabız Bölgeleri
  renderWeightChart();        // Faz A: Kilo Trendi
  renderCalorieChart();       // Faz A: Kalori Trendi
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

// ============ FAZ A: KİLO & KALORİ TREND GRAFİKLERİ ============

// --- Kilo Trendi (son 30 gün çizgi) ---
function renderWeightChart() {
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
function collectCalorieSeries(days) {
  const out = [];
  for (let i = days - 1; i >= 0; i--) {
    const ds = addDaysStr(currentDateStr, -i);
    const d = new Date(ds);
    const total = state.diet
      .filter(f => f.date === ds)
      .reduce((s, f) => s + (f.calories || 0), 0);
    out.push({ label: `${d.getDate()}`, value: total > 0 ? Math.round(total) : null });
  }
  return out;
}

// Bir gün aralığındaki günlük kalori toplamları (offset 0 = currentDate)
function calorieValues(fromOffset, toOffset) {
  const arr = [];
  for (let i = fromOffset; i <= toOffset; i++) {
    const ds = addDaysStr(currentDateStr, -i);
    const total = state.diet.filter(f => f.date === ds).reduce((s, f) => s + (f.calories || 0), 0);
    if (total > 0) arr.push(Math.round(total));
  }
  return arr;
}

// --- Kalori Trendi (son 14 gün çizgi) ---
function renderCalorieChart() {
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
function computePersonalRecords() {
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

function renderPersonalRecords() {
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
function paceStrToSec(str) {
  if (!str) return null;
  const m = String(str).trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return null;
  return parseInt(m[1]) * 60 + parseInt(m[2]);
}

// Antrenmanın yoğunluk faktörü (IF) — eşik verisi varsa branşa göre; yoksa null
function workoutIF(w) {
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
function workoutLoad(w) {
  const hours = (w.duration || 0) / 3600;
  if (hours <= 0) return 0;
  let intf = workoutIF(w);
  if (intf == null) intf = (typeof w.rpe === 'number' ? w.rpe : 5) / 10;
  intf = Math.max(0.3, Math.min(1.5, intf));
  return hours * intf * intf * 100;
}

// Bir günün toplam antrenman yükü (TSS)
function dailyLoadOn(dateStr) {
  return state.workouts
    .filter(w => w.date === dateStr)
    .reduce((sum, w) => sum + workoutLoad(w), 0);
}

// Akut:Kronik İş Yükü Oranı (ACWR) — son 7g yük / 28g haftalık ort. yük
function computeAcwr() {
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
function computeFitnessFatigue(tailDays = 28) {
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
      const d = new Date(ds);
      out.push({ label: `${d.getDate()}`, ctl, atl, form: prevCtl - prevAtl });
    }
  }
  const todayForm = prevCtl - prevAtl; // son günün başındaki form
  return { series: out, form: todayForm, ctl, atl };
}

// İki seri (CTL + ATL) çizgi grafiği — renderSleepChart desenini taklit eder
function renderLoadBalanceChart() {
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
function hrZoneOf(hr, maxHr) {
  const pct = hr / maxHr;
  if (pct < 0.60) return 0; // Z1
  if (pct < 0.70) return 1; // Z2
  if (pct < 0.80) return 2; // Z3
  if (pct < 0.90) return 3; // Z4
  return 4;                 // Z5
}

// Nabzı LTHR'ye (eşik nabzı) göre Z1–Z5'e ata (Friel benzeri 5 bölge — daha gerçekçi)
function hrZoneOfLthr(hr, lthr) {
  const pct = hr / lthr;
  if (pct < 0.81) return 0; // Z1
  if (pct < 0.90) return 1; // Z2
  if (pct < 0.94) return 2; // Z3
  if (pct < 1.00) return 3; // Z4 (eşik)
  return 4;                 // Z5
}

const HR_ZONE_META = [
  { name: 'Z1 Toparlanma', color: '#3b82f6' },
  { name: 'Z2 Dayanıklılık', color: '#10b981' },
  { name: 'Z3 Tempo', color: '#f59e0b' },
  { name: 'Z4 Eşik', color: '#f97316' },
  { name: 'Z5 Maksimum', color: '#ef4444' }
];

// --- Nabız Bölgeleri: süreye göre Z1–Z5 dağılımı (yatay barlar) ---
// Yoğunluk faktörünü (IF) güç/tempo bölgesine ata (Coggan benzeri)
function ifZone(intf) {
  if (intf < 0.55) return 0; // Z1
  if (intf < 0.75) return 1; // Z2
  if (intf < 0.90) return 2; // Z3
  if (intf < 1.05) return 3; // Z4
  return 4;                  // Z5
}

// Antrenmanın yoğunluk bölgesi — branşa göre doğru ölçü:
// bisiklet→güç/FTP, koşu→tempo/eşik-tempo, diğer→nabız/LTHR(veya maxHR)
function workoutZone(w) {
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
function buildRouteSVG(pts) {
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
function openWorkoutDetail(w) {
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

  document.getElementById('wd-body').innerHTML = html;
  const close = () => modal.classList.remove('open');
  document.getElementById('wd-close').onclick = close;
  modal.onclick = (e) => { if (e.target === modal) close(); };
  modal.classList.add('open');
}

function renderHrZones() {
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

// Uygulama-içi onay penceresi (tarayıcı confirm() yerine). Promise<boolean> döndürür.
function showConfirm(message, opts = {}) {
  const { title = 'Onay', okText = 'Onayla', cancelText = 'İptal', danger = false } = opts;
  return new Promise(resolve => {
    const overlay = document.getElementById('confirm-overlay');
    if (!overlay) { resolve(window.confirm(message)); return; } // güvenli yedek
    const okBtn = document.getElementById('confirm-ok');
    const cancelBtn = document.getElementById('confirm-cancel');
    document.getElementById('confirm-title').textContent = title;
    document.getElementById('confirm-message').textContent = message; // textContent → enjeksiyon yok
    okBtn.textContent = okText;
    cancelBtn.textContent = cancelText;
    okBtn.className = 'btn ' + (danger ? 'btn-primary confirm-ok-danger' : 'btn-primary');

    const cleanup = (val) => {
      overlay.classList.remove('open');
      okBtn.onclick = cancelBtn.onclick = overlay.onclick = null;
      document.removeEventListener('keydown', onKey);
      resolve(val);
    };
    const onKey = (e) => { if (e.key === 'Escape') cleanup(false); };

    okBtn.onclick = () => cleanup(true);
    cancelBtn.onclick = () => cleanup(false);
    overlay.onclick = (e) => { if (e.target === overlay) cleanup(false); };
    document.addEventListener('keydown', onKey);
    overlay.classList.add('open');
  });
}

function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js')
      .then(reg => console.log('Service Worker başarıyla kaydedildi. Kapsam:', reg.scope))
      .catch(err => console.log('Service Worker kaydı başarısız:', err));
  }
}
