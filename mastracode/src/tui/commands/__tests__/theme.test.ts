import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  loadSettings: vi.fn(),
  saveSettings: vi.fn(),
  detectTerminalTheme: vi.fn(),
  applyThemeMode: vi.fn(),
  getThemeMode: vi.fn(),
}));

vi.mock('../../../onboarding/settings.js', () => ({
  loadSettings: mocks.loadSettings,
  saveSettings: mocks.saveSettings,
}));

vi.mock('../../detect-theme.js', () => ({
  detectTerminalTheme: mocks.detectTerminalTheme,
}));

vi.mock('../../theme.js', () => ({
  applyThemeMode: mocks.applyThemeMode,
  getThemeMode: mocks.getThemeMode,
}));

import { handleThemeCommand } from '../theme.js';

function createCtx() {
  return {
    showInfo: vi.fn(),
    showError: vi.fn(),
    state: {
      ui: {
        requestRender: vi.fn(),
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
  });

  it('shows current theme mode and persisted preference without changing state', async () => {
    mocks.loadSettings.mockReturnValue({ preferences: { theme: 'light' } });
    mocks.getThemeMode.mockReturnValue('dark');
    const ctx = createCtx();

    await handleThemeCommand(ctx, []);

    expect(ctx.showInfo).toHaveBeenCalledWith('Theme: dark (preference: light)');
    expect(mocks.saveSettings).not.toHaveBeenCalled();
    expect(mocks.applyThemeMode).not.toHaveBeenCalled();
    expect(ctx.state.ui.requestRender).not.toHaveBeenCalled();
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

  it('rejects invalid theme values without persisting or rendering', async () => {
    const ctx = createCtx();

    await handleThemeCommand(ctx, ['neon']);

    expect(ctx.showError).toHaveBeenCalledWith('Usage: /theme [auto|dark|light]');
    expect(mocks.loadSettings).not.toHaveBeenCalled();
    expect(mocks.saveSettings).not.toHaveBeenCalled();
    expect(mocks.applyThemeMode).not.toHaveBeenCalled();
    expect(ctx.state.ui.requestRender).not.toHaveBeenCalled();
  });
});
