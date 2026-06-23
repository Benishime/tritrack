import { scheduleCloudPush } from './cloud.js';
import { updateDietSummaryDOM } from './today.js';

// TriTrack - Triatlon ve Koşu Takip Uygulaması
// Ana Uygulama Mantığı (JavaScript)

// ==========================================
// 1. STATE YÖNETİMİ & BAŞLANGIÇ VERİLERİ
// ==========================================

export let state = {
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
export function formatDate(dateObj) {
  const year = dateObj.getFullYear();
  const month = String(dateObj.getMonth() + 1).padStart(2, '0');
  const day = String(dateObj.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// "YYYY-MM-DD" metnini YEREL saat diliminde Date'e çevir.
// (new Date("2026-06-23") UTC parse eder → bazı saat dilimlerinde gün kayar.)
export function parseLocalDate(dateStr) {
  const [y, m, d] = String(dateStr).split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

// Benzersiz id üretici (aynı milisaniyede çakışmayı önler)
export function generateId(prefix = '') {
  return prefix + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
}

// Bugünün Tarih Değişkeni (State'deki geçerli gün)
export let currentDateStr = formatDate(new Date());

// Düzenlenmekte olan antrenmanın id'si (null = yeni kayıt modu)


// İlk açılış mı? (true ise onboarding sihirbazı gösterilir)
export let needsOnboarding = false;

// Verileri LocalStorage'dan Çek
// Profilin zorunlu diyet hedeflerini güvenceye al (eski/eksik/buluttan gelen profiller için).
// Eksikse updateDietSummaryDOM çöker ve "Bugün" diyet hedefleri yenilenmez.
export function ensureProfileDefaults(p) {
  p = p || {};
  if (p.targetDailyCalories == null) p.targetDailyCalories = 2500;
  if (!p.targetMacros || typeof p.targetMacros !== 'object') {
    p.targetMacros = { protein: 150, carbs: 300, fat: 70 };
  } else {
    if (p.targetMacros.protein == null) p.targetMacros.protein = 150;
    if (p.targetMacros.carbs == null) p.targetMacros.carbs = 300;
    if (p.targetMacros.fat == null) p.targetMacros.fat = 70;
  }
  return p;
}

export function loadState() {
  const savedState = localStorage.getItem('tritrack_state');
  if (savedState) {
    try {
      state = JSON.parse(savedState);
      // Geriye dönük uyumluluk veya boş alan kontrolleri
      if (!state.profile) state.profile = {};
      ensureProfileDefaults(state.profile);
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
export function initEmptyState() {
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
export function saveState(localOnly) {
  state.updatedAt = Date.now();
  localStorage.setItem('tritrack_state', JSON.stringify(state));
  if (!localOnly) scheduleCloudPush();
}


// --- ESM setter’ları: import edilen bağlamalar salt-okunur olduğu için
// diğer modüllerden yeniden atama bunlar üzerinden yapılır.
export function replaceState(v) { state = v; }
export function setCurrentDateStr(v) { currentDateStr = v; }
export function setNeedsOnboarding(v) { needsOnboarding = v; }
