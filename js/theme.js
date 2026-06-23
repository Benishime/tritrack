// ==========================================
// 3. TEMA YÖNETİMİ (LIGHT / DARK TEMA)
// ==========================================

export function initTheme() {
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

export function applyTheme(theme) {
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

