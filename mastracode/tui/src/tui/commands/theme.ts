import { Box, SelectList, Spacer, Text } from '@earendil-works/pi-tui';
import type { SelectItem } from '@earendil-works/pi-tui';
import { loadSettings, saveSettings } from '@mastra/code-sdk/onboarding/settings';
import type { IToolExecutionComponent } from '../components/tool-execution-interface.js';
import { getThemesDir, listBundledThemes, listCustomThemes, loadCustomTheme } from '../custom-themes.js';
import { detectTerminalTheme } from '../detect-theme.js';
import { showModalOverlay } from '../overlay.js';
import { applyThemeMode, getSelectListTheme, getThemeMode, theme } from '../theme.js';
import type { SlashCommandContext } from './types.js';

/**
 * Apply a stored theme preference: 'auto' | 'dark' | 'light' or the name of a
 * custom theme file. Returns a human-readable description of what was applied,
 * or an error string for a broken/missing custom theme (after falling back to
 * auto-detection so the UI is never left unstyled).
 */
export async function applyThemePreference(pref: string): Promise<{ applied: string; error?: string }> {
  if (pref === 'dark' || pref === 'light') {
    applyThemeMode(pref);
    return { applied: pref };
  }
  if (pref !== 'auto') {
    const result = loadCustomTheme(pref);
    if (result.ok) {
      applyThemeMode(result.theme.appearance, undefined, result.theme.colors, result.theme.bg);
      return { applied: `${result.theme.name} (${result.theme.appearance})` };
    }
    const detection = await detectTerminalTheme();
    applyThemeMode(detection.mode, detection.detectedBgHex);
    return { applied: `auto (detected: ${detection.mode})`, error: result.error };
  }
  const detection = await detectTerminalTheme();
  applyThemeMode(detection.mode, detection.detectedBgHex);
  return { applied: `auto (detected: ${detection.mode})` };
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
  const { applied, error } = await applyThemePreference(pref);
  if (error) {
    ctx.showError(`Could not load theme: ${error}`);
    repaint(ctx);
    return false;
  }
  const settings = loadSettings();
  settings.preferences.theme = pref;
  saveSettings(settings);
  ctx.showInfo(`Theme set to ${applied}`);
  repaint(ctx);
  return true;
}

/** Interactive theme picker with live preview while navigating. */
async function showThemePicker(ctx: SlashCommandContext): Promise<void> {
  const settings = loadSettings();
  const currentPref = settings.preferences.theme ?? 'auto';
  const customNames = listCustomThemes();
  const bundledNames = listBundledThemes().filter(name => !customNames.includes(name));

  const builtins = [
    { value: 'auto', label: 'auto', description: 'Match the terminal background' },
    { value: 'dark', label: 'dark', description: 'Built-in dark theme' },
    { value: 'light', label: 'light', description: 'Built-in light theme' },
  ];
  const items: SelectItem[] = [
    ...builtins.map(b => ({
      value: b.value,
      label: `  ${b.label}${b.value === currentPref ? theme.fg('accent', ' ●') : ''}  ${theme.fg('dim', b.description)}`,
    })),
    ...bundledNames.map(name => ({
      value: name,
      label: `  ${name}${name === currentPref ? theme.fg('accent', ' ●') : ''}  ${theme.fg('dim', 'bundled')}`,
    })),
    ...customNames.map(name => ({
      value: name,
      label: `  ${name}${name === currentPref ? theme.fg('accent', ' ●') : ''}  ${theme.fg('dim', 'custom theme')}`,
    })),
  ];

  // Snapshot for restoring on cancel / failed preview
  const restore = () => void applyThemePreference(currentPref).then(() => repaint(ctx));

  await new Promise<void>(resolve => {
    const container = new Box(4, 2, text => theme.bg('overlayBg', text));
    container.addChild(new Text(theme.bold(theme.fg('accent', 'Theme')), 0, 0));
    container.addChild(new Spacer(1));

    const selectList = new SelectList(items, Math.min(items.length, 12), getSelectListTheme());

    const closeOverlay = () => {
      ctx.state.ui.hideOverlay();
      ctx.state.ui.requestRender();
    };

    // Live preview as the selection moves
    selectList.onSelectionChange = item => {
      void applyThemePreference(item.value).then(() => repaint(ctx));
    };

    selectList.onSelect = item => {
      closeOverlay();
      void setThemePreference(ctx, item.value).then(ok => {
        if (!ok) restore();
        resolve();
      });
    };

    selectList.onCancel = () => {
      closeOverlay();
      restore();
      ctx.state.ui.requestRender();
      resolve();
    };

    container.addChild(selectList);
    container.addChild(new Spacer(1));
    container.addChild(
      new Text(theme.fg('dim', `↑↓ preview · Enter select · Esc cancel · custom themes: ${getThemesDir()}`), 0, 0),
    );
    (container as Box & { handleInput: (data: string) => void }).handleInput = (data: string) =>
      selectList.handleInput(data);

    showModalOverlay(ctx.state.ui, container, { maxHeight: '75%' });
  });
}

/**
 * /theme — open the theme picker.
 * /theme list — list all available themes.
 * /theme <auto|dark|light|name> — set the theme directly (name = bundled theme
 * or custom theme file in ~/.mastracode/themes/<name>.json).
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
      'Bundled: ' + bundledNames.map(n => `${n}${mark(n)}`).join(', '),
      customNames.length
        ? 'Custom: ' + customNames.map(n => `${n}${mark(n)}`).join(', ')
        : `Custom: none (add .json files to ${getThemesDir()})`,
    ];
    ctx.showInfo(lines.join('\n'));
    return;
  }

  await setThemePreference(ctx, arg);
}
