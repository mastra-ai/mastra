import { Container, Spacer } from '@earendil-works/pi-tui';
import type { SelectItem } from '@earendil-works/pi-tui';
import { loadSettings, saveSettings } from '@mastra/code-sdk/onboarding/settings';
import { BUNDLED_THEME_PAIRS } from '../bundled-themes.js';
import { MenuList, menuNote } from '../components/menu-list.js';
import type { IToolExecutionComponent } from '../components/tool-execution-interface.js';
import { getThemesDir, listBundledThemes, listCustomThemes, loadCustomTheme } from '../custom-themes.js';
import { detectTerminalTheme } from '../detect-theme.js';
import type { ThemeDetectionResult } from '../detect-theme.js';
import { showModalOverlay } from '../overlay.js';
import { applyThemeMode, getThemeMode, theme } from '../theme.js';
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
    return { applied: pref };
  }

  let detection: ThemeDetectionResult | undefined;
  const detect = async (): Promise<ThemeDetectionResult | undefined> => {
    detection ??= await detectTerminalTheme();
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
      } else {
        const detected = await detect();
        if (!detected) return { applied: pref, stale: true };
        applyThemeMode(appearance, detected.detectedBgHex, colors);
      }
      return { applied: `${result.theme.name} (${pair && detection ? detection.mode : appearance})` };
    }
    const detected = await detect();
    if (!detected) return { applied: pref, stale: true };
    applyThemeMode(detected.mode, detected.detectedBgHex);
    return { applied: `auto (detected: ${detected.mode})`, error: result.error };
  }

  const detected = await detect();
  if (!detected) return { applied: pref, stale: true };
  applyThemeMode(detected.mode, detected.detectedBgHex);
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

async function setThemePreference(ctx: SlashCommandContext, pref: string): Promise<boolean> {
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

/** Interactive theme picker with live preview while navigating. */
async function showThemePicker(ctx: SlashCommandContext): Promise<void> {
  const settings = loadSettings();
  // The effective theme may differ from the saved preference (MASTRA_THEME
  // overrides it at startup) — restore what's actually active on cancel.
  const currentPref = normalizeThemePreference(process.env.MASTRA_THEME ?? '') || settings.preferences.theme || 'auto';
  const customNames = listCustomThemes();
  const bundledNames = listBundledThemes().filter(name => !customNames.includes(name));

  const builtins = [
    { value: 'auto', label: 'auto', description: 'Match the terminal background' },
    { value: 'dark', label: 'dark', description: 'Built-in dark theme' },
    { value: 'light', label: 'light', description: 'Built-in light theme' },
  ];
  const pairItems: SelectItem[] = BUNDLED_THEME_PAIRS.map(({ light, dark }) => {
    const value = `${light}/${dark}`;
    return {
      value,
      label: `${value}${value === currentPref ? theme.fg('accent', ' ●') : ''}`,
      description: 'follow terminal',
    };
  });
  const items: SelectItem[] = [
    ...builtins.map(b => ({
      value: b.value,
      label: `${b.label}${b.value === currentPref ? theme.fg('accent', ' ●') : ''}`,
      description: b.description,
    })),
    ...pairItems,
    ...bundledNames.map(name => ({
      value: name,
      label: `${name}${name === currentPref ? theme.fg('accent', ' ●') : ''}`,
      description: 'bundled',
    })),
    ...customNames.map(name => ({
      value: name,
      label: `${name}${name === currentPref ? theme.fg('accent', ' ●') : ''}`,
      description: 'custom theme',
    })),
  ];

  // Snapshot for restoring on cancel / failed preview. Stale results (a newer
  // apply raced ahead) skip the repaint — the winner already repainted.
  const preview = (pref: string) =>
    void applyThemePreference(pref).then(result => {
      if (!result.stale) repaint(ctx);
    });
  const restore = () => preview(currentPref);

  await new Promise<void>(resolve => {
    const container = new Container();
    const selectList = new MenuList(items, Math.min(items.length, 12));

    const closeOverlay = () => {
      ctx.state.ui.hideOverlay();
      ctx.state.ui.requestRender();
    };

    // Live preview as the selection moves
    selectList.onSelectionChange = item => {
      preview(item.value);
    };

    selectList.onSelect = item => {
      closeOverlay();
      setThemePreference(ctx, item.value)
        .then(ok => {
          if (!ok) restore();
        })
        .catch((err: unknown) => {
          ctx.showError(`Could not set theme: ${err instanceof Error ? err.message : err}`);
          restore();
        })
        .finally(resolve);
    };

    selectList.onCancel = () => {
      closeOverlay();
      restore();
      ctx.state.ui.requestRender();
      resolve();
    };

    container.addChild(selectList);
    container.addChild(new Spacer(1));
    container.addChild(menuNote(`Custom themes: ${getThemesDir()}`));
    (container as Container & { handleInput: (data: string) => void }).handleInput = (data: string) =>
      selectList.handleInput(data);

    showModalOverlay(ctx.state.ui, container, { title: 'Theme' });
  });
}

/**
 * /theme — open the theme picker.
 * /theme list — list all available themes.
 * /theme <auto|dark|light|name|light/dark> — set the theme directly (name =
 * bundled theme or custom theme file in ~/.mastracode/themes/<name>.json; a
 * light/dark pair follows the detected terminal appearance).
 */
export async function handleThemeCommand(ctx: SlashCommandContext, args: string[]): Promise<void> {
  const arg = args[0];

  if (!arg) {
    await showThemePicker(ctx);
    return;
  }

  if (arg === 'status') {
    const mode = getThemeMode();
    const settings = loadSettings();
    const pref = settings.preferences.theme ?? 'auto';
    ctx.showInfo(`Theme: ${mode} (preference: ${pref})`);
    return;
  }

  if (arg === 'list') {
    const pref = loadSettings().preferences.theme ?? 'auto';
    const mark = (name: string) => (name === pref ? ' ●' : '');
    const customNames = listCustomThemes();
    const bundledNames = listBundledThemes().filter(name => !customNames.includes(name));
    const lines = [
      'Built-in: ' + ['auto', 'dark', 'light'].map(n => `${n}${mark(n)}`).join(', '),
      'Pairs: ' +
        BUNDLED_THEME_PAIRS.map(p => {
          const pair = `${p.light}/${p.dark}`;
          return `${pair}${mark(pair)}`;
        }).join(', '),
      'Bundled: ' + bundledNames.map(n => `${n}${mark(n)}`).join(', '),
      customNames.length
        ? 'Custom: ' + customNames.map(n => `${n}${mark(n)}`).join(', ')
        : `Custom: none (add .json files to ${getThemesDir()})`,
    ];
    ctx.showInfo(lines.join('\n'));
    return;
  }

  await setThemePreference(ctx, normalizeThemePreference(arg));
}
