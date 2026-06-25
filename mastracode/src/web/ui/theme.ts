/** Theme persistence: localStorage with a system-preference fallback. */

export type Theme = 'dark' | 'light';

const KEY = 'mastracode.theme';

/** The stored theme if set, else the OS preference, else dark. */
export function loadTheme(): Theme {
  try {
    const stored = localStorage.getItem(KEY);
    if (stored === 'dark' || stored === 'light') return stored;
  } catch {
    /* localStorage unavailable (private mode, SSR) */
  }
  if (typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: light)').matches) {
    return 'light';
  }
  return 'dark';
}

export function saveTheme(theme: Theme): void {
  try {
    localStorage.setItem(KEY, theme);
  } catch {
    /* non-fatal */
  }
}

/** Reflect the theme onto the document root so CSS variables switch. */
export function applyTheme(theme: Theme): void {
  document.documentElement.setAttribute('data-theme', theme);
}

// ── Density preference ────────────────────────────────────────────────────

export type Density = 'comfortable' | 'compact';

const DENSITY_KEY = 'mastracode.density';

export function loadDensity(): Density {
  try {
    const stored = localStorage.getItem(DENSITY_KEY);
    if (stored === 'comfortable' || stored === 'compact') return stored;
  } catch {
    /* localStorage unavailable */
  }
  return 'comfortable';
}

export function saveDensity(density: Density): void {
  try {
    localStorage.setItem(DENSITY_KEY, density);
  } catch {
    /* non-fatal */
  }
}

/** Reflect density onto the document root so CSS can tighten spacing. */
export function applyDensity(density: Density): void {
  document.documentElement.setAttribute('data-density', density);
}
