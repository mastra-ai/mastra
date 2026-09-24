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
  resolveStagehandModel: vi.fn(),
  askModalQuestion: vi.fn(),
}));

vi.mock('@mastra/code-sdk/onboarding/settings', async importActual => ({
  // Viewport parsing and presets are pure, so the real implementations run here
  // and keep the command tests honest about what the SDK actually accepts.
  ...(await importActual<typeof import('@mastra/code-sdk/onboarding/settings')>()),
  checkProfileProviderMismatch: browserMocks.checkProfileProviderMismatch,
  createBrowserFromSettings: browserMocks.createBrowserFromSettings,
  loadSettings: browserMocks.loadSettings,
  saveSettings: browserMocks.saveSettings,
  setProfileProvider: browserMocks.setProfileProvider,
  resolveStagehandModel: browserMocks.resolveStagehandModel,
}));

vi.mock('../../modal-question.js', () => ({
  askModalQuestion: browserMocks.askModalQuestion,
}));

const selectorMocks = vi.hoisted(() => ({
  promptForApiKeyIfNeeded: vi.fn(),
  /** Captures the options the command hands to the model picker. */
  lastOptions: undefined as any,
}));

vi.mock('../../components/model-selector.js', () => ({
  ModelSelectorComponent: class {
    constructor(options: any) {
      selectorMocks.lastOptions = options;
    }
  },
}));

vi.mock('../../prompt-api-key.js', () => ({
  promptForApiKeyIfNeeded: selectorMocks.promptForApiKeyIfNeeded,
}));

function createContext() {
  const browserInstance = { id: 'browser-instance' };
  const staticAgent = { setBrowser: vi.fn() };
  const dynamicAgent = { setBrowser: vi.fn() };
  const controllerState = { mode: 'review' };
  const setState = vi.fn();
  const settings: { browser: BrowserSettings } = {
    browser: {
      enabled: false,
      provider: 'stagehand',
      headless: true,
      viewport: { width: 1280, height: 720 },
      profile: '/tmp/mastracode-browser-profile',
      stagehand: { env: 'LOCAL' },
    },
  };
  const session = {
    state: {
      get: vi.fn(() => controllerState),
      set: setState,
    },
    model: { get: vi.fn(() => 'anthropic/claude-sonnet-4-5') },
  };
  const controller = {
    session,
    listAvailableModels: vi.fn(async () => [
      { id: 'anthropic/claude-sonnet-4-5', provider: 'anthropic', modelName: 'claude-sonnet-4-5', hasApiKey: true },
      { id: 'openai/gpt-4.1', provider: 'openai', modelName: 'gpt-4.1', hasApiKey: false },
      // Not a provider Stagehand can resolve, so it must not be offered.
      { id: 'mastra/some-model', provider: 'mastra', modelName: 'some-model', hasApiKey: true },
    ]),
    listModes: vi.fn(() => [
      { id: 'build', agent: staticAgent },
      { id: 'review', agent: vi.fn(() => dynamicAgent) },
    ]),
  };
  const ctx = {
    state: {
      session,
      controller,
      ui: { showOverlay: vi.fn(), hideOverlay: vi.fn() },
    },
    session,
    controller,
    showInfo: vi.fn(),
    showError: vi.fn(),
  } as unknown as SlashCommandContext;

  return { ctx, settings, browserInstance, staticAgent, dynamicAgent, controllerState, setState };
}

/** The picker is built after an async model lookup, so wait for it to appear. */
async function openedPicker() {
  await vi.waitFor(() => expect(selectorMocks.lastOptions).toBeDefined());
  return selectorMocks.lastOptions;
}

describe('handleBrowserCommand', () => {
  beforeEach(() => {
    browserMocks.checkProfileProviderMismatch.mockReset();
    browserMocks.createBrowserFromSettings.mockReset();
    browserMocks.loadSettings.mockReset();
    browserMocks.saveSettings.mockReset();
    browserMocks.setProfileProvider.mockReset();
    browserMocks.askModalQuestion.mockReset();
    browserMocks.resolveStagehandModel.mockReset();
    // Default: honor a configured model, otherwise Stagehand's own default. Tests
    // that need the Codex fallback override this so the real auth store is never read.
    browserMocks.resolveStagehandModel.mockImplementation((s: { stagehand?: { model?: string } }) =>
      s.stagehand?.model
        ? { modelName: s.stagehand.model, source: 'settings', viaCodexOAuth: false }
        : { modelName: undefined, source: 'stagehand-default', viaCodexOAuth: false },
    );
    selectorMocks.promptForApiKeyIfNeeded.mockReset();
    selectorMocks.lastOptions = undefined;
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
    // The chat model at launch is passed along so Stagehand can reuse it.
    expect(browserMocks.createBrowserFromSettings).toHaveBeenCalledWith(enabledSettings, {
      chatModelId: 'anthropic/claude-sonnet-4-5',
    });
    expect(ctx.controller.listModes).toHaveBeenCalledOnce();
    expect(ctx.state.session.state.get).toHaveBeenCalledOnce();
    expect(staticAgent.setBrowser).toHaveBeenCalledWith(browserInstance);
    expect(dynamicAgent.setBrowser).toHaveBeenCalledWith(browserInstance);
    const dynamicMode = (ctx.controller.listModes as ReturnType<typeof vi.fn>).mock.results[0]?.value[1];
    expect(dynamicMode.agent).toHaveBeenCalledWith(controllerState);
    expect(browserMocks.resolveStagehandModel).toHaveBeenCalledWith(enabledSettings, {
      chatModelId: 'anthropic/claude-sonnet-4-5',
    });
    expect(setState).toHaveBeenCalledWith({
      activeBrowserSettings: enabledSettings,
      activeBrowserModel: { modelName: undefined, source: 'stagehand-default', viaCodexOAuth: false },
    });
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

    it('rejects a provider Stagehand cannot resolve, before the browser tries to start', async () => {
      const { ctx, settings } = createContext();
      browserMocks.loadSettings.mockReturnValue(settings);

      await handleBrowserCommand(ctx, ['set', 'model', 'notaprovider/some-model']);

      expect(browserMocks.saveSettings).not.toHaveBeenCalled();
      expect(ctx.showError).toHaveBeenCalledWith(expect.stringContaining('Unsupported model provider: notaprovider'));
    });

    it('rejects model on the agent-browser provider, which has no model to configure', async () => {
      const { ctx, settings } = createContext();
      settings.browser.provider = 'agent-browser' as never;
      browserMocks.loadSettings.mockReturnValue(settings);

      await handleBrowserCommand(ctx, ['set', 'model', 'anthropic/claude-sonnet-4-5']);

      expect(browserMocks.saveSettings).not.toHaveBeenCalled();
      expect(ctx.showError).toHaveBeenCalledWith('model is only supported by the stagehand provider.');
    });

    it('rejects the model picker on the agent-browser provider without listing any models', async () => {
      const { ctx, settings } = createContext();
      settings.browser.provider = 'agent-browser' as never;
      browserMocks.loadSettings.mockReturnValue(settings);

      await handleBrowserCommand(ctx, ['set', 'model']);

      expect(ctx.state.controller.listAvailableModels).not.toHaveBeenCalled();
      expect(selectorMocks.lastOptions).toBeUndefined();
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

    it('opens a picker when no model is given, offering only Stagehand-resolvable providers', async () => {
      const { ctx, settings } = createContext();
      browserMocks.loadSettings.mockReturnValue(settings);

      const command = handleBrowserCommand(ctx, ['set', 'model']);
      await openedPicker();

      expect(ctx.state.ui.showOverlay).toHaveBeenCalled();
      expect(selectorMocks.lastOptions.models.map((m: { id: string }) => m.id)).toEqual([
        'anthropic/claude-sonnet-4-5',
        'openai/gpt-4.1',
      ]);
      expect(ctx.showError).not.toHaveBeenCalled();

      selectorMocks.lastOptions.onCancel();
      await command;
    });

    it('saves the picked model and prompts for a missing API key', async () => {
      const { ctx, settings } = createContext();
      browserMocks.loadSettings.mockReturnValue(settings);

      const command = handleBrowserCommand(ctx, ['set', 'model']);
      await openedPicker();
      const picked = { id: 'openai/gpt-4.1', provider: 'openai', modelName: 'gpt-4.1', hasApiKey: false };
      await selectorMocks.lastOptions.onSelect(picked);
      await command;

      expect(selectorMocks.promptForApiKeyIfNeeded).toHaveBeenCalledWith(ctx.state.ui, picked, ctx.authStorage);
      expect(settings.browser.stagehand).toEqual({ env: 'LOCAL', model: 'openai/gpt-4.1' });
      expect(browserMocks.saveSettings).toHaveBeenCalledWith(settings);
    });

    it('rejects a freely typed id for an unsupported provider, which the picker also accepts', async () => {
      const { ctx, settings } = createContext();
      browserMocks.loadSettings.mockReturnValue(settings);

      const command = handleBrowserCommand(ctx, ['set', 'model']);
      await openedPicker();
      // The selector lets the user type any id and select it as "Use: <id>",
      // so the filtered list alone does not keep bad providers out.
      await selectorMocks.lastOptions.onSelect({
        id: '302ai/some-model',
        provider: '302ai',
        modelName: 'some-model',
        hasApiKey: true,
      });
      await command;

      expect(settings.browser.stagehand).toEqual({ env: 'LOCAL' });
      expect(browserMocks.saveSettings).not.toHaveBeenCalled();
      expect(selectorMocks.promptForApiKeyIfNeeded).not.toHaveBeenCalled();
      expect(ctx.showError).toHaveBeenCalledWith(expect.stringContaining('Unsupported model provider: 302ai'));
    });

    it('leaves the model untouched when the picker is cancelled', async () => {
      const { ctx, settings } = createContext();
      browserMocks.loadSettings.mockReturnValue(settings);

      const command = handleBrowserCommand(ctx, ['set', 'model']);
      await openedPicker();
      selectorMocks.lastOptions.onCancel();
      await command;

      expect(settings.browser.stagehand).toEqual({ env: 'LOCAL' });
      expect(browserMocks.saveSettings).not.toHaveBeenCalled();
    });

    it('preselects the current model so the picker opens on it', async () => {
      const { ctx, settings } = createContext();
      settings.browser.stagehand = { env: 'LOCAL', model: 'anthropic/claude-sonnet-4-5' } as never;
      browserMocks.loadSettings.mockReturnValue(settings);

      const command = handleBrowserCommand(ctx, ['set', 'model']);
      await openedPicker();

      expect(selectorMocks.lastOptions.currentModelId).toBe('anthropic/claude-sonnet-4-5');

      selectorMocks.lastOptions.onCancel();
      await command;
    });

    it('falls back to guidance when no supported model is available to pick', async () => {
      const { ctx, settings } = createContext();
      browserMocks.loadSettings.mockReturnValue(settings);
      (ctx.state.controller.listAvailableModels as ReturnType<typeof vi.fn>).mockResolvedValue([
        { id: 'mastra/some-model', provider: 'mastra', modelName: 'some-model', hasApiKey: true },
      ]);

      await handleBrowserCommand(ctx, ['set', 'model']);

      expect(ctx.state.ui.showOverlay).not.toHaveBeenCalled();
      expect(ctx.showError).toHaveBeenCalledWith(expect.stringContaining('No models available for Stagehand'));
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

  describe('status model line', () => {
    function statusOutput(ctx: SlashCommandContext): string {
      return (ctx.showInfo as ReturnType<typeof vi.fn>).mock.calls[0]![0];
    }

    it('shows the configured model', async () => {
      const { ctx, settings } = createContext();
      settings.browser.enabled = true;
      browserMocks.loadSettings.mockReturnValue(settings);
      browserMocks.resolveStagehandModel.mockReturnValue({
        modelName: 'anthropic/claude-sonnet-4-5',
        source: 'settings',
        viaCodexOAuth: false,
      });

      await handleBrowserCommand(ctx, ['status']);

      expect(statusOutput(ctx)).toContain('Model: anthropic/claude-sonnet-4-5\n');
    });

    it('marks a configured openai/* model that will go through the Codex login', async () => {
      const { ctx, settings } = createContext();
      settings.browser.enabled = true;
      browserMocks.loadSettings.mockReturnValue(settings);
      browserMocks.resolveStagehandModel.mockReturnValue({
        modelName: 'openai/gpt-5.5',
        source: 'settings',
        viaCodexOAuth: true,
      });

      await handleBrowserCommand(ctx, ['status']);

      expect(statusOutput(ctx)).toContain('Model: openai/gpt-5.5 (via OpenAI Codex login)');
    });

    it('shows when the chat model at launch is reused, resolving with that chat model', async () => {
      const { ctx, settings } = createContext();
      settings.browser.enabled = true;
      browserMocks.loadSettings.mockReturnValue(settings);
      browserMocks.resolveStagehandModel.mockReturnValue({
        modelName: 'anthropic/claude-sonnet-4-5',
        source: 'chat-model',
        viaCodexOAuth: false,
      });

      await handleBrowserCommand(ctx, ['status']);

      expect(statusOutput(ctx)).toContain('Model: anthropic/claude-sonnet-4-5 (current chat model; override with');
      expect(browserMocks.resolveStagehandModel).toHaveBeenCalledWith(settings.browser, {
        chatModelId: 'anthropic/claude-sonnet-4-5',
      });
    });

    it('reveals the implicit Codex default so users know which model is really running', async () => {
      const { ctx, settings } = createContext();
      settings.browser.enabled = true;
      browserMocks.loadSettings.mockReturnValue(settings);
      browserMocks.resolveStagehandModel.mockReturnValue({
        modelName: 'openai/gpt-5.6-sol',
        source: 'codex-oauth',
        viaCodexOAuth: true,
      });

      await handleBrowserCommand(ctx, ['status']);

      expect(statusOutput(ctx)).toContain('Model: openai/gpt-5.6-sol (OpenAI Codex login default');
    });

    it('points at /browser set model when Stagehand is left on its own default', async () => {
      const { ctx, settings } = createContext();
      settings.browser.enabled = true;
      browserMocks.loadSettings.mockReturnValue(settings);

      await handleBrowserCommand(ctx, ['status']);

      expect(statusOutput(ctx)).toContain('Model: Stagehand default (set one with /browser set model)');
    });

    it('omits the model line for agent-browser, which has no model', async () => {
      const { ctx, settings } = createContext();
      settings.browser.enabled = true;
      (settings.browser as any).provider = 'agent-browser';
      browserMocks.loadSettings.mockReturnValue(settings);

      await handleBrowserCommand(ctx, ['status']);

      expect(statusOutput(ctx)).not.toContain('Model:');
    });

    it('still shows the model after /browser clear removed the stagehand block', async () => {
      const { ctx, settings } = createContext();
      settings.browser.enabled = true;
      delete (settings.browser as any).stagehand;
      browserMocks.loadSettings.mockReturnValue(settings);
      browserMocks.resolveStagehandModel.mockReturnValue({
        modelName: 'openai/gpt-5.5',
        source: 'codex-oauth',
        viaCodexOAuth: true,
      });

      await handleBrowserCommand(ctx, ['status']);

      expect(statusOutput(ctx)).not.toContain('Environment:');
      expect(statusOutput(ctx)).toContain('Model: openai/gpt-5.5');
    });

    it('reports the model the active browser launched with, not what current credentials would resolve to', async () => {
      const { ctx, settings } = createContext();
      settings.browser.enabled = true;
      settings.browser.stagehand = { env: 'LOCAL', model: 'anthropic/claude-sonnet-4-5' };
      browserMocks.loadSettings.mockReturnValue(settings);
      // Launched while the model was still the Codex fallback; the file has since changed.
      const controllerState = ctx.state.session.state.get() as Record<string, unknown>;
      controllerState.activeBrowserSettings = { ...structuredClone(settings.browser), stagehand: { env: 'LOCAL' } };
      controllerState.activeBrowserModel = { modelName: 'openai/gpt-5.5', source: 'codex-oauth', viaCodexOAuth: true };

      await handleBrowserCommand(ctx, ['status']);

      const out = statusOutput(ctx);
      const active = out.slice(out.indexOf('Browser (active):'), out.indexOf('Pending changes'));
      const pending = out.slice(out.indexOf('Pending changes'));
      expect(active).toContain('Model: openai/gpt-5.5 (OpenAI Codex login default');
      expect(pending).toContain('Model: anthropic/claude-sonnet-4-5');
    });

    it('uses the launch-time model in the no-drift status too, ignoring later credential changes', async () => {
      const { ctx, settings } = createContext();
      settings.browser.enabled = true;
      browserMocks.loadSettings.mockReturnValue(settings);
      const controllerState = ctx.state.session.state.get() as Record<string, unknown>;
      controllerState.activeBrowserSettings = structuredClone(settings.browser);
      controllerState.activeBrowserModel = { modelName: 'openai/gpt-5.5', source: 'codex-oauth', viaCodexOAuth: true };
      // Simulates signing out of Codex after launch: a fresh resolve would say "Stagehand default".
      browserMocks.resolveStagehandModel.mockReturnValue({
        modelName: undefined,
        source: 'stagehand-default',
        viaCodexOAuth: false,
      });

      await handleBrowserCommand(ctx, ['status']);

      const out = statusOutput(ctx);
      expect(out).not.toContain('Pending changes');
      expect(out).toContain('Model: openai/gpt-5.5 (OpenAI Codex login default');
    });

    it('never stores the Browserbase API key in session state', async () => {
      const { ctx, settings, setState } = createContext();
      settings.browser.enabled = true;
      settings.browser.stagehand = { env: 'BROWSERBASE', apiKey: 'bb-secret', projectId: 'proj' };
      browserMocks.loadSettings.mockReturnValue(settings);

      await handleBrowserCommand(ctx, ['on']);

      const stored = setState.mock.calls.at(-1)?.[0] as { activeBrowserSettings?: BrowserSettings };
      expect(stored.activeBrowserSettings?.stagehand).toEqual({ env: 'BROWSERBASE', projectId: 'proj' });
      expect(JSON.stringify(stored)).not.toContain('bb-secret');
    });

    it('accepts info as an alias for status', async () => {
      const { ctx, settings } = createContext();
      settings.browser.enabled = true;
      browserMocks.loadSettings.mockReturnValue(settings);
      browserMocks.resolveStagehandModel.mockReturnValue({
        modelName: 'openai/gpt-5.5',
        source: 'codex-oauth',
        viaCodexOAuth: true,
      });

      await handleBrowserCommand(ctx, ['info']);

      expect(statusOutput(ctx)).toContain('Browser: enabled');
      expect(statusOutput(ctx)).toContain('Model: openai/gpt-5.5');
    });
  });

  describe('viewport', () => {
    it('sets explicit dimensions', async () => {
      const { ctx, settings } = createContext();
      browserMocks.loadSettings.mockReturnValue(settings);

      await handleBrowserCommand(ctx, ['set', 'viewport', '1600x1000']);

      expect(settings.browser.viewport).toEqual({ width: 1600, height: 1000 });
      expect(browserMocks.saveSettings).toHaveBeenCalledWith(settings);
      expect(ctx.showInfo).toHaveBeenCalledWith(expect.stringContaining('Set viewport = 1600x1000'));
    });

    it('sets a named preset', async () => {
      const { ctx, settings } = createContext();
      browserMocks.loadSettings.mockReturnValue(settings);

      await handleBrowserCommand(ctx, ['set', 'viewport', 'desktop-hd']);

      expect(settings.browser.viewport).toEqual({ width: 1920, height: 1080 });
    });

    it('rejects an unparseable size without writing settings', async () => {
      const { ctx, settings } = createContext();
      browserMocks.loadSettings.mockReturnValue(settings);

      await handleBrowserCommand(ctx, ['set', 'viewport', '1280']);

      expect(browserMocks.saveSettings).not.toHaveBeenCalled();
      expect(settings.browser.viewport).toEqual({ width: 1280, height: 720 });
      expect(ctx.showError).toHaveBeenCalledWith(expect.stringContaining('Invalid viewport: 1280'));
    });

    // Stagehand overwrites an absent viewport with its own default when it
    // launches the browser, so 'window' would silently do nothing there.
    it('rejects window when stagehand launches its own browser', async () => {
      const { ctx, settings } = createContext();
      browserMocks.loadSettings.mockReturnValue(settings);

      await handleBrowserCommand(ctx, ['set', 'viewport', 'window']);

      expect(browserMocks.saveSettings).not.toHaveBeenCalled();
      expect(ctx.showError).toHaveBeenCalledWith(expect.stringContaining('viewport window is not supported'));
    });

    it('accepts window when stagehand connects over cdpUrl', async () => {
      const { ctx, settings } = createContext();
      settings.browser.cdpUrl = 'http://localhost:9222';
      browserMocks.loadSettings.mockReturnValue(settings);

      await handleBrowserCommand(ctx, ['set', 'viewport', 'window']);

      expect(settings.browser.viewport).toBe('window');
    });

    it('accepts window on the agent-browser provider', async () => {
      const { ctx, settings } = createContext();
      settings.browser.provider = 'agent-browser';
      browserMocks.loadSettings.mockReturnValue(settings);

      await handleBrowserCommand(ctx, ['set', 'viewport', 'window']);

      expect(settings.browser.viewport).toBe('window');
    });

    it('opens a preset picker when the value is omitted', async () => {
      const { ctx, settings } = createContext();
      browserMocks.loadSettings.mockReturnValue(settings);
      browserMocks.askModalQuestion.mockResolvedValue('tablet');

      await handleBrowserCommand(ctx, ['set', 'viewport']);

      const options = browserMocks.askModalQuestion.mock.calls[0]![1].options as Array<{ label: string }>;
      // 'window' cannot be honored by a locally launched Stagehand, so it is
      // withheld rather than offered and then rejected.
      expect(options.map(option => option.label)).toEqual([
        'desktop',
        'desktop-hd',
        'laptop',
        'tablet',
        'mobile',
        'custom',
      ]);
      expect(settings.browser.viewport).toEqual({ width: 768, height: 1024 });
    });

    it('offers window in the picker when the provider can honor it', async () => {
      const { ctx, settings } = createContext();
      settings.browser.provider = 'agent-browser';
      browserMocks.loadSettings.mockReturnValue(settings);
      browserMocks.askModalQuestion.mockResolvedValue('window');

      await handleBrowserCommand(ctx, ['set', 'viewport']);

      const options = browserMocks.askModalQuestion.mock.calls[0]![1].options as Array<{ label: string }>;
      expect(options.map(option => option.label)).toContain('window');
      expect(settings.browser.viewport).toBe('window');
    });

    it('prompts for a custom size when custom is picked', async () => {
      const { ctx, settings } = createContext();
      browserMocks.loadSettings.mockReturnValue(settings);
      browserMocks.askModalQuestion.mockResolvedValueOnce('custom').mockResolvedValueOnce('1440x900');

      await handleBrowserCommand(ctx, ['set', 'viewport']);

      expect(settings.browser.viewport).toEqual({ width: 1440, height: 900 });
    });

    it('leaves the viewport untouched when the picker is cancelled', async () => {
      const { ctx, settings } = createContext();
      browserMocks.loadSettings.mockReturnValue(settings);
      browserMocks.askModalQuestion.mockResolvedValue(null);

      await handleBrowserCommand(ctx, ['set', 'viewport']);

      expect(browserMocks.saveSettings).not.toHaveBeenCalled();
      expect(settings.browser.viewport).toEqual({ width: 1280, height: 720 });
    });

    it('restores the default on clear', async () => {
      const { ctx, settings } = createContext();
      settings.browser.viewport = 'window' as never;
      browserMocks.loadSettings.mockReturnValue(settings);

      await handleBrowserCommand(ctx, ['clear', 'viewport']);

      expect(settings.browser.viewport).toEqual({ width: 1280, height: 720 });
      expect(browserMocks.saveSettings).toHaveBeenCalledWith(settings);
    });

    it('shows the viewport in status', async () => {
      const { ctx, settings } = createContext();
      settings.browser.enabled = true;
      settings.browser.viewport = { width: 1600, height: 1000 };
      browserMocks.loadSettings.mockReturnValue(settings);

      await handleBrowserCommand(ctx, ['status']);

      expect((ctx.showInfo as ReturnType<typeof vi.fn>).mock.calls[0]![0]).toContain('Viewport: 1600x1000');
    });

    it('reports a viewport change as pending so the running browser is not silently stale', async () => {
      const { ctx, settings, controllerState } = createContext();
      settings.browser.enabled = true;
      (controllerState as Record<string, unknown>).activeBrowserSettings = { ...settings.browser };
      settings.browser.viewport = { width: 1600, height: 1000 };
      browserMocks.loadSettings.mockReturnValue(settings);

      await handleBrowserCommand(ctx, ['status']);

      const output = (ctx.showInfo as ReturnType<typeof vi.fn>).mock.calls[0]![0] as string;
      expect(output).toContain('Pending changes (not yet applied):');
      expect(output).toContain('Viewport: 1600x1000');
    });

    it('does not report drift when the active snapshot matches the file, including profile and model', async () => {
      const { ctx, settings, controllerState } = createContext();
      settings.browser = {
        ...settings.browser,
        enabled: true,
        profile: '/tmp/profile',
        stagehand: { env: 'LOCAL', model: 'anthropic/claude-sonnet-4-5', preserveUserDataDir: true },
      };
      (controllerState as Record<string, unknown>).activeBrowserSettings = structuredClone(settings.browser);
      browserMocks.loadSettings.mockReturnValue(settings);

      await handleBrowserCommand(ctx, ['status']);

      const output = (ctx.showInfo as ReturnType<typeof vi.fn>).mock.calls[0]![0] as string;
      expect(output).not.toContain('Pending changes');
      expect(output).toContain('Browser: enabled');
      expect(output).toContain('Profile: /tmp/profile');
    });

    /** Enabled, profile-less Stagehand settings snapshotted as active; the caller then mutates the file copy. */
    function activeWithoutProfile() {
      const context = createContext();
      context.settings.browser = {
        ...context.settings.browser,
        enabled: true,
        profile: undefined,
        scope: 'shared',
        stagehand: { env: 'LOCAL', preserveUserDataDir: false },
      };
      (context.controllerState as Record<string, unknown>).activeBrowserSettings = structuredClone(
        context.settings.browser,
      );
      browserMocks.loadSettings.mockReturnValue(context.settings);
      return context;
    }

    it('reports a scope change as pending since it changes the launched browser', async () => {
      const { ctx, settings } = activeWithoutProfile();
      settings.browser.scope = 'thread';

      await handleBrowserCommand(ctx, ['status']);

      expect((ctx.showInfo as ReturnType<typeof vi.fn>).mock.calls[0]![0]).toContain(
        'Pending changes (not yet applied):',
      );
    });

    it('reports a preserveUserDataDir change as pending since it changes the launched browser', async () => {
      const { ctx, settings } = activeWithoutProfile();
      settings.browser.stagehand = { env: 'LOCAL', preserveUserDataDir: true };

      await handleBrowserCommand(ctx, ['status']);

      expect((ctx.showInfo as ReturnType<typeof vi.fn>).mock.calls[0]![0]).toContain(
        'Pending changes (not yet applied):',
      );
    });

    it('ignores a scope change when a profile forces shared scope anyway', async () => {
      const { ctx, settings, controllerState } = createContext();
      settings.browser = { ...settings.browser, enabled: true, profile: '/tmp/profile', scope: 'shared' };
      (controllerState as Record<string, unknown>).activeBrowserSettings = structuredClone(settings.browser);
      settings.browser.scope = 'thread';
      browserMocks.loadSettings.mockReturnValue(settings);

      await handleBrowserCommand(ctx, ['status']);

      expect((ctx.showInfo as ReturnType<typeof vi.fn>).mock.calls[0]![0]).not.toContain('Pending changes');
    });

    it('ignores a model respelling that Codex OAuth remaps to the launched model anyway', async () => {
      const { ctx, settings, controllerState } = activeWithoutProfile();
      settings.browser.stagehand = { env: 'LOCAL', preserveUserDataDir: false, model: 'openai/gpt-5.3-codex' };
      (controllerState as Record<string, unknown>).activeBrowserSettings = structuredClone(settings.browser);
      (controllerState as Record<string, unknown>).activeBrowserModel = {
        modelName: 'openai/gpt-5.3-codex',
        source: 'settings',
        viaCodexOAuth: true,
      };
      // The file now says gpt-5.3, which createBrowserFromSettings remaps to gpt-5.3-codex over Codex.
      settings.browser.stagehand.model = 'openai/gpt-5.3';
      browserMocks.resolveStagehandModel.mockReturnValue({
        modelName: 'openai/gpt-5.3',
        source: 'settings',
        viaCodexOAuth: true,
      });

      await handleBrowserCommand(ctx, ['status']);

      expect((ctx.showInfo as ReturnType<typeof vi.fn>).mock.calls[0]![0]).not.toContain('Pending changes');
    });

    it('still reports a model respelling as pending without Codex OAuth, since those are different API models', async () => {
      const { ctx, settings, controllerState } = activeWithoutProfile();
      settings.browser.stagehand = { env: 'LOCAL', preserveUserDataDir: false, model: 'openai/gpt-5.3-codex' };
      (controllerState as Record<string, unknown>).activeBrowserSettings = structuredClone(settings.browser);
      (controllerState as Record<string, unknown>).activeBrowserModel = {
        modelName: 'openai/gpt-5.3-codex',
        source: 'settings',
        viaCodexOAuth: false,
      };
      settings.browser.stagehand.model = 'openai/gpt-5.3';
      browserMocks.resolveStagehandModel.mockReturnValue({
        modelName: 'openai/gpt-5.3',
        source: 'settings',
        viaCodexOAuth: false,
      });

      await handleBrowserCommand(ctx, ['status']);

      expect((ctx.showInfo as ReturnType<typeof vi.fn>).mock.calls[0]![0]).toContain(
        'Pending changes (not yet applied):',
      );
    });
  });
});
