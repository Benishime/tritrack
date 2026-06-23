// ==========================================
// 14. YARDIMCI FONKSİYONLAR & PWA ARAÇLARI
// ==========================================

export function showToast(message, type) {
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
export function showConfirm(message, opts = {}) {
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

export function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js')
      .then(reg => console.log('Service Worker başarıyla kaydedildi. Kapsam:', reg.scope))
      .catch(err => console.log('Service Worker kaydı başarısız:', err));
  }
}

