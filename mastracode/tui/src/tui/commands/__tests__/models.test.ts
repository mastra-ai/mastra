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
  parseThreadSettings: (metadata: Record<string, unknown> | undefined) => ({
    activeModelPackId: typeof metadata?.activeModelPackId === 'string' ? (metadata.activeModelPackId as string) : null,
    modeModelIds: Object.fromEntries(
      Object.entries(metadata ?? {})
        .filter(([key, value]) => key.startsWith('modeModelId_') && typeof value === 'string')
        .map(([key, value]) => [key.slice('modeModelId_'.length), value]),
    ),
  }),
  resolveModePackModels: (settings: any, pack: any) => ({
    ...pack.models,
    ...settings.models.modePackOverrides?.[pack.id],
  }),
  stripMastraCodeCustomProviderPrefix: (modelId: string) => modelId,
  THREAD_ACTIVE_MODEL_PACK_ID_KEY: 'activeModelPackId',
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

  it('stores a same-provider override without replacing the built-in pack', async () => {
    const model = {
      id: 'openai/gpt-5.4',
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
      { id: 'build', defaultModelId: 'anthropic/stale-build' },
      { id: 'plan', defaultModelId: 'anthropic/stale-plan' },
      { id: 'fast', defaultModelId: 'anthropic/stale-fast' },
    ];
    const mode = modes[0]!;
    const settings = {
      customProviders: [],
      customModelPacks: [] as Array<{ name: string; models: Record<string, string>; createdAt: string }>,
      models: {
        activeModelPackId: 'openai',
        modeDefaults: {
          build: 'anthropic/stale-build',
          plan: 'anthropic/stale-plan',
          fast: 'anthropic/stale-fast',
        } as Record<string, string>,
      },
    };
    mocks.loadSettings.mockReturnValue(settings);
    mocks.promptForApiKeyIfNeeded.mockResolvedValue('ready');

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
    expect(mode.defaultModelId).toBe('anthropic/stale-build');
    const savedSettings = mocks.saveSettings.mock.calls[0]![0];
    expect(savedSettings.models.activeModelPackId).toBe('openai');
    expect(savedSettings.models.modePackOverrides).toEqual({ openai: { build: model.id } });
    expect(savedSettings.models.modeDefaults).toEqual({});
    expect(savedSettings.customModelPacks).toEqual([]);
    expect(setSetting).toHaveBeenNthCalledWith(1, { key: 'modeModelId_build', value: model.id });
    expect(setSetting).toHaveBeenNthCalledWith(2, { key: 'activeModelPackId', value: 'openai' });
  });

  it('keeps mode selections isolated between threads', async () => {
    const buildModel = {
      id: 'openai/thread-a-build-next',
      provider: 'openai',
      modelName: 'thread-a-build-next',
      hasApiKey: true,
    };
    const planModel = {
      id: 'openai/thread-b-plan-next',
      provider: 'openai',
      modelName: 'thread-b-plan-next',
      hasApiKey: true,
    };
    const modes = [
      { id: 'build', defaultModelId: 'openai/shared-build' },
      { id: 'plan', defaultModelId: 'openai/shared-plan' },
      { id: 'fast', defaultModelId: 'openai/shared-fast' },
    ];
    let settings = {
      customProviders: [],
      customModelPacks: [] as Array<{ name: string; models: Record<string, string>; createdAt: string }>,
      models: {
        activeModelPackId: 'openai',
        modeDefaults: {
          build: 'openai/shared-build',
          plan: 'openai/shared-plan',
          fast: 'openai/shared-fast',
        },
      },
    };
    mocks.loadSettings.mockImplementation(() => settings);
    mocks.saveSettings.mockImplementation(nextSettings => {
      settings = structuredClone(nextSettings);
    });
    mocks.promptForApiKeyIfNeeded.mockResolvedValue('ready');

    const threadAMetadata: Record<string, unknown> = {
      activeModelPackId: 'openai',
      modeModelId_build: 'openai/thread-a-build',
      modeModelId_plan: 'openai/thread-a-plan',
      modeModelId_fast: 'openai/thread-a-fast',
    };
    const threadBMetadata: Record<string, unknown> = {
      activeModelPackId: 'openai',
      modeModelId_build: 'openai/thread-b-build',
      modeModelId_plan: 'openai/thread-b-plan',
      modeModelId_fast: 'openai/thread-b-fast',
    };

    const createCtx = (threadId: string, modeId: string, metadata: Record<string, unknown>, model: any) => {
      let currentModelId = String(metadata[`modeModelId_${modeId}`]);
      return {
        state: {
          controller: {
            listAvailableModels: vi.fn(async () => [model]),
            invalidateAvailableModelsCache: vi.fn(),
            listModes: vi.fn(() => modes),
          },
          session: {
            mode: { get: vi.fn(() => modeId) },
            model: {
              get: vi.fn(() => currentModelId),
              switch: vi.fn(async ({ modelId }: { modelId: string }) => {
                currentModelId = modelId;
              }),
            },
            thread: {
              getId: vi.fn(() => threadId),
              list: vi.fn(async () => [{ id: threadId, metadata: { ...metadata } }]),
              setSetting: vi.fn(async ({ key, value }: { key: string; value: unknown }) => {
                metadata[key] = value;
              }),
              getSetting: vi.fn(async ({ key }: { key: string }) => metadata[key]),
            },
          },
          ui: { hideOverlay: vi.fn() },
        },
        updateStatusLine: vi.fn(),
        showInfo: vi.fn(),
        showError: vi.fn(),
      } as any;
    };

    const threadA = createCtx('thread-a', 'build', threadAMetadata, buildModel);
    const threadACommand = handleModelCommand(threadA);
    await vi.waitFor(() => expect(mocks.selectorOptions).toBeDefined());
    await mocks.selectorOptions.onSelect(buildModel);
    await threadACommand;

    mocks.selectorOptions = undefined;
    const threadB = createCtx('thread-b', 'plan', threadBMetadata, planModel);
    const threadBCommand = handleModelCommand(threadB);
    await vi.waitFor(() => expect(mocks.selectorOptions).toBeDefined());
    await mocks.selectorOptions.onSelect(planModel);
    await threadBCommand;

    expect(settings.models.modePackOverrides).toEqual({
      openai: { build: buildModel.id, plan: planModel.id },
    });
    expect(threadAMetadata).toMatchObject({
      modeModelId_build: buildModel.id,
      modeModelId_plan: 'openai/thread-a-plan',
      modeModelId_fast: 'openai/thread-a-fast',
    });
    expect(threadBMetadata).toMatchObject({
      modeModelId_build: 'openai/thread-b-build',
      modeModelId_plan: planModel.id,
      modeModelId_fast: 'openai/thread-b-fast',
    });
    expect(modes).toEqual([
      { id: 'build', defaultModelId: 'openai/shared-build' },
      { id: 'plan', defaultModelId: 'openai/shared-plan' },
      { id: 'fast', defaultModelId: 'openai/shared-fast' },
    ]);
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
    mocks.promptForApiKeyIfNeeded.mockResolvedValue('ready');
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
    expect(setSetting).toHaveBeenNthCalledWith(2, { key: 'activeModelPackId', value: 'openai' });
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
    mocks.promptForApiKeyIfNeeded.mockResolvedValue('ready');
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
      return 'ready';
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
