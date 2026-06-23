import { ensureProfileDefaults, formatDate, replaceState, saveState, state } from './state.js';
import { showConfirm, showToast } from './utils.js';

// ==========================================
// 10. VERİ YÖNETİMİ (YEDEKLEME / GERİ YÜKLEME / SIFIRLAMA)
// ==========================================

export function initDataManagement() {
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
export function exportData() {
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
export function importData(file) {
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

    replaceState(normalizeState(imported));
    saveState();

    showToast("Veriler başarıyla geri yüklendi ✅");
    setTimeout(() => location.reload(), 1000);
  };

  reader.onerror = () => showToast("Dosya okunurken bir hata oluştu.", 'error');
  reader.readAsText(file);
}

// İçe aktarılan nesnenin temel TriTrack şemasına uyup uymadığını kontrol et
export function isValidStateShape(obj) {
  return obj && typeof obj === 'object'
    && typeof obj.profile === 'object' && obj.profile !== null
    && Array.isArray(obj.workouts)
    && Array.isArray(obj.diet);
}

// Eksik alanları tamamlayarak güvenli bir state nesnesi döndür (geriye dönük uyumluluk)
export function normalizeState(obj) {
  return {
    profile: ensureProfileDefaults(obj.profile || {}),
    holisticLogs: obj.holisticLogs || {},
    plans: Array.isArray(obj.plans) ? obj.plans : [],
    dietPlans: Array.isArray(obj.dietPlans) ? obj.dietPlans : [],
    workouts: Array.isArray(obj.workouts) ? obj.workouts : [],
    diet: Array.isArray(obj.diet) ? obj.diet : [],
    templates: Array.isArray(obj.templates) ? obj.templates : []
  };
}

// Tüm verileri çift onayla kalıcı olarak sil
export async function resetAllData() {
  if (!(await showConfirm("TÜM verileriniz (antrenmanlar, diyet, planlar, profil) kalıcı olarak silinecek. Bu işlem geri alınamaz.\n\nDevam etmek istiyor musunuz?", { title: 'Tüm verileri sıfırla', okText: 'Devam', danger: true }))) return;
  if (!(await showConfirm("Son uyarı: Önce yedek aldığınızdan emin olun.\n\nSilmek için onayla.", { title: 'Son uyarı', okText: 'Sil', danger: true }))) return;

  localStorage.removeItem('tritrack_state');
  localStorage.removeItem('tritrack_state_backup');
  showToast("Tüm veriler silindi. Yeniden başlatılıyor...");
  setTimeout(() => location.reload(), 1200);
}

