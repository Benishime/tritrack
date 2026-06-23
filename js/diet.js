import { addDaysStr, mondayOf } from './analysis.js';
import { LOCAL_FOODS } from './foods.js';
import { currentDateStr, formatDate, generateId, parseLocalDate, saveState, state } from './state.js';
import { renderTodayView, toggleDietPlanCompleted, updateDietSummaryDOM } from './today.js';
import { showConfirm, showToast } from './utils.js';

// ==========================================
// 6. GÜNLÜK DİYET TAKİBİ VE ARAMA YÖNETİMİ
// ==========================================

export let activeMealSelector = 'breakfast'; // Hangi öğüne besin eklenecek

// Diyet planı eklenirken hedef gün (haftalık planlamada ileri tarih olabilir).
// Günlük takip ekranından açılınca currentDateStr'e eşitlenir.
export let dietTargetDate = formatDate(new Date());

// Besin ekleme modalının bağlamı: 'track' (günlük tüketim) | 'plan' (haftalık plan)
export let dietModalMode = 'track';

// Haftalık Plan görünümünde gösterilen haftanın bir günü (◀ ▶ ile gezinir)
export let dietWeekAnchor = formatDate(new Date());

// Öğün meta bilgisi (ikon + Türkçe ad) — tek kaynak, tekrarı önler
export const MEAL_META = {
  breakfast: { icon: '🍳', name: 'Kahvaltı' },
  lunch: { icon: '🍗', name: 'Öğle' },
  dinner: { icon: '🥗', name: 'Akşam' },
  snack: { icon: '🍌', name: 'Atıştırmalık' }
};
export const MEAL_ORDER = ['breakfast', 'lunch', 'dinner', 'snack'];

// Birimlerin gram karşılıkları (besin değerleri 100g bazlıdır)
export const UNIT_GRAMS = {
  g: 1,          // 1 gram
  portion: 150,  // 1 porsiyon ≈ 150g
  plate: 300,    // 1 tabak ≈ 300g
  bowl: 250,     // 1 kase ≈ 250g
  cup: 200,      // 1 bardak / kutu ≈ 200ml/g
  handful: 30    // 1 avuç ≈ 30g
};

// Birimlerin ekranda gösterilecek Türkçe etiketleri
export const UNIT_LABELS = {
  g: 'g', portion: 'porsiyon', plate: 'tabak',
  bowl: 'kase', cup: 'bardak', handful: 'avuç', piece: 'adet'
};

// Miktar + birimi okunabilir metne çevir (örn. "100 g", "1 tabak")
export function formatPortion(qty, unit) {
  const label = UNIT_LABELS[unit] || unit;
  return unit === 'g' ? `${qty}${label}` : `${qty} ${label}`;
}

// Tarihi kısa, okunabilir Türkçe etikete çevir (örn. "14 Haz Cmt", "bugün", "yarın")
export function shortDateLabel(dateStr) {
  if (dateStr === currentDateStr) return 'bugün';
  if (dateStr === addDaysStr(currentDateStr, 1)) return 'yarın';
  const d = parseLocalDate(dateStr);
  return d.toLocaleDateString('tr-TR', { day: 'numeric', month: 'short', weekday: 'short' });
}

// Plan eklenirken toast'ta gösterilecek hedef gün etiketi
export function dietPlanTargetLabel() {
  return dietTargetDate === currentDateStr ? 'diyet' : `${shortDateLabel(dietTargetDate)}`;
}

export function initDietView() {
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
export function switchDietPane(pane) {
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
export function openDietModal(meal, targetDate, mode) {
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
export function applyDietModalMode(mode) {
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

export function saveManualFood(e, isPlanned) {
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
      id: generateId('dp_'),
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
      id: generateId('fd_'),
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

export function searchFoods(query) {
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

export let selectedFoodObject = null;

export function renderSearchResults(localMatches, apiMatches) {
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

export function selectFoodForPortion(food) {
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
export function highlightSelectedResult(container, selectedItem) {
  container.querySelectorAll('.food-result-row').forEach(el => el.classList.remove('selected'));
  selectedItem.classList.add('selected');
}

// Seçilen miktar + birime göre makro rozetlerini canlı güncelle
export function updatePortionPreview() {
  if (!selectedFoodObject) return;
  const qty = parseFloat(document.getElementById('food-portion-qty').value) || 0;
  const unit = document.getElementById('food-portion-unit').value;
  const ratio = (qty * (UNIT_GRAMS[unit] || 1)) / 100;

  document.getElementById('sel-cal').innerText = Math.round(selectedFoodObject.calories * ratio);
  document.getElementById('sel-p').innerText = Math.round(selectedFoodObject.protein * ratio * 10) / 10;
  document.getElementById('sel-c').innerText = Math.round(selectedFoodObject.carbs * ratio * 10) / 10;
  document.getElementById('sel-f').innerText = Math.round(selectedFoodObject.fat * ratio * 10) / 10;
}

export function addSelectedFoodToState(isPlanned) {
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
      id: generateId('dp_'),
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
      id: generateId('fd_'),
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
export function refreshDietUI() {
  // Her görünüm bağımsız sarmalandı: biri hata verse bile diğerleri (özellikle haftalık) güncellenir
  try { renderDietView(); } catch (e) { console.error('renderDietView hatası:', e); }
  try { renderWeeklyDietView(); } catch (e) { console.error('renderWeeklyDietView hatası:', e); }
  try { renderTodayView(); } catch (e) { console.error('renderTodayView hatası:', e); }
}

export function renderDietView() {
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
export function dayPlanCalories(dateStr) {
  return state.dietPlans
    .filter(p => p.date === dateStr)
    .reduce((sum, p) => sum + (p.calories || 0), 0);
}

// Haftalık plan görünümünü çiz (dietWeekAnchor haftasının Pzt–Paz'ı)
export function renderWeeklyDietView() {
  const list = document.getElementById('weekly-diet-list');
  if (!list) return;

  const weekStart = mondayOf(dietWeekAnchor);
  const weekEnd = addDaysStr(weekStart, 6);

  // Başlık: tarih aralığı
  const sd = parseLocalDate(weekStart), ed = parseLocalDate(weekEnd);
  const fmt = d => d.toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' });
  document.getElementById('diet-week-title').textContent = `${fmt(sd)} – ${fmt(ed)}`;

  const dayNames = ['Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi', 'Pazar'];
  list.innerHTML = '';

  for (let i = 0; i < 7; i++) {
    const dateStr = addDaysStr(weekStart, i);
    const d = parseLocalDate(dateStr);
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
export function deleteDietPlan(planId) {
  const plan = state.dietPlans.find(p => p.id === planId);
  if (!plan) return;
  state.dietPlans = state.dietPlans.filter(p => p.id !== planId);
  state.diet = state.diet.filter(f => f.id !== 'fd_sync_' + planId);
  saveState();
  refreshDietUI();
  showToast("Plan kalemi silindi.");
}

// Bir günün planlı öğünlerini hedef güne klonla (tüketilenlere dokunmaz)
export function copyDietDay(fromDate, toDate) {
  const items = state.dietPlans.filter(p => p.date === fromDate);
  if (items.length === 0) {
    showToast("Kopyalanacak plan yok.");
    return;
  }
  items.forEach((p, idx) => {
    state.dietPlans.push({
      ...p,
      id: generateId('dp_'),
      date: toDate,
      completed: false
    });
  });
  saveState();
  refreshDietUI();
  showToast(`${items.length} öğün ${shortDateLabel(toDate)} gününe kopyalandı.`);
}

// Bir günün planını aynı haftanın diğer günlerine uygula (önce o günleri temizler)
export async function applyDayToWeek(fromDate) {
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
        id: generateId('dp_'),
        date: dateStr,
        completed: false
      });
    });
  }
  saveState();
  refreshDietUI();
  showToast("Plan tüm haftaya uygulandı ✅");
}

