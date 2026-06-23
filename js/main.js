import { renderAnalysisView } from './analysis.js';
import { authEnabled, initAuth, renderAccountCard } from './cloud.js';
import { initDataManagement } from './data.js';
import { initDietView, renderDietView, renderWeeklyDietView } from './diet.js';
import { initOnboarding, showOnboarding } from './onboarding.js';
import { initProfileView, renderProfileView } from './profile.js';
import { initProgramView, renderProgramView } from './program.js';
import { loadState, needsOnboarding } from './state.js';
import { initStravaSync } from './strava.js';
import { initTheme } from './theme.js';
import { initTodayView, renderTodayView } from './today.js';
import { registerServiceWorker } from './utils.js';
import { initWorkoutLogView, resetWorkoutForms } from './workout.js';

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

// Programatik görünüm geçişi (nav butonu olmayan görünümler için de çalışır, örn. 'log').
export function navigateToView(viewName) {
  const navItems = document.querySelectorAll('.bottom-nav .bottom-nav-item');
  const views = document.querySelectorAll('.app-content .view-section');
  const profileBtn = document.getElementById('profile-open-btn');
  if (profileBtn) profileBtn.classList.remove('active');
  navItems.forEach(nav => nav.classList.remove('active'));
  const targetNav = document.querySelector(`.bottom-nav [data-view="${viewName}"]`);
  if (targetNav) targetNav.classList.add('active');
  else if (viewName === 'profile' && profileBtn) profileBtn.classList.add('active');
  const targetViewId = `view-${viewName}`;
  views.forEach(view => view.classList.toggle('active', view.id === targetViewId));
  refreshActiveView(viewName);
}

export function initNavigation() {
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

export function refreshActiveView(viewName) {
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

