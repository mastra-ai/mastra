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
    const connected = {
      id: 'anthropic/claude-fable-5',
      provider: 'anthropic',
      modelName: 'claude-fable-5',
      hasApiKey: true,
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
          listAvailableModels: vi.fn(async () => [unconnected, connected]),
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
    const threadSettings: Record<string, unknown> = { activeModelPackId: 'openai' };
    const setSetting = vi.fn(async ({ key, value }: { key: string; value: unknown }) => {
      threadSettings[key] = value;
    });
    const getSetting = vi.fn(async ({ key }: { key: string }) => threadSettings[key]);
    const modes = [
      { id: 'build', defaultModelId: 'openai/gpt-5.5' },
      { id: 'plan', defaultModelId: 'openai/gpt-5.5' },
      { id: 'fast', defaultModelId: 'openai/gpt-5.4-mini' },
    ];
    const mode = modes[0]!;
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
          listModes: vi.fn(() => modes),
        },
        session: {
          mode: { get: vi.fn(() => 'build') },
          model: { get: vi.fn(() => 'anthropic/claude-sonnet-4-6'), switch: switchModel },
          thread: {
            getId: vi.fn(() => 'thread-1'),
            list: vi.fn(async () => [{ id: 'thread-1', metadata: { ...threadSettings } }]),
            setSetting,
            getSetting,
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
    expect(switchModel).toHaveBeenCalledWith({ modelId: model.id, scope: 'global' });
    expect(mode.defaultModelId).toBe(model.id);
    const savedSettings = mocks.saveSettings.mock.calls[0]![0];
    expect(savedSettings.models.activeModelPackId).toBe('custom:Custom');
    expect(savedSettings.models.modeDefaults).toEqual({
      build: model.id,
      plan: 'openai/gpt-5.5',
      fast: 'openai/gpt-5.4-mini',
    });
    expect(savedSettings.customModelPacks[0]).toMatchObject({
      name: 'Custom',
      models: {
        build: model.id,
        plan: 'openai/gpt-5.5',
        fast: 'openai/gpt-5.4-mini',
      },
    });
    expect(setSetting).toHaveBeenNthCalledWith(1, { key: 'modeModelId_build', value: model.id });
    expect(setSetting).toHaveBeenNthCalledWith(2, { key: 'activeModelPackId', value: 'custom:Custom' });
  });

  it('rolls back thread settings when global settings persistence fails', async () => {
    const model = {
      id: 'openai/gpt-5.6-sol',
      provider: 'openai',
      modelName: 'gpt-5.6-sol',
      hasApiKey: true,
    };
    const previousModelId = 'openai/gpt-5.5';
    const threadSettings: Record<string, unknown> = {
      modeModelId_build: previousModelId,
      activeModelPackId: 'openai',
    };
    const setSetting = vi.fn(async ({ key, value }: { key: string; value: unknown }) => {
      threadSettings[key] = value;
    });
    const getSetting = vi.fn(async ({ key }: { key: string }) => threadSettings[key]);
    const switchModel = vi.fn(async () => undefined);
    const settings = {
      customProviders: [],
      customModelPacks: [],
      models: { activeModelPackId: 'openai', modeDefaults: {} },
    };
    mocks.loadSettings.mockReturnValue(settings);
    mocks.promptForApiKeyIfNeeded.mockResolvedValue(undefined);
    mocks.saveSettings.mockImplementationOnce(() => {
      throw new Error('settings write failed');
    });

    const ctx = {
      state: {
        controller: {
          listAvailableModels: vi.fn(async () => [model]),
          invalidateAvailableModelsCache: vi.fn(),
          listModes: vi.fn(() => [{ id: 'build', defaultModelId: previousModelId }]),
        },
        session: {
          mode: { get: vi.fn(() => 'build') },
          model: { get: vi.fn(() => previousModelId), switch: switchModel },
          thread: {
            getId: vi.fn(() => 'thread-1'),
            list: vi.fn(async () => [
              {
                id: 'thread-1',
                metadata: { ...threadSettings },
              },
            ]),
            setSetting,
            getSetting,
          },
        },
        ui: { hideOverlay: vi.fn() },
      },
      showError: vi.fn(),
    } as any;

    const command = handleModelCommand(ctx);
    await vi.waitFor(() => expect(mocks.selectorOptions).toBeDefined());
    await mocks.selectorOptions.onSelect(model);
    await command;

    expect(setSetting).toHaveBeenNthCalledWith(1, { key: 'modeModelId_build', value: model.id });
    expect(setSetting).toHaveBeenNthCalledWith(2, { key: 'activeModelPackId', value: 'custom:Custom' });
    expect(setSetting).toHaveBeenNthCalledWith(3, { key: 'activeModelPackId', value: 'openai' });
    expect(setSetting).toHaveBeenNthCalledWith(4, { key: 'modeModelId_build', value: previousModelId });
    expect(mocks.saveSettings).toHaveBeenNthCalledWith(2, settings);
    expect(switchModel).not.toHaveBeenCalled();
    expect(settings.models.activeModelPackId).toBe('openai');
    expect(ctx.showError).toHaveBeenCalledWith('Failed to switch model: settings write failed');
  });

  it('does not switch when thread persistence silently drops the update', async () => {
    const model = {
      id: 'openai/gpt-5.6-sol',
      provider: 'openai',
      modelName: 'gpt-5.6-sol',
      hasApiKey: true,
    };
    const switchModel = vi.fn(async () => undefined);
    mocks.promptForApiKeyIfNeeded.mockResolvedValue(undefined);
    mocks.loadSettings.mockReturnValue({
      customProviders: [],
      customModelPacks: [],
      models: { activeModelPackId: 'openai', modeDefaults: {} },
    });

    const ctx = {
      state: {
        controller: {
          listAvailableModels: vi.fn(async () => [model]),
          invalidateAvailableModelsCache: vi.fn(),
          listModes: vi.fn(() => [{ id: 'build', defaultModelId: 'openai/gpt-5.5' }]),
        },
        session: {
          mode: { get: vi.fn(() => 'build') },
          model: { get: vi.fn(() => 'openai/gpt-5.5'), switch: switchModel },
          thread: {
            getId: vi.fn(() => 'thread-1'),
            list: vi.fn(async () => [{ id: 'thread-1', metadata: { activeModelPackId: 'openai' } }]),
            setSetting: vi.fn(async () => undefined),
            getSetting: vi.fn(async () => undefined),
          },
        },
        ui: { hideOverlay: vi.fn() },
      },
      showError: vi.fn(),
    } as any;

    const command = handleModelCommand(ctx);
    await vi.waitFor(() => expect(mocks.selectorOptions).toBeDefined());
    await mocks.selectorOptions.onSelect(model);
    await command;

    expect(switchModel).not.toHaveBeenCalled();
    expect(mocks.saveSettings).not.toHaveBeenCalled();
    expect(ctx.showError).toHaveBeenCalledWith('Failed to switch model: Could not save the build mode model');
  });

  it.each([
    { failure: 'API-key setup', promptFails: true },
    { failure: 'model switching', promptFails: false },
  ])('settles and reports an error when $failure fails', async ({ promptFails }) => {
    const model = {
      id: 'openai/gpt-5.6-sol',
      provider: 'openai',
      modelName: 'gpt-5.6-sol',
      hasApiKey: true,
    };
    const switchModel = vi.fn(async () => {
      throw new Error('switch failed');
    });
    const threadSettings: Record<string, unknown> = {};
    const setSetting = vi.fn(async ({ key, value }: { key: string; value: unknown }) => {
      threadSettings[key] = value;
    });
    const getSetting = vi.fn(async ({ key }: { key: string }) => threadSettings[key]);
    mocks.promptForApiKeyIfNeeded.mockImplementation(async () => {
      if (promptFails) throw new Error('setup failed');
    });
    mocks.loadSettings.mockReturnValue({
      customProviders: [],
      customModelPacks: [],
      models: { activeModelPackId: null, modeDefaults: {} },
    });

    const ctx = {
      state: {
        controller: {
          listAvailableModels: vi.fn(async () => [model]),
          invalidateAvailableModelsCache: vi.fn(),
          listModes: vi.fn(() => [{ id: 'build', defaultModelId: model.id }]),
        },
        session: {
          mode: { get: vi.fn(() => 'build') },
          model: { get: vi.fn(() => model.id), switch: switchModel },
          thread: {
            getId: vi.fn(() => 'thread-1'),
            list: vi.fn(async () => [{ id: 'thread-1', metadata: { ...threadSettings } }]),
            setSetting,
            getSetting,
          },
        },
        ui: { hideOverlay: vi.fn() },
      },
      showError: vi.fn(),
    } as any;

    const command = handleModelCommand(ctx);
    await vi.waitFor(() => expect(mocks.selectorOptions).toBeDefined());
    await mocks.selectorOptions.onSelect(model);

    await expect(command).resolves.toBeUndefined();
    expect(ctx.showError).toHaveBeenCalledWith(
      `Failed to switch model: ${promptFails ? 'setup failed' : 'switch failed'}`,
    );
  });
});
