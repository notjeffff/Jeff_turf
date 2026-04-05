const THEME_STORAGE_KEY = 'themePreference';

function getPreferredTheme() {
  const stored = localStorage.getItem(THEME_STORAGE_KEY);
  if (stored === 'light' || stored === 'dark') return stored;
  return window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
}

function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem(THEME_STORAGE_KEY, theme);

  document.querySelectorAll('[data-theme-toggle]').forEach(button => {
    const nextTheme = theme === 'dark' ? 'light' : 'dark';
    const icon = theme === 'dark' ? '☀' : '☾';
    button.dataset.nextTheme = nextTheme;
    button.innerHTML = `<span class="theme-toggle-icon">${icon}</span><span>${theme === 'dark' ? 'Light mode' : 'Dark mode'}</span>`;
  });
}

function toggleTheme() {
  const current = document.documentElement.getAttribute('data-theme') || getPreferredTheme();
  applyTheme(current === 'dark' ? 'light' : 'dark');
}

document.addEventListener('DOMContentLoaded', () => {
  applyTheme(getPreferredTheme());
  document.querySelectorAll('[data-theme-toggle]').forEach(button => {
    button.addEventListener('click', toggleTheme);
  });
});
