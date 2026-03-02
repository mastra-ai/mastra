import { loadSettings, saveSettings } from '../../onboarding/settings.js';
import { detectTerminalTheme } from '../detect-theme.js';
import { applyThemeMode, getThemeMode } from '../theme.js';
import type { SlashCommandContext } from './types.js';

/**
 * /theme [auto|dark|light] — show or change the color theme.
 */
export async function handleThemeCommand(ctx: SlashCommandContext, args: string[]): Promise<void> {
  const arg = args[0]?.toLowerCase();

  if (!arg) {
    const mode = getThemeMode();
    const settings = loadSettings();
    const pref = settings.preferences.theme ?? 'auto';
    ctx.showInfo(`Theme: ${mode} (preference: ${pref})`);
    return;
  }

  if (arg !== 'auto' && arg !== 'dark' && arg !== 'light') {
    ctx.showError('Usage: /theme [auto|dark|light]');
    return;
  }

  // Persist the preference
  const settings = loadSettings();
  settings.preferences.theme = arg;
  saveSettings(settings);

  // Apply immediately
  const resolved = arg === 'auto' ? await detectTerminalTheme() : arg;
  applyThemeMode(resolved);

  ctx.showInfo(`Theme set to ${arg}${arg === 'auto' ? ` (detected: ${resolved})` : ''}`);
  ctx.state.ui.requestRender();
}
