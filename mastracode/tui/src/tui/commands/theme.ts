import { loadSettings, saveSettings } from '@mastra/code-sdk/onboarding/settings';
import { BUNDLED_THEME_PAIRS } from '../bundled-themes.js';
import type { IToolExecutionComponent } from '../components/tool-execution-interface.js';
import { getThemesDir, listBundledThemes, listCustomThemes, loadCustomTheme } from '../custom-themes.js';
import { detectTerminalTheme } from '../detect-theme.js';
import type { ThemeDetectionResult } from '../detect-theme.js';
import { clearTerminalBackground, paintTerminalBackground, resetTerminalBackground } from '../terminal-background.js';
import { applyThemeMode, getContrastBg } from '../theme.js';
import type { SlashCommandContext } from './types.js';

/**
 * Serialize theme applications. Auto detection awaits the terminal for up to
 * ~200ms, so overlapping requests (picker previews, restores) could otherwise
 * finish out of order and leave a stale theme applied. A request that loses to
 * a newer one returns `stale: true` without touching the theme.
 */
let applyRequestId = 0;

function parseThemePair(pref: string): { light: string; dark: string } | undefined {
  const [light, dark, ...rest] = pref.split('/');
  if (!light || !dark || rest.length > 0) return undefined;
  return { light, dark };
}

export function normalizeThemePreference(pref: string): string {
  const lower = pref.toLowerCase();
  if (lower === 'auto' || lower === 'dark' || lower === 'light') return lower;
  const pair = BUNDLED_THEME_PAIRS.find(({ light, dark }) => `${light}/${dark}` === lower);
  return pair ? lower : pref;
}

/**
 * Apply a stored theme preference: 'auto', 'dark', 'light', the name of a
 * custom theme file, or a light/dark pair like 'catppuccin-latte/catppuccin-mocha'
 * that follows the detected terminal appearance. Returns a human-readable
 * description of what was applied, or an error string for a broken/missing
 * custom theme (after falling back to auto-detection so the UI is never left
 * unstyled).
 */
export async function applyThemePreference(
  pref: string,
): Promise<{ applied: string; error?: string; stale?: boolean }> {
  const requestId = ++applyRequestId;
  if (pref === 'dark' || pref === 'light') {
    applyThemeMode(pref);
    paintTerminalBackground(getContrastBg());
    return { applied: pref };
  }

  let detection: ThemeDetectionResult | undefined;
  const detect = async (): Promise<ThemeDetectionResult | undefined> => {
    if (!detection) {
      // Detection must see the user's own background, not one we painted.
      resetTerminalBackground();
      detection = await detectTerminalTheme();
    }
    return requestId === applyRequestId ? detection : undefined;
  };

  const pair = parseThemePair(pref);
  let themeName: string | undefined;
  if (pair) {
    const detected = await detect();
    if (!detected) return { applied: pref, stale: true };
    themeName = detected.mode === 'light' ? pair.light : pair.dark;
  } else if (pref !== 'auto') {
    themeName = pref;
  }

  if (themeName !== undefined) {
    const result = loadCustomTheme(themeName);
    if (result.ok) {
      const { appearance, colors, bg } = result.theme;
      if (bg) {
        applyThemeMode(appearance, undefined, colors, bg);
        paintTerminalBackground(bg);
      } else {
        const detected = await detect();
        if (!detected) return { applied: pref, stale: true };
        applyThemeMode(appearance, detected.detectedBgHex, colors);
        clearTerminalBackground();
      }
      return { applied: `${result.theme.name} (${pair && detection ? detection.mode : appearance})` };
    }
    const detected = await detect();
    if (!detected) return { applied: pref, stale: true };
    applyThemeMode(detected.mode, detected.detectedBgHex);
    clearTerminalBackground();
    return { applied: `auto (detected: ${detected.mode})`, error: result.error };
  }

  const detected = await detect();
  if (!detected) return { applied: pref, stale: true };
  applyThemeMode(detected.mode, detected.detectedBgHex);
  clearTerminalBackground();
  return { applied: `auto (detected: ${detected.mode})` };
}

/**
 * Repaint everything with the new theme. Components cache rendered lines by
 * (text, width), which a theme switch doesn't change — invalidate() clears
 * those caches so already-rendered messages pick up the new colors. Tool rows
 * bake their colors into text at build time, so they also need a refresh().
 */
function repaint(ctx: SlashCommandContext): void {
  for (const tool of ctx.state.allToolComponents as IToolExecutionComponent[]) {
    tool.refresh?.();
  }
  ctx.state.ui.invalidate();
  ctx.state.ui.requestRender(true);
}

/** Apply, repaint, and persist a theme preference. Returns false if it wasn't applied. */
export async function setThemePreference(ctx: SlashCommandContext, pref: string): Promise<boolean> {
  const result = await applyThemePreference(pref);
  if (result.stale) return false;
  repaint(ctx);
  if (result.error) {
    ctx.showError(`Could not load theme: ${result.error}`);
    return false;
  }
  try {
    const settings = loadSettings();
    settings.preferences.theme = pref;
    saveSettings(settings);
  } catch (err) {
    ctx.showError(`Theme applied but the preference could not be saved: ${err instanceof Error ? err.message : err}`);
    return true; // keep the applied theme
  }
  ctx.showInfo(`Theme set to ${result.applied}`);
  return true;
}

/** Apply a theme without persisting it, for live preview. Stale results skip the repaint. */
export function previewThemePreference(ctx: SlashCommandContext, pref: string): void {
  void applyThemePreference(pref).then(result => {
    if (!result.stale) repaint(ctx);
  });
}

/**
 * The effective theme preference. It may differ from the saved one, because
 * MASTRA_THEME overrides it at startup.
 */
export function getActiveThemePreference(): string {
  return normalizeThemePreference(process.env.MASTRA_THEME ?? '') || loadSettings().preferences.theme || 'auto';
}

export interface ThemeOption {
  value: string;
  description: string;
}

/** Every selectable theme: built-in modes, bundled light/dark pairs, bundled themes, then custom theme files. */
export function listThemeOptions(): ThemeOption[] {
  const customNames = listCustomThemes();
  const bundledNames = listBundledThemes().filter(name => !customNames.includes(name));
  return [
    { value: 'auto', description: 'Match the terminal background' },
    { value: 'dark', description: 'Built-in dark theme' },
    { value: 'light', description: 'Built-in light theme' },
    ...BUNDLED_THEME_PAIRS.map(({ light, dark }) => ({ value: `${light}/${dark}`, description: 'Follow terminal' })),
    ...bundledNames.map(value => ({ value, description: 'Bundled' })),
    ...customNames.map(value => ({ value, description: `Custom theme in ${getThemesDir()}` })),
  ];
}
