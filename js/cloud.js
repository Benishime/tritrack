import { normalizeState } from './data.js';
import { refreshActiveView } from './main.js';
import { showOnboarding } from './onboarding.js';
import { initEmptyState, needsOnboarding, replaceState, saveState, setNeedsOnboarding, state } from './state.js';
import { renderTodayView } from './today.js';
import { showConfirm, showToast } from './utils.js';

// ==========================================
// 1.A KULLANICI HESABI & BULUT SENKRON (SUPABASE)
// ==========================================
// Doldurmak için: SUPABASE-KURULUM.md. Boş bırakılırsa uygulama tamamen yereldir (hesap ekranı çıkmaz).
export const SUPABASE_URL = 'https://piqyiroknhxadttemkih.supabase.co';
export const SUPABASE_ANON_KEY = 'sb_publishable_j4PB4o4_hfHxFFMGs5ocKA_SR7aJDUw';

export let sbClient = null;       // supabase client (auth açıksa)
export let currentUser = null;    // girişli kullanıcı
export let cloudPushTimer = null; // debounced push zamanlayıcı
export let authMode = 'login';    // 'login' | 'signup'

export function authEnabled() {
  return !!(SUPABASE_URL && SUPABASE_ANON_KEY && typeof supabase !== 'undefined');
}

// State'te anlamlı kullanıcı verisi var mı? (misafir→hesap taşıma kararı için)
export function hasUserData(s) {
  return !!(s && ((s.workouts && s.workouts.length) || (s.diet && s.diet.length) ||
    (s.plans && s.plans.length) || (s.dietPlans && s.dietPlans.length) ||
    (s.holisticLogs && Object.keys(s.holisticLogs).length) || (s.profile && s.profile.name)));
}

// Buluta gönderilecek kopya — cihaza özel sırlar (Gemini anahtarı, Strava token) hariç
export function cloudPayload(s) {
  const copy = JSON.parse(JSON.stringify(s));
  if (copy.profile) { delete copy.profile.geminiApiKey; delete copy.profile.claudeApiKey; delete copy.profile.openaiApiKey; delete copy.profile.strava; delete copy.profile.stravaProxy; }
  return copy;
}

export function scheduleCloudPush() {
  if (!currentUser || !sbClient) return;
  clearTimeout(cloudPushTimer);
  cloudPushTimer = setTimeout(pushCloud, 1500);
}

export async function pushCloud() {
  if (!currentUser || !sbClient) return;
  try {
    await sbClient.from('user_data').upsert({
      user_id: currentUser.id,
      data: cloudPayload(state),
      updated_at: new Date().toISOString()
    });
  } catch (e) { console.warn('Bulut push hatası', e); }
}

export async function initAuth() {
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

export async function handleSignedIn(user) {
  currentUser = user;
  localStorage.removeItem('tritrack_guest');
  hideAuthOverlay();
  renderAccountCard();
  await pullCloud();
}

// Buluttan kullanıcının verisini çek → yereli güncelle (cihaz sırlarını koru)
export async function pullCloud() {
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
  replaceState(normalizeState(row.data || {}));
  if (state.profile) {
    if (localSecrets.geminiApiKey) state.profile.geminiApiKey = localSecrets.geminiApiKey;
    if (localSecrets.strava) state.profile.strava = localSecrets.strava;
    if (localSecrets.stravaProxy) state.profile.stravaProxy = localSecrets.stravaProxy;
  }
  setNeedsOnboarding(false);
  saveState(true);
  rerenderAfterSync();
  showToast('Veriler buluttan yüklendi ✅');
}

export function rerenderAfterSync() {
  try {
    if (typeof renderTodayView === 'function') renderTodayView();
    const active = document.querySelector('.bottom-nav-item.active');
    if (active && typeof refreshActiveView === 'function') refreshActiveView(active.getAttribute('data-view'));
    if (typeof renderAccountCard === 'function') renderAccountCard();
  } catch (e) { console.warn('Yeniden render hatası', e); }
}

// --- Auth ekranı UI ---
export function initAuthUI() {
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

export function setAuthMode(mode) {
  authMode = mode;
  const title = document.getElementById('auth-title');
  const submit = document.getElementById('auth-submit');
  const toggle = document.getElementById('auth-toggle');
  if (title) title.textContent = mode === 'login' ? 'Giriş Yap' : 'Kayıt Ol';
  if (submit) submit.textContent = mode === 'login' ? 'Giriş Yap' : 'Kayıt Ol';
  if (toggle) toggle.textContent = mode === 'login' ? 'Hesabın yok mu? Kayıt ol' : 'Zaten hesabın var mı? Giriş yap';
  setAuthError('');
}

export function setAuthError(msg) {
  const el = document.getElementById('auth-error');
  if (el) el.textContent = msg || '';
}

export function setAuthBusy(busy) {
  const submit = document.getElementById('auth-submit');
  if (submit) { submit.disabled = busy; submit.style.opacity = busy ? '0.6' : '1'; }
}

export function showAuthOverlay() { const o = document.getElementById('auth-overlay'); if (o) o.classList.add('open'); }
export function hideAuthOverlay() { const o = document.getElementById('auth-overlay'); if (o) o.classList.remove('open'); }

export async function signIn(email, pwd) {
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

export async function signUp(email, pwd) {
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

export async function signOut() {
  if (!sbClient) return;
  if (!(await showConfirm('Çıkış yapılsın mı? Bu cihazdaki yerel kopya temizlenecek (verilerin bulutta güvende).', { title: 'Çıkış', okText: 'Çıkış Yap', danger: true }))) return;
  try { await sbClient.auth.signOut(); } catch (e) { console.warn(e); }
  currentUser = null;
  localStorage.removeItem('tritrack_state');
  localStorage.removeItem('tritrack_guest');
  location.reload();
}

export function continueAsGuest() {
  localStorage.setItem('tritrack_guest', '1');
  hideAuthOverlay();
  if (needsOnboarding) showOnboarding();
}

export function authErrorTr(e) {
  const m = (e && e.message) ? e.message.toLowerCase() : '';
  if (m.includes('invalid login')) return 'E-posta veya parola hatalı.';
  if (m.includes('already registered') || m.includes('already been registered')) return 'Bu e-posta zaten kayıtlı. Giriş yapmayı dene.';
  if (m.includes('password')) return 'Parola en az 6 karakter olmalı.';
  if (m.includes('email')) return 'Geçerli bir e-posta gir.';
  if (m.includes('network') || m.includes('fetch')) return 'Bağlantı hatası. İnterneti kontrol et.';
  return 'İşlem başarısız: ' + (e && e.message ? e.message : 'bilinmeyen hata');
}

// Profil'deki hesap kartını güncelle
export function renderAccountCard() {
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

