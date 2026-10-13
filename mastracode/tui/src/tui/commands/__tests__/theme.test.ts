import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  loadSettings: vi.fn(),
  saveSettings: vi.fn(),
  detectTerminalTheme: vi.fn(),
  applyThemeMode: vi.fn(),
  getThemeMode: vi.fn(),
  loadCustomTheme: vi.fn(),
  listCustomThemes: vi.fn(),
  listBundledThemes: vi.fn(),
  getThemesDir: vi.fn(),
}));

vi.mock('@mastra/code-sdk/onboarding/settings', () => ({
  loadSettings: mocks.loadSettings,
  saveSettings: mocks.saveSettings,
}));

vi.mock('../../detect-theme.js', () => ({
  detectTerminalTheme: mocks.detectTerminalTheme,
}));

vi.mock('../../theme.js', () => ({
  applyThemeMode: mocks.applyThemeMode,
  getThemeMode: mocks.getThemeMode,
  getSelectListTheme: vi.fn(() => ({})),
  theme: {
    fg: (_c: string, text: string) => text,
    bg: (_c: string, text: string) => text,
    bold: (text: string) => text,
  },
}));

vi.mock('../../custom-themes.js', () => ({
  loadCustomTheme: mocks.loadCustomTheme,
  listCustomThemes: mocks.listCustomThemes,
  listBundledThemes: mocks.listBundledThemes,
  getThemesDir: mocks.getThemesDir,
}));

vi.mock('../../overlay.js', () => ({
  showModalOverlay: vi.fn(),
}));

import { handleThemeCommand, normalizeThemePreference } from '../theme.js';

function createCtx() {
  return {
    showInfo: vi.fn(),
    showError: vi.fn(),
    state: {
      allToolComponents: [],
      ui: {
        requestRender: vi.fn(),
        invalidate: vi.fn(),
        hideOverlay: vi.fn(),
      },
    },
  } as any;
}

describe('handleThemeCommand', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.loadSettings.mockReturnValue({ preferences: { theme: 'auto' } });
    mocks.getThemeMode.mockReturnValue('dark');
    mocks.detectTerminalTheme.mockResolvedValue({ mode: 'light', detectedBgHex: '#ffffff' });
    mocks.listCustomThemes.mockReturnValue([]);
    mocks.listBundledThemes.mockReturnValue(['dracula', 'nord']);
    mocks.getThemesDir.mockReturnValue('/home/user/.mastracode/themes');
  });

  it('lists built-in, bundled, and custom themes via /theme list', async () => {
    mocks.loadSettings.mockReturnValue({ preferences: { theme: 'nord' } });
    mocks.listCustomThemes.mockReturnValue(['my-theme']);
    const ctx = createCtx();

    await handleThemeCommand(ctx, ['list']);

    expect(ctx.showInfo).toHaveBeenCalledWith(
      [
        'Built-in: auto, dark, light',
        'Pairs: catppuccin-latte/catppuccin-mocha, solarized-light/solarized-dark',
        'Bundled: dracula, nord ●',
        'Custom: my-theme',
      ].join('\n'),
    );
    expect(mocks.saveSettings).not.toHaveBeenCalled();
    expect(mocks.applyThemeMode).not.toHaveBeenCalled();
  });

  it('points at the themes dir when no custom themes exist', async () => {
    const ctx = createCtx();

    await handleThemeCommand(ctx, ['list']);

    expect(ctx.showInfo).toHaveBeenCalledWith(
      [
        'Built-in: auto ●, dark, light',
        'Pairs: catppuccin-latte/catppuccin-mocha, solarized-light/solarized-dark',
        'Bundled: dracula, nord',
        'Custom: none (add .json files to /home/user/.mastracode/themes)',
      ].join('\n'),
    );
  });

  it('shows current theme mode and persisted preference via /theme status', async () => {
    mocks.loadSettings.mockReturnValue({ preferences: { theme: 'light' } });
    mocks.getThemeMode.mockReturnValue('dark');
    const ctx = createCtx();

    await handleThemeCommand(ctx, ['status']);

    expect(ctx.showInfo).toHaveBeenCalledWith('Theme: dark (preference: light)');
    expect(mocks.saveSettings).not.toHaveBeenCalled();
    expect(mocks.applyThemeMode).not.toHaveBeenCalled();
  });

  it('persists and immediately applies an explicit dark theme', async () => {
    const settings = { preferences: { theme: 'auto' } };
    mocks.loadSettings.mockReturnValue(settings);
    const ctx = createCtx();

    await handleThemeCommand(ctx, ['dark']);

    expect(settings.preferences.theme).toBe('dark');
    expect(mocks.saveSettings).toHaveBeenCalledWith(settings);
    expect(mocks.applyThemeMode).toHaveBeenCalledWith('dark');
    expect(ctx.showInfo).toHaveBeenCalledWith('Theme set to dark');
    expect(ctx.state.ui.requestRender).toHaveBeenCalledTimes(1);
  });

  it('persists auto preference, detects terminal background, and applies detected mode', async () => {
    const settings = { preferences: { theme: 'dark' } };
    mocks.loadSettings.mockReturnValue(settings);
    mocks.detectTerminalTheme.mockResolvedValue({ mode: 'light', detectedBgHex: '#eeeeee' });
    const ctx = createCtx();

    await handleThemeCommand(ctx, ['auto']);

    expect(settings.preferences.theme).toBe('auto');
    expect(mocks.saveSettings).toHaveBeenCalledWith(settings);
    expect(mocks.detectTerminalTheme).toHaveBeenCalledTimes(1);
    expect(mocks.applyThemeMode).toHaveBeenCalledWith('light', '#eeeeee');
    expect(ctx.showInfo).toHaveBeenCalledWith('Theme set to auto (detected: light)');
    expect(ctx.state.ui.requestRender).toHaveBeenCalledTimes(1);
  });

  it('loads, applies, and persists a custom theme by name', async () => {
    const settings = { preferences: { theme: 'auto' } };
    mocks.loadSettings.mockReturnValue(settings);
    const colors = { accent: '#ff00ff' };
    mocks.loadCustomTheme.mockReturnValue({
      ok: true,
      theme: { name: 'neon', appearance: 'dark', bg: '#101014', colors },
    });
    const ctx = createCtx();

    await handleThemeCommand(ctx, ['neon']);

    expect(mocks.loadCustomTheme).toHaveBeenCalledWith('neon');
    expect(mocks.applyThemeMode).toHaveBeenCalledWith('dark', undefined, colors, '#101014');
    expect(settings.preferences.theme).toBe('neon');
    expect(mocks.saveSettings).toHaveBeenCalledWith(settings);
    expect(ctx.showInfo).toHaveBeenCalledWith('Theme set to neon (dark)');
  });

  it('rejects an unknown theme name without persisting, falling back to auto', async () => {
    mocks.loadCustomTheme.mockReturnValue({ ok: false, error: 'theme "nope" not found (expected /x/nope.json)' });
    const ctx = createCtx();

    await handleThemeCommand(ctx, ['nope']);

    expect(ctx.showError).toHaveBeenCalledWith('Could not load theme: theme "nope" not found (expected /x/nope.json)');
    expect(mocks.saveSettings).not.toHaveBeenCalled();
    // Falls back to auto-detected mode so the UI stays styled
    expect(mocks.applyThemeMode).toHaveBeenCalledWith('light', '#ffffff');
  });

  it('adapts a custom theme without bg to the detected terminal background', async () => {
    const settings = { preferences: { theme: 'auto' } };
    mocks.loadSettings.mockReturnValue(settings);
    mocks.detectTerminalTheme.mockResolvedValue({ mode: 'dark', detectedBgHex: '#0d0d0d' });
    const colors = { accent: '#ff00ff' };
    mocks.loadCustomTheme.mockReturnValue({
      ok: true,
      theme: { name: 'neon', appearance: 'light', colors },
    });
    const ctx = createCtx();

    await handleThemeCommand(ctx, ['neon']);

    expect(mocks.detectTerminalTheme).toHaveBeenCalledTimes(1);
    expect(mocks.applyThemeMode).toHaveBeenCalledWith('light', '#0d0d0d', colors);
    expect(settings.preferences.theme).toBe('neon');
    expect(ctx.showInfo).toHaveBeenCalledWith('Theme set to neon (light)');
  });

  it('picks the dark theme of a pair on a dark terminal', async () => {
    const settings = { preferences: { theme: 'auto' } };
    mocks.loadSettings.mockReturnValue(settings);
    mocks.detectTerminalTheme.mockResolvedValue({ mode: 'dark', detectedBgHex: '#000000' });
    const colors = { accent: '#89b4fa' };
    mocks.loadCustomTheme.mockReturnValue({
      ok: true,
      theme: { name: 'Catppuccin Mocha', appearance: 'dark', bg: '#1e1e2e', colors },
    });
    const ctx = createCtx();

    await handleThemeCommand(ctx, ['catppuccin-latte/catppuccin-mocha']);

    expect(mocks.loadCustomTheme).toHaveBeenCalledWith('catppuccin-mocha');
    expect(mocks.applyThemeMode).toHaveBeenCalledWith('dark', undefined, colors, '#1e1e2e');
    expect(settings.preferences.theme).toBe('catppuccin-latte/catppuccin-mocha');
    expect(ctx.showInfo).toHaveBeenCalledWith('Theme set to Catppuccin Mocha (dark)');
  });

  it('picks the light theme of a pair on a light terminal', async () => {
    mocks.detectTerminalTheme.mockResolvedValue({ mode: 'light', detectedBgHex: '#eff1f5' });
    const colors = { accent: '#1e66f5' };
    mocks.loadCustomTheme.mockReturnValue({
      ok: true,
      theme: { name: 'Catppuccin Latte', appearance: 'light', colors },
    });
    const ctx = createCtx();

    await handleThemeCommand(ctx, ['catppuccin-latte/catppuccin-mocha']);

    expect(mocks.loadCustomTheme).toHaveBeenCalledWith('catppuccin-latte');
    expect(mocks.applyThemeMode).toHaveBeenCalledWith('light', '#eff1f5', colors);
    expect(ctx.showInfo).toHaveBeenCalledWith('Theme set to Catppuccin Latte (light)');
  });

  it('normalizes built-in modes typed in any case', async () => {
    const settings = { preferences: { theme: 'auto' } };
    mocks.loadSettings.mockReturnValue(settings);
    const ctx = createCtx();

    await handleThemeCommand(ctx, ['Dark']);

    expect(mocks.applyThemeMode).toHaveBeenCalledWith('dark');
    expect(settings.preferences.theme).toBe('dark');
  });
});

describe('normalizeThemePreference', () => {
  it('lowercases reserved modes and bundled pairs', () => {
    expect(normalizeThemePreference('AUTO')).toBe('auto');
    expect(normalizeThemePreference('Light')).toBe('light');
    expect(normalizeThemePreference('Catppuccin-Latte/Catppuccin-Mocha')).toBe('catppuccin-latte/catppuccin-mocha');
  });

  it('keeps custom theme names as typed', () => {
    expect(normalizeThemePreference('MyTheme')).toBe('MyTheme');
    expect(normalizeThemePreference('MyLight/MyDark')).toBe('MyLight/MyDark');
  });
});
