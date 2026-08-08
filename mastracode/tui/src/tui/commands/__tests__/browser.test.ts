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
      viewport: { width: 1280, height: 720 },
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

  describe('set model', () => {
    it('persists a provider-qualified model onto the stagehand settings', async () => {
      const { ctx, settings } = createContext();
      browserMocks.loadSettings.mockReturnValue(settings);

      await handleBrowserCommand(ctx, ['set', 'model', 'anthropic/claude-sonnet-4-5']);

      expect(settings.browser.stagehand).toEqual({ env: 'LOCAL', model: 'anthropic/claude-sonnet-4-5' });
      expect(browserMocks.saveSettings).toHaveBeenCalledWith(settings);
      expect(ctx.showError).not.toHaveBeenCalled();
    });

    it.each(['claude-sonnet-4-5', '/claude-sonnet-4-5', 'anthropic/'])(
      'rejects %s because Stagehand cannot resolve a provider from it',
      async invalid => {
        const { ctx, settings } = createContext();
        browserMocks.loadSettings.mockReturnValue(settings);

        await handleBrowserCommand(ctx, ['set', 'model', invalid]);

        expect(settings.browser.stagehand).toEqual({ env: 'LOCAL' });
        expect(browserMocks.saveSettings).not.toHaveBeenCalled();
        expect(ctx.showError).toHaveBeenCalledWith(expect.stringContaining('<provider>/<model>'));
      },
    );

    it('rejects model on the agent-browser provider, which has no model to configure', async () => {
      const { ctx, settings } = createContext();
      settings.browser.provider = 'agent-browser' as never;
      browserMocks.loadSettings.mockReturnValue(settings);

      await handleBrowserCommand(ctx, ['set', 'model', 'anthropic/claude-sonnet-4-5']);

      expect(browserMocks.saveSettings).not.toHaveBeenCalled();
      expect(ctx.showError).toHaveBeenCalledWith('model is only supported by the stagehand provider.');
    });

    it('clears the model without disturbing the rest of the stagehand settings', async () => {
      const { ctx, settings } = createContext();
      settings.browser.stagehand = { env: 'LOCAL', model: 'anthropic/claude-sonnet-4-5' } as never;
      browserMocks.loadSettings.mockReturnValue(settings);

      await handleBrowserCommand(ctx, ['clear', 'model']);

      expect(settings.browser.stagehand).toEqual({ env: 'LOCAL' });
      expect(browserMocks.saveSettings).toHaveBeenCalledWith(settings);
    });

    it('reports a model change as pending so the running browser is not silently stale', async () => {
      const { ctx, settings, controllerState } = createContext();
      settings.browser.enabled = true;
      (controllerState as Record<string, unknown>).activeBrowserSettings = {
        ...settings.browser,
        stagehand: { env: 'LOCAL' },
      };
      settings.browser.stagehand = { env: 'LOCAL', model: 'anthropic/claude-sonnet-4-5' } as never;
      browserMocks.loadSettings.mockReturnValue(settings);

      await handleBrowserCommand(ctx, ['status']);

      const output = (ctx.showInfo as ReturnType<typeof vi.fn>).mock.calls[0]![0] as string;
      expect(output).toContain('Pending changes (not yet applied):');
      expect(output).toContain('Model: anthropic/claude-sonnet-4-5');
    });
  });
});
