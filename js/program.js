import { SPORT_META, addDaysStr, mondayOf } from './analysis.js';
import { currentDateStr, formatDate, generateId, parseLocalDate, saveState, state } from './state.js';
import { renderTodayView } from './today.js';
import { showConfirm, showToast } from './utils.js';

// ==========================================
// 5. PROGRAM PLANLAMA (WEEKLY SCHEDULER) GÖRÜNÜMÜ
// ==========================================

export function initProgramView() {
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
      id: generateId('p_'),
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

export function openPlanModal(defaultDate) {
  const modal = document.getElementById('modal-plan');
  document.getElementById('plan-date').value = defaultDate;
  const saveTpl = document.getElementById('plan-save-template');
  if (saveTpl) saveTpl.checked = false;
  renderPlanTemplates();
  updatePlanDistanceLabel();
  modal.classList.add('open');
}

// --- Antrenman şablonları ---
export function saveWorkoutTemplate(t) {
  if (!state.templates) state.templates = [];
  const name = (t.details || '').trim().slice(0, 40) ||
    `${(SPORT_META[t.sport] || {}).name || t.sport}${t.targetDistance ? ' ' + t.targetDistance : ''}`;
  const existing = state.templates.find(x => x.name === name);
  if (existing) Object.assign(existing, t, { name });
  else state.templates.push({ id: generateId('tpl_'), name, sport: t.sport, targetDistance: t.targetDistance, targetDuration: t.targetDuration, details: t.details });
  showToast('Şablon kaydedildi ⭐');
}

export function renderPlanTemplates() {
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

export function updatePlanDistanceLabel() {
  const sport = document.getElementById('plan-sport').value;
  const label = document.getElementById('plan-distance-label');
  if (label) label.innerText = (sport === 'swim') ? 'Mesafe Hedefi (m)' : 'Mesafe Hedefi (km)';
}

// ---- TOPLU HAFTALIK PLAN İÇE AKTARMA ----

// Gün adı → hafta içi index (0=Pazartesi). Uzun anahtarlar önce eşleşir.
export const BULK_DAY_MAP = {
  pazartesi: 0, pzt: 0, pt: 0, monday: 0, mon: 0,
  salı: 1, sali: 1, sal: 1, tuesday: 1, tue: 1,
  çarşamba: 2, carsamba: 2, çar: 2, car: 2, wednesday: 2, wed: 2,
  perşembe: 3, persembe: 3, perş: 3, pers: 3, per: 3, thursday: 3, thu: 3,
  cumartesi: 5, cmt: 5, cts: 5, saturday: 5, sat: 5,
  cuma: 4, cum: 4, friday: 4, fri: 4,
  pazar: 6, paz: 6, pz: 6, sunday: 6, sun: 6
};
export const BULK_DAY_KEYS = Object.keys(BULK_DAY_MAP).sort((a, b) => b.length - a.length);
export const BULK_DAY_NAMES = ['Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi', 'Pazar'];

export const BULK_EXAMPLE = `Pazartesi: Koşu 10km tempo
Salı: Yüzme 1500m teknik
Çarşamba: Dinlenme
Perşembe: Bisiklet 40km Z2
Cuma: Güç 45dk core
Cumartesi: Uzun koşu 18km
Pazar: Dinlenme`;

export let bulkWeekMonday = mondayOf(formatDate(new Date()));

export function initBulkPlanModal() {
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

export function updateBulkWeekLabel() {
  const start = parseLocalDate(bulkWeekMonday);
  const end = parseLocalDate(addDaysStr(bulkWeekMonday, 6));
  const opt = { day: 'numeric', month: 'short' };
  document.getElementById('bulk-week-label').innerText =
    `${start.toLocaleDateString('tr-TR', opt)} – ${end.toLocaleDateString('tr-TR', opt)}`;
}

// Tek satırı çöz: gün + branş + mesafe/süre/not
export function parseBulkLine(rawLine) {
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
export function detectBulkSport(text) {
  const t = (text || '').toLocaleLowerCase('tr');
  if (/(yüz|yuz|swim|havuz|kulaç|kulac)/.test(t)) return 'swim';
  if (/(bisiklet|bike|cycl|ride|pedal|watt|spin)/.test(t)) return 'bike';
  if (/(güç|guc|fitness|gym|core|kuvvet|ağırlık|agirlik|strength)/.test(t)) return 'fitness';
  if (/(koş|kos|run|jog|tempo|interval|fartlek|trail|yürü|yuru|walk)/.test(t)) return 'run';
  return 'run'; // varsayılan
}

export function parseBulkText(text) {
  return text.split('\n').map(parseBulkLine).filter(Boolean);
}

export function renderBulkPreview() {
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

export function submitBulkPlan() {
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
      id: generateId('p_'),
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

export function escapeHtml(s) {
  return String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}

// --- Ay Takvimi ---
export let calendarAnchor = formatDate(new Date());

export function shiftCalendarMonth(delta) {
  const d = parseLocalDate(calendarAnchor);
  d.setDate(1);
  d.setMonth(d.getMonth() + delta);
  calendarAnchor = formatDate(d);
  renderCalendar();
}

export function renderCalendar() {
  const grid = document.getElementById('calendar-grid');
  const title = document.getElementById('cal-title');
  if (!grid || !title) return;
  const d = parseLocalDate(calendarAnchor);
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

export function renderProgramView() {
  renderCalendar();
  const curr = parseLocalDate(currentDateStr);
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
          <button class="delete-plan-btn" style="border:none; background:none; cursor:pointer; font-size:22px; line-height:1; font-weight:bold; color:#ef4444; padding:2px 10px;" data-id="${plan.id}" title="Planı sil">&times;</button>
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

