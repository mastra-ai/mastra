/**
 * Density persistence: localStorage helper.
 *
 * Theme is owned by `@mastra/playground-ui`'s `ThemeProvider` (class-based
 * `.dark`/`.light`); only density remains app-local here.
 */

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
