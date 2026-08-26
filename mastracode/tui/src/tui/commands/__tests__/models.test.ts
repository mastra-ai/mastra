import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  loadSettings: vi.fn(),
  saveSettings: vi.fn(),
  promptForApiKeyIfNeeded: vi.fn(),
  selectorOptions: undefined as any,
  showModalOverlay: vi.fn(),
}));

vi.mock('@mastra/code-sdk/onboarding/settings', () => ({
  loadSettings: mocks.loadSettings,
  saveSettings: mocks.saveSettings,
  stripMastraCodeCustomProviderPrefix: (modelId: string) => modelId,
  THREAD_ACTIVE_MODEL_PACK_ID_KEY: 'activeModelPackId',
}));

vi.mock('../../components/model-selector.js', () => ({
  ModelSelectorComponent: class {
    focused = false;
    constructor(options: any) {
      mocks.selectorOptions = options;
    }
  },
}));

vi.mock('../../overlay.js', () => ({ showModalOverlay: mocks.showModalOverlay }));
vi.mock('../../prompt-api-key.js', () => ({ promptForApiKeyIfNeeded: mocks.promptForApiKeyIfNeeded }));

import { handleModelCommand } from '../models.js';

describe('handleModelCommand', () => {
  beforeEach(() => {
    mocks.loadSettings.mockReset();
    mocks.saveSettings.mockReset();
    mocks.promptForApiKeyIfNeeded.mockReset();
    mocks.showModalOverlay.mockReset();
    mocks.selectorOptions = undefined;
  });

  it('lists only connected models', async () => {
    const catalogModel = {
      id: 'mastracode/kimi-coding/kimi-for-coding',
      provider: 'mastracode/kimi-coding',
      modelName: 'kimi-for-coding',
      hasApiKey: true,
    };
    const connected = {
      ...catalogModel,
      id: 'kimi-coding/kimi-for-coding',
      provider: 'kimi-coding',
    };
    const unconnected = {
      id: '302ai/claude-opus-4-1',
      provider: '302ai',
      modelName: 'claude-opus-4-1',
      hasApiKey: false,
      apiKeyEnvVar: '302AI_API_KEY',
    };
    mocks.loadSettings.mockReturnValue({
      customProviders: [],
      models: { activeModelPackId: null, modeDefaults: {} },
    });

    const ctx = {
      state: {
        controller: {
          listAvailableModels: vi.fn(async () => [unconnected, catalogModel]),
          invalidateAvailableModelsCache: vi.fn(),
          listModes: vi.fn(() => []),
        },
        session: {
          mode: { get: vi.fn(() => 'build') },
          model: { get: vi.fn(() => connected.id), switch: vi.fn() },
          thread: { setSetting: vi.fn() },
        },
        ui: { hideOverlay: vi.fn() },
      },
      updateStatusLine: vi.fn(),
      showInfo: vi.fn(),
    } as any;

    void handleModelCommand(ctx);
    await vi.waitFor(() => expect(mocks.selectorOptions).toBeDefined());
    expect(mocks.selectorOptions.models).toEqual([connected]);
    expect(ctx.showInfo).not.toHaveBeenCalled();
  });

  it('asks the user to add a provider when no model is connected', async () => {
    const ctx = {
      state: {
        controller: {
          listAvailableModels: vi.fn(async () => [
            {
              id: '302ai/claude-opus-4-1',
              provider: '302ai',
              modelName: 'claude-opus-4-1',
              hasApiKey: false,
              apiKeyEnvVar: '302AI_API_KEY',
            },
          ]),
        },
        session: { model: { get: vi.fn(() => '') } },
      },
      showInfo: vi.fn(),
    } as any;

    await handleModelCommand(ctx);

    expect(ctx.showInfo).toHaveBeenCalledWith('No connected models. Use /login or /api-keys to add a provider.');
    expect(mocks.showModalOverlay).not.toHaveBeenCalled();
  });

  it('invalidates the available-model cache after the API-key prompt completes', async () => {
    const model = {
      id: 'openai/gpt-5.6-sol',
      provider: 'openai',
      modelName: 'gpt-5.6-sol',
      hasApiKey: true,
      apiKeyEnvVar: 'OPENAI_API_KEY',
    };
    const invalidateAvailableModelsCache = vi.fn();
    const switchModel = vi.fn(async () => undefined);
    const setSetting = vi.fn(async () => undefined);
    const mode = { id: 'build', defaultModelId: 'openai/gpt-5.5' };
    const settings = {
      customProviders: [],
      customModelPacks: [] as Array<{ name: string; models: Record<string, string>; createdAt: string }>,
      models: { activeModelPackId: 'openai', modeDefaults: {} as Record<string, string> },
    };
    mocks.loadSettings.mockReturnValue(settings);
    mocks.promptForApiKeyIfNeeded.mockResolvedValue(undefined);

    const ctx = {
      authStorage: {},
      state: {
        controller: {
          listAvailableModels: vi.fn(async () => [model]),
          invalidateAvailableModelsCache,
          listModes: vi.fn(() => [mode]),
        },
        session: {
          mode: { get: vi.fn(() => 'build') },
          model: { get: vi.fn(() => 'anthropic/claude-sonnet-4-6'), switch: switchModel },
          thread: {
            getId: vi.fn(() => 'thread-1'),
            list: vi.fn(async () => [{ id: 'thread-1', metadata: { activeModelPackId: 'openai' } }]),
            setSetting,
          },
        },
        ui: { hideOverlay: vi.fn() },
      },
      updateStatusLine: vi.fn(),
      showInfo: vi.fn(),
    } as any;

    const command = handleModelCommand(ctx);
    await vi.waitFor(() => expect(mocks.selectorOptions).toBeDefined());
    await mocks.selectorOptions.onSelect(model);
    await command;

    expect(mocks.promptForApiKeyIfNeeded).toHaveBeenCalledWith(ctx.state.ui, model, ctx.authStorage);
    expect(invalidateAvailableModelsCache).toHaveBeenCalledTimes(1);
    expect(mocks.promptForApiKeyIfNeeded.mock.invocationCallOrder[0]!).toBeLessThan(
      invalidateAvailableModelsCache.mock.invocationCallOrder[0]!,
    );
    expect(switchModel).toHaveBeenCalledWith({ modelId: model.id });
    expect(mode.defaultModelId).toBe(model.id);
    expect(settings.models.activeModelPackId).toBe('custom:Custom');
    expect(settings.models.modeDefaults).toEqual({ build: model.id });
    expect(settings.customModelPacks[0]).toMatchObject({
      name: 'Custom',
      models: { build: model.id },
    });
    expect(setSetting).toHaveBeenCalledWith({ key: 'activeModelPackId', value: 'custom:Custom' });
    expect(mocks.saveSettings).toHaveBeenCalledWith(settings);
  });
});
