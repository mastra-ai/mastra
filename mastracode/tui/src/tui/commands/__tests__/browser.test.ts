import type { BrowserSettings } from '@mastra/code-sdk/onboarding/settings';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { handleBrowserCommand } from '../browser.js';
import type { SlashCommandContext } from '../types.js';

const browserMocks = vi.hoisted(() => ({
  checkProfileProviderMismatch: vi.fn(),
  createBrowserFromSettings: vi.fn(),
  loadSettings: vi.fn(),
  saveSettings: vi.fn(),
  setProfileProvider: vi.fn(),
  askModalQuestion: vi.fn(),
}));

vi.mock('@mastra/code-sdk/onboarding/settings', () => ({
  checkProfileProviderMismatch: browserMocks.checkProfileProviderMismatch,
  createBrowserFromSettings: browserMocks.createBrowserFromSettings,
  loadSettings: browserMocks.loadSettings,
  saveSettings: browserMocks.saveSettings,
  setProfileProvider: browserMocks.setProfileProvider,
}));

vi.mock('../../modal-question.js', () => ({
  askModalQuestion: browserMocks.askModalQuestion,
}));

function createContext() {
  const browserInstance = { id: 'browser-instance' };
  const staticAgent = { setBrowser: vi.fn() };
  const dynamicAgent = { setBrowser: vi.fn() };
  const controllerState = { mode: 'review' };
  const setState = vi.fn();
  const settings = {
    browser: {
      enabled: false,
      provider: 'stagehand' as const,
      headless: true,
      viewport: { width: 1280, height: 720 } as BrowserSettings['viewport'],
      profile: '/tmp/mastracode-browser-profile',
      stagehand: { env: 'LOCAL' as const },
    },
  };
  const session = {
    state: {
      get: vi.fn(() => controllerState),
      set: setState,
    },
  };
  const controller = {
    session,
    listModes: vi.fn(() => [
      { id: 'build', agent: staticAgent },
      { id: 'review', agent: vi.fn(() => dynamicAgent) },
    ]),
  };
  const ctx = {
    state: {
      session,
      controller,
      ui: {},
    },
    session,
    controller,
    showInfo: vi.fn(),
    showError: vi.fn(),
  } as unknown as SlashCommandContext;

  return { ctx, settings, browserInstance, staticAgent, dynamicAgent, controllerState, setState };
}

describe('handleBrowserCommand', () => {
  beforeEach(() => {
    browserMocks.checkProfileProviderMismatch.mockReset();
    browserMocks.createBrowserFromSettings.mockReset();
    browserMocks.loadSettings.mockReset();
    browserMocks.saveSettings.mockReset();
    browserMocks.setProfileProvider.mockReset();
    browserMocks.askModalQuestion.mockReset();
  });

  it('enables browser settings, attaches the browser to all mode agents, and records active settings', async () => {
    const { ctx, settings, browserInstance, staticAgent, dynamicAgent, controllerState, setState } = createContext();
    browserMocks.loadSettings.mockReturnValue(settings);
    browserMocks.checkProfileProviderMismatch.mockReturnValue(undefined);
    browserMocks.createBrowserFromSettings.mockResolvedValue(browserInstance);

    await handleBrowserCommand(ctx, ['on']);

    const enabledSettings = {
      ...settings.browser,
      enabled: true,
    };
    expect(browserMocks.createBrowserFromSettings).toHaveBeenCalledWith(enabledSettings);
    expect(ctx.controller.listModes).toHaveBeenCalledOnce();
    expect(ctx.state.session.state.get).toHaveBeenCalledOnce();
    expect(staticAgent.setBrowser).toHaveBeenCalledWith(browserInstance);
    expect(dynamicAgent.setBrowser).toHaveBeenCalledWith(browserInstance);
    const dynamicMode = (ctx.controller.listModes as ReturnType<typeof vi.fn>).mock.results[0]?.value[1];
    expect(dynamicMode.agent).toHaveBeenCalledWith(controllerState);
    expect(setState).toHaveBeenCalledWith({ activeBrowserSettings: enabledSettings });
    expect(browserMocks.setProfileProvider).toHaveBeenCalledWith('/tmp/mastracode-browser-profile', 'stagehand');
    expect(browserMocks.saveSettings).toHaveBeenCalledWith(settings);
    expect(settings.browser.enabled).toBe(true);
    expect(ctx.showInfo).toHaveBeenCalledWith('Browser enabled (Stagehand).');
  });

  it('set viewport 1440x900 persists a fixed viewport object', async () => {
    const { ctx, settings } = createContext();
    browserMocks.loadSettings.mockReturnValue(settings);

    await handleBrowserCommand(ctx, ['set', 'viewport', '1440x900']);

    expect(settings.browser.viewport).toEqual({ width: 1440, height: 900 });
    expect(browserMocks.saveSettings).toHaveBeenCalledWith(settings);
    expect(ctx.showError).not.toHaveBeenCalled();
  });

  it("set viewport window persists the 'window' sentinel", async () => {
    const { ctx, settings } = createContext();
    browserMocks.loadSettings.mockReturnValue(settings);

    await handleBrowserCommand(ctx, ['set', 'viewport', 'window']);

    expect(settings.browser.viewport).toBe('window');
    expect(browserMocks.saveSettings).toHaveBeenCalledWith(settings);
    expect(ctx.showError).not.toHaveBeenCalled();
  });

  it("set viewport match is an alias for the 'window' sentinel", async () => {
    const { ctx, settings } = createContext();
    browserMocks.loadSettings.mockReturnValue(settings);

    await handleBrowserCommand(ctx, ['set', 'viewport', 'match']);

    expect(settings.browser.viewport).toBe('window');
    expect(browserMocks.saveSettings).toHaveBeenCalledWith(settings);
  });

  it('set viewport with a bogus value shows an error and does not mutate settings', async () => {
    const { ctx, settings } = createContext();
    browserMocks.loadSettings.mockReturnValue(settings);

    await handleBrowserCommand(ctx, ['set', 'viewport', 'bogus']);

    expect(settings.browser.viewport).toEqual({ width: 1280, height: 720 });
    expect(browserMocks.saveSettings).not.toHaveBeenCalled();
    expect(ctx.showError).toHaveBeenCalled();
  });

  it('set viewport 0x0 is rejected as invalid', async () => {
    const { ctx, settings } = createContext();
    browserMocks.loadSettings.mockReturnValue(settings);

    await handleBrowserCommand(ctx, ['set', 'viewport', '0x0']);

    expect(settings.browser.viewport).toEqual({ width: 1280, height: 720 });
    expect(browserMocks.saveSettings).not.toHaveBeenCalled();
    expect(ctx.showError).toHaveBeenCalled();
  });

  // An unsafe integer must be rejected here, matching the safe-integer check in
  // the persisted-settings path (parseViewport). Otherwise `/browser set` would
  // accept and save a value that is silently reset to the default on reload.
  it('set viewport with an unsafe integer is rejected as invalid', async () => {
    const { ctx, settings } = createContext();
    browserMocks.loadSettings.mockReturnValue(settings);

    await handleBrowserCommand(ctx, ['set', 'viewport', '9999999999999999x720']);

    expect(settings.browser.viewport).toEqual({ width: 1280, height: 720 });
    expect(browserMocks.saveSettings).not.toHaveBeenCalled();
    expect(ctx.showError).toHaveBeenCalled();
  });

  it('clear viewport resets to the 1280x720 default', async () => {
    const { ctx, settings } = createContext();
    settings.browser.viewport = 'window';
    browserMocks.loadSettings.mockReturnValue(settings);

    await handleBrowserCommand(ctx, ['clear', 'viewport']);

    expect(settings.browser.viewport).toEqual({ width: 1280, height: 720 });
    expect(browserMocks.saveSettings).toHaveBeenCalledWith(settings);
  });

  it('status renders a fixed viewport', async () => {
    const { ctx, settings } = createContext();
    settings.browser.enabled = true;
    settings.browser.viewport = { width: 1440, height: 900 };
    browserMocks.loadSettings.mockReturnValue(settings);

    await handleBrowserCommand(ctx, ['status']);

    const output = (ctx.showInfo as ReturnType<typeof vi.fn>).mock.calls.map(c => c[0]).join('\n');
    expect(output).toContain('1440x900');
  });

  it('status renders match window for the window sentinel', async () => {
    const { ctx, settings } = createContext();
    settings.browser.enabled = true;
    settings.browser.viewport = 'window';
    browserMocks.loadSettings.mockReturnValue(settings);

    await handleBrowserCommand(ctx, ['status']);

    const output = (ctx.showInfo as ReturnType<typeof vi.fn>).mock.calls.map(c => c[0]).join('\n');
    expect(output).toContain('match window');
  });
});
