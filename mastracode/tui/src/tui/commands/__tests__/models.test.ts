import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  loadSettings: vi.fn(),
  saveSettings: vi.fn(),
  promptForApiKeyIfNeeded: vi.fn(),
  selectorOptions: undefined as any,
  showModalOverlay: vi.fn(),
  applyPackToSession: vi.fn(),
}));

vi.mock('@mastra/code-sdk/onboarding/settings', () => ({
  loadSettings: mocks.loadSettings,
  saveSettings: mocks.saveSettings,
  parseThreadSettings: (metadata: Record<string, unknown> | undefined) => ({
    activeModelPackId: typeof metadata?.activeModelPackId === 'string' ? (metadata.activeModelPackId as string) : null,
  }),
  resolveModePackModels: (settings: any, pack: any) => ({
    ...pack.models,
    ...settings.models.modePackOverrides?.[pack.id],
  }),
  stripMastraCodeCustomProviderPrefix: (modelId: string) => modelId,
  THREAD_ACTIVE_MODEL_PACK_ID_KEY: 'activeModelPackId',
  THREAD_FALLBACK_STATUS_KEY: 'mastracodeFallbackStatus',
}));

vi.mock('@mastra/code-sdk/onboarding/packs', () => ({
  getBuiltinModePack: (packId: string) => {
    if (packId === 'openai') {
      return {
        id: 'openai',
        providerId: 'openai',
        name: 'OpenAI',
        description: 'All OpenAI models via API key',
        models: {
          build: 'openai/gpt-5.6-sol',
          plan: 'openai/gpt-5.6-sol',
          fast: 'openai/gpt-5.4-mini',
        },
      };
    }
    if (packId === 'anthropic') {
      return {
        id: 'anthropic',
        providerId: 'anthropic',
        name: 'Anthropic',
        description: 'All Anthropic models via API key',
        models: {
          build: 'anthropic/claude-opus-4-6',
          plan: 'anthropic/claude-opus-4-6',
          fast: 'anthropic/claude-haiku-4-5',
        },
      };
    }
    return undefined;
  },
}));

vi.mock('../../components/model-selector.js', () => ({
  ModelSelectorComponent: class {
    focused = false;
    constructor(options: any) {
      mocks.selectorOptions = options;
    }
  },
}));

vi.mock('../../model-packs/apply.js', () => ({ applyPackToSession: mocks.applyPackToSession }));
vi.mock('../../overlay.js', () => ({ showModalOverlay: mocks.showModalOverlay }));
vi.mock('../../prompt-api-key.js', () => ({ promptForApiKeyIfNeeded: mocks.promptForApiKeyIfNeeded }));

import { handleModelCommand } from '../models.js';

describe('handleModelCommand', () => {
  beforeEach(() => {
    mocks.loadSettings.mockReset();
    mocks.loadSettings.mockReturnValue({
      customProviders: [],
      customModelPacks: [],
      models: { activeModelPackId: null, modePackOverrides: {}, modeDefaults: {} },
    });
    mocks.saveSettings.mockReset();
    mocks.promptForApiKeyIfNeeded.mockReset();
    mocks.showModalOverlay.mockReset();
    mocks.applyPackToSession.mockReset();
    mocks.applyPackToSession.mockImplementation(async (_ctx, _packId, options) => {
      try {
        await options?.afterApply?.();
        return { applied: true };
      } catch (error) {
        await options?.onError?.(error);
        throw error;
      }
    });
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

  it('limits built-in packs to models from the pack provider', async () => {
    const openai = {
      id: 'openai/gpt-5.4',
      provider: 'openai',
      modelName: 'gpt-5.4',
      hasApiKey: true,
    };
    const anthropic = {
      id: 'anthropic/claude-fable-5',
      provider: 'anthropic',
      modelName: 'claude-fable-5',
      hasApiKey: true,
    };
    mocks.loadSettings.mockReturnValue({
      customProviders: [],
      customModelPacks: [],
      models: { activeModelPackId: 'openai', modePackOverrides: {}, modeDefaults: {} },
    });

    const ctx = {
      state: {
        controller: { listAvailableModels: vi.fn(async () => [anthropic, openai]) },
        session: {
          model: { get: vi.fn(() => openai.id) },
          thread: { getId: vi.fn(() => null) },
        },
        ui: {},
      },
      showInfo: vi.fn(),
      showError: vi.fn(),
    } as any;

    void handleModelCommand(ctx);
    await vi.waitFor(() => expect(mocks.selectorOptions).toBeDefined());

    expect(mocks.selectorOptions.models).toEqual([openai]);
    expect(mocks.selectorOptions.title).toBe('Select OpenAI Model');
  });

  it('creates a pending new thread before resolving its active pack', async () => {
    const openai = {
      id: 'openai/gpt-5.4',
      provider: 'openai',
      modelName: 'gpt-5.4',
      hasApiKey: true,
    };
    const anthropic = {
      id: 'anthropic/claude-opus-4-6',
      provider: 'anthropic',
      modelName: 'claude-opus-4-6',
      hasApiKey: true,
    };
    const create = vi.fn(async () => ({ id: 'thread-new' }));
    mocks.loadSettings.mockReturnValue({
      customProviders: [],
      customModelPacks: [],
      models: { activeModelPackId: 'openai', modePackOverrides: {}, modeDefaults: {} },
    });

    const ctx = {
      state: {
        pendingNewThread: true,
        controller: { listAvailableModels: vi.fn(async () => [openai, anthropic]) },
        session: {
          model: { get: vi.fn(() => anthropic.id) },
          thread: {
            create,
            getId: vi.fn(() => 'thread-new'),
            list: vi.fn(async () => [{ id: 'thread-new', metadata: { activeModelPackId: 'anthropic' } }]),
          },
        },
        ui: {},
      },
      showInfo: vi.fn(),
      showError: vi.fn(),
    } as any;

    void handleModelCommand(ctx);
    await vi.waitFor(() => expect(mocks.selectorOptions).toBeDefined());

    expect(create).toHaveBeenCalledTimes(1);
    expect(ctx.state.pendingNewThread).toBe(false);
    expect(mocks.selectorOptions.models).toEqual([anthropic]);
    expect(mocks.selectorOptions.title).toBe('Select Anthropic Model');
  });

  it('rejects a typed cross-provider model while a built-in pack is active', async () => {
    const openai = {
      id: 'openai/gpt-5.4',
      provider: 'openai',
      modelName: 'gpt-5.4',
      hasApiKey: true,
    };
    const anthropic = {
      id: 'anthropic/claude-fable-5',
      provider: 'anthropic',
      modelName: 'claude-fable-5',
      hasApiKey: true,
    };
    mocks.loadSettings.mockReturnValue({
      customProviders: [],
      customModelPacks: [],
      models: { activeModelPackId: 'openai', modePackOverrides: {}, modeDefaults: {} },
    });
    const ctx = {
      state: {
        controller: { listAvailableModels: vi.fn(async () => [openai, anthropic]) },
        session: {
          model: { get: vi.fn(() => openai.id) },
          thread: { getId: vi.fn(() => null) },
        },
        ui: { hideOverlay: vi.fn() },
      },
      showInfo: vi.fn(),
      showError: vi.fn(),
    } as any;

    const command = handleModelCommand(ctx);
    await vi.waitFor(() => expect(mocks.selectorOptions).toBeDefined());
    await mocks.selectorOptions.onSelect(anthropic);
    await command;

    expect(ctx.showInfo).toHaveBeenCalledWith(
      'The OpenAI pack only accepts OpenAI models. Create a custom pack with /models to mix providers.',
    );
    expect(mocks.saveSettings).not.toHaveBeenCalled();
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

    expect(ctx.showInfo).toHaveBeenCalledWith(
      'No connected models. Use /connect to add a provider account or API key.',
    );
    expect(mocks.showModalOverlay).not.toHaveBeenCalled();
  });

  it('reports model discovery failures', async () => {
    const ctx = {
      state: {
        controller: { listAvailableModels: vi.fn(async () => Promise.reject(new Error('discovery failed'))) },
      },
      showError: vi.fn(),
    } as any;

    await handleModelCommand(ctx);

    expect(ctx.showError).toHaveBeenCalledWith('Failed to list models: discovery failed');
    expect(mocks.showModalOverlay).not.toHaveBeenCalled();
  });

  it('stops when the API-key prompt is cancelled', async () => {
    const model = {
      id: 'openai/gpt-5.6-sol',
      provider: 'openai',
      modelName: 'gpt-5.6-sol',
      hasApiKey: false,
      apiKeyEnvVar: 'OPENAI_API_KEY',
    };
    const invalidateAvailableModelsCache = vi.fn();
    const switchModel = vi.fn();
    const setSetting = vi.fn();
    mocks.promptForApiKeyIfNeeded.mockResolvedValue('cancelled');

    const ctx = {
      authStorage: {},
      state: {
        controller: {
          listAvailableModels: vi.fn(async () => [model]),
          invalidateAvailableModelsCache,
          listModes: vi.fn(),
        },
        session: {
          model: { get: vi.fn(() => model.id), switch: switchModel },
          thread: { setSetting },
        },
        ui: { hideOverlay: vi.fn() },
      },
      showError: vi.fn(),
    } as any;

    const command = handleModelCommand(ctx);
    await vi.waitFor(() => expect(mocks.selectorOptions).toBeDefined());
    await mocks.selectorOptions.onSelect(model);
    await command;

    expect(invalidateAvailableModelsCache).not.toHaveBeenCalled();
    expect(switchModel).not.toHaveBeenCalled();
    expect(setSetting).not.toHaveBeenCalled();
    expect(mocks.saveSettings).not.toHaveBeenCalled();
    expect(ctx.showError).not.toHaveBeenCalled();
  });

  it('updates the active pack override and clears a pending model-route fallback', async () => {
    const model = {
      id: 'openai/gpt-5.4',
      provider: 'openai',
      modelName: 'gpt-5.4',
      hasApiKey: true,
      apiKeyEnvVar: 'OPENAI_API_KEY',
    };
    const threadSettings: Record<string, unknown> = {
      activeModelPackId: 'openai',
      mastracodePendingModelFallback: { fromEntryId: 'anthropic', toEntryId: 'openai' },
    };
    const setSetting = vi.fn(async ({ key, value }: { key: string; value: unknown }) => {
      threadSettings[key] = value;
    });
    const stateSet = vi.fn(async () => undefined);
    const settings = {
      customProviders: [],
      customModelPacks: [],
      models: { activeModelPackId: 'openai', modeDefaults: {}, modePackOverrides: {} },
    };
    mocks.loadSettings.mockReturnValue(settings);
    mocks.promptForApiKeyIfNeeded.mockResolvedValue('ready');
    const ctx = {
      authStorage: {},
      state: {
        controller: {
          listAvailableModels: vi.fn(async () => [model]),
          invalidateAvailableModelsCache: vi.fn(),
          listModes: vi.fn(() => [
            { id: 'build', defaultModelId: 'openai/gpt-5.6-sol' },
            { id: 'plan', defaultModelId: 'openai/gpt-5.6-sol' },
            { id: 'fast', defaultModelId: 'openai/gpt-5.4-mini' },
          ]),
        },
        session: {
          mode: { get: vi.fn(() => 'build') },
          model: { get: vi.fn(() => 'openai/gpt-5.6-sol'), switch: vi.fn(async () => undefined) },
          state: { get: vi.fn(() => ({})), set: stateSet },
          thread: {
            getId: vi.fn(() => 'thread-1'),
            list: vi.fn(async () => [{ id: 'thread-1', metadata: { ...threadSettings } }]),
            setSetting,
            getSetting: vi.fn(async ({ key }: { key: string }) => threadSettings[key]),
          },
        },
        ui: { hideOverlay: vi.fn() },
      },
      updateStatusLine: vi.fn(),
      showInfo: vi.fn(),
      showError: vi.fn(),
    } as any;

    const command = handleModelCommand(ctx);
    await vi.waitFor(() => expect(mocks.selectorOptions).toBeDefined());
    await mocks.selectorOptions.onSelect(model);
    await command;

    expect(mocks.saveSettings).toHaveBeenCalledWith(
      expect.objectContaining({
        models: expect.objectContaining({
          activeModelPackId: 'openai',
          modePackOverrides: { openai: { build: model.id } },
        }),
      }),
    );
    expect(mocks.applyPackToSession).toHaveBeenCalledWith(
      ctx,
      'openai',
      expect.objectContaining({ modeId: 'build', afterApply: expect.any(Function) }),
    );
    expect(setSetting).toHaveBeenCalledWith({ key: 'mastracodeFallbackStatus', value: undefined });
    expect(Object.keys(threadSettings).some(key => key.startsWith('modeModelId_'))).toBe(false);
  });

  it('writes a selection into the shared custom pack instead of thread mode metadata', async () => {
    const model = {
      id: 'provider/new-plan',
      provider: 'provider',
      modelName: 'new-plan',
      hasApiKey: true,
      apiKeyEnvVar: 'PROVIDER_API_KEY',
    };
    const settings = {
      customProviders: [],
      customModelPacks: [
        {
          name: 'Team',
          models: { build: 'provider/build', plan: 'provider/old-plan', fast: 'provider/fast' },
          createdAt: '2026-10-05T00:00:00.000Z',
        },
      ],
      models: { activeModelPackId: 'custom:Team', modeDefaults: {}, modePackOverrides: {} },
    };
    mocks.loadSettings.mockReturnValue(settings);
    mocks.promptForApiKeyIfNeeded.mockResolvedValue('ready');
    const setSetting = vi.fn(async (_setting: { key: string; value: unknown }) => undefined);
    const ctx = {
      authStorage: {},
      state: {
        controller: {
          listAvailableModels: vi.fn(async () => [model]),
          invalidateAvailableModelsCache: vi.fn(),
          listModes: vi.fn(() => [
            { id: 'build', defaultModelId: 'provider/build' },
            { id: 'plan', defaultModelId: 'provider/old-plan' },
            { id: 'fast', defaultModelId: 'provider/fast' },
          ]),
        },
        session: {
          mode: { get: vi.fn(() => 'plan') },
          model: { get: vi.fn(() => 'provider/old-plan'), switch: vi.fn(async () => undefined) },
          state: { get: vi.fn(() => ({})), set: vi.fn(async () => undefined) },
          thread: {
            getId: vi.fn(() => 'thread-1'),
            list: vi.fn(async () => [{ id: 'thread-1', metadata: { activeModelPackId: 'custom:Team' } }]),
            setSetting,
            getSetting: vi.fn(async () => 'custom:Team'),
          },
        },
        ui: { hideOverlay: vi.fn() },
      },
      updateStatusLine: vi.fn(),
      showInfo: vi.fn(),
      showError: vi.fn(),
    } as any;

    const command = handleModelCommand(ctx);
    await vi.waitFor(() => expect(mocks.selectorOptions).toBeDefined());
    await mocks.selectorOptions.onSelect(model);
    await command;

    expect(mocks.saveSettings).toHaveBeenCalledWith(
      expect.objectContaining({
        customModelPacks: [
          expect.objectContaining({ name: 'Team', models: expect.objectContaining({ plan: model.id }) }),
        ],
      }),
    );
    expect(mocks.applyPackToSession).toHaveBeenCalledWith(
      ctx,
      'custom:Team',
      expect.objectContaining({ modeId: 'plan', afterApply: expect.any(Function) }),
    );
    expect(setSetting.mock.calls.some(([setting]) => String(setting.key).startsWith('modeModelId_'))).toBe(false);
  });

  it('restores settings and the current model when pack application fails', async () => {
    const model = {
      id: 'openai/gpt-5.4',
      provider: 'openai',
      modelName: 'gpt-5.4',
      hasApiKey: true,
      apiKeyEnvVar: 'OPENAI_API_KEY',
    };
    const settings = {
      customProviders: [],
      customModelPacks: [],
      models: { activeModelPackId: 'openai', modeDefaults: {}, modePackOverrides: {} },
    };
    mocks.loadSettings.mockReturnValue(settings);
    mocks.promptForApiKeyIfNeeded.mockResolvedValue('ready');
    mocks.applyPackToSession.mockImplementationOnce(async (_ctx, _packId, options) => {
      const error = new Error('apply failed');
      await options?.onError?.(error);
      throw error;
    });
    const switchModel = vi.fn(async () => undefined);
    const ctx = {
      authStorage: {},
      state: {
        controller: {
          listAvailableModels: vi.fn(async () => [model]),
          invalidateAvailableModelsCache: vi.fn(),
          listModes: vi.fn(() => [{ id: 'build', defaultModelId: 'openai/gpt-5.6-sol' }]),
        },
        session: {
          mode: { get: vi.fn(() => 'build') },
          model: { get: vi.fn(() => 'openai/gpt-5.6-sol'), switch: switchModel },
          state: { get: vi.fn(() => ({})), set: vi.fn(async () => undefined) },
          thread: {
            getId: vi.fn(() => 'thread-1'),
            list: vi.fn(async () => [{ id: 'thread-1', metadata: { activeModelPackId: 'openai' } }]),
            setSetting: vi.fn(async () => undefined),
            getSetting: vi.fn(async () => 'openai'),
          },
        },
        ui: { hideOverlay: vi.fn() },
      },
      updateStatusLine: vi.fn(),
      showInfo: vi.fn(),
      showError: vi.fn(),
    } as any;

    const command = handleModelCommand(ctx);
    await vi.waitFor(() => expect(mocks.selectorOptions).toBeDefined());
    await mocks.selectorOptions.onSelect(model);
    await command;

    expect(mocks.saveSettings).toHaveBeenLastCalledWith(settings);
    expect(switchModel).toHaveBeenCalledWith({ modelId: 'openai/gpt-5.6-sol' });
    expect(ctx.showError).toHaveBeenCalledWith('Failed to switch model: apply failed');
  });
});
