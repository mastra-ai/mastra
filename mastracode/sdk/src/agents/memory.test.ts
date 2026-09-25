import { beforeEach, describe, expect, it, vi } from 'vitest';

import { LOCAL_KNOWLEDGE_ORG_ID } from '../knowledge-scope.js';

const memoryConstructorMock = vi.fn();
const getOmScopeMock = vi.fn();
const resolveModelMock = vi.fn();
const resolvePackMemoryModelChainMock = vi.fn();
const loadSettingsMock = vi.fn();

vi.mock('@mastra/memory', async () => ({
  resolveAutoModelId: (await vi.importActual<typeof import('@mastra/memory')>('@mastra/memory')).resolveAutoModelId,
  Memory: class {
    config: unknown;

    constructor(config: unknown) {
      memoryConstructorMock(config);
      this.config = config;
    }
  },
  Subconscious: class {
    config: unknown;

    constructor(config: unknown) {
      this.config = config;
    }
  },
}));

vi.mock('@mastra/fastembed', () => ({
  fastembed: { small: 'fastembed-small' },
}));

vi.mock('../utils/project.js', () => ({
  getOmScope: getOmScopeMock,
}));

vi.mock('./model.js', async () => ({
  resolveActiveModePackId: (await vi.importActual<typeof import('./model.js')>('./model.js')).resolveActiveModePackId,
  resolveModel: resolveModelMock,
  resolvePackMemoryModelChain: resolvePackMemoryModelChainMock,
}));

vi.mock('../onboarding/settings.js', () => ({
  loadSettings: loadSettingsMock,
}));

type MemoryConfig = {
  storage: unknown;
  vector: unknown;
  embedder?: unknown;
  options: {
    generateTitle: {
      model: (args: { requestContext: RequestContextStub }) => unknown;
    };
    observationalMemory: {
      enabled: boolean;
      temporalMarkers: boolean;
      retrieval: unknown;
      experimental_subconscious?: { config: unknown };
      scope: 'thread' | 'resource';
      activateAfterIdle: unknown;
      activateOnProviderChange: boolean;
      autoModels: Record<string, string>;
      resolveModel: (modelId: string, context: { requestContext?: RequestContextStub }) => unknown;
      observation: {
        bufferTokens: unknown;
        bufferActivation: unknown;
        model: (args: { requestContext: RequestContextStub }) => unknown;
        messageTokens: number;
        blockAfter: number;
        previousObserverTokens: number;
        threadTitle: boolean;
        instruction: string;
        observeAttachments: unknown;
      };
      reflection: {
        bufferActivation: unknown;
        blockAfter: number;
        model: (args: { requestContext: RequestContextStub }) => unknown;
        observationTokens: number;
        instruction?: string;
      };
    };
  };
};

type RequestContextStub = {
  get: (key: string) => unknown;
  set: (key: string, value: unknown) => void;
};

function createRequestContext(state: Record<string, unknown>, sessionId = 'session-1'): RequestContextStub {
  const getState = () => state;
  const values = new Map<string, unknown>([
    ['user', { workosId: 'user-1', organizationId: 'org-1' }],
    ...(typeof state.factoryProjectId === 'string' ? ([['mastra__factoryMemorySettings', null]] as const) : []),
    [
      'controller',
      {
        getState,
        session: {
          id: sessionId,
          ownerId: 'mastracode-owner',
          modelId: (state.currentModelId as string | undefined) ?? '',
          state: { get: getState },
        },
      },
    ],
  ]);
  return {
    get: vi.fn(key => values.get(key)),
    set: vi.fn((key, value) => values.set(key, value)),
  };
}

async function createMemoryConfig(
  state: Record<string, unknown>,
  projectScope: 'thread' | 'resource' = 'thread',
  vector?: unknown,
  settingsPath?: string,
) {
  vi.resetModules();
  memoryConstructorMock.mockClear();
  getOmScopeMock.mockReturnValue(projectScope);

  const { getDynamicMemory } = await import('./memory.js');
  const storage = { storage: true };
  const requestContext = createRequestContext(state);

  const memory = getDynamicMemory(
    storage as never,
    vector as never,
    settingsPath,
  )({ requestContext: requestContext as never }) as unknown as {
    config: MemoryConfig;
  };

  expect(memoryConstructorMock).toHaveBeenCalledTimes(1);
  return { config: memory.config, requestContext };
}

describe('getDynamicMemory', () => {
  beforeEach(() => {
    memoryConstructorMock.mockReset();
    getOmScopeMock.mockReset();
    resolveModelMock.mockReset();
    resolveModelMock.mockImplementation((modelId: string) => ({ modelId }));
    resolvePackMemoryModelChainMock.mockReset();
    resolvePackMemoryModelChainMock.mockReturnValue(undefined);
    loadSettingsMock.mockReset();
    loadSettingsMock.mockReturnValue({ models: {} });
    delete process.env.MASTRACODE_EXPERIMENTAL_SUBCONSCIOUS;
    delete process.env.MASTRACODE_DISABLE_OBSERVATIONAL_MEMORY;
    delete process.env.MASTRACODE_DISABLE_TITLE_GENERATION;
    vi.unstubAllEnvs();
    vi.stubEnv('GOOGLE_GENERATIVE_AI_API_KEY', '');
  });

  it('wires Mastra Code observational memory activation defaults into core memory', async () => {
    const { config, requestContext } = await createMemoryConfig({ projectPath: '/tmp/project' });

    expect(getOmScopeMock).toHaveBeenCalledWith('/tmp/project');
    expect(config.storage).toEqual({ storage: true });
    expect(config.vector).toBe(false);
    expect(config.embedder).toBeUndefined();

    expect(config.options.generateTitle.model({ requestContext })).toEqual({
      modelId: 'google/gemini-3.5-flash',
    });

    const om = config.options.observationalMemory;
    expect(om).toMatchObject({
      enabled: true,
      temporalMarkers: true,
      retrieval: true,
      scope: 'thread',
      activateAfterIdle: 'auto',
      activateOnProviderChange: true,
      observation: {
        bufferTokens: 1 / 5,
        bufferActivation: 2000,
        messageTokens: 30_000,
        blockAfter: 2,
        previousObserverTokens: 1000,
        threadTitle: true,
        observeAttachments: undefined,
      },
      reflection: {
        bufferActivation: 1 / 2,
        blockAfter: 1.1,
        observationTokens: 40_000,
      },
    });
    expect(om.observation.instruction).toContain('Do NOT observe or extract information from these messages');
    expect(om.reflection.instruction).toBeUndefined();

    expect(om.autoModels).toEqual({ google: 'google/gemini-3.5-flash' });
    expect(om.observation.model({ requestContext })).toBe('auto');
    expect(om.reflection.model({ requestContext })).toBe('auto');
    expect(requestContext.get('user')).toEqual({ workosId: 'user-1', organizationId: 'org-1' });
    expect(resolveModelMock).toHaveBeenLastCalledWith('google/gemini-3.5-flash', {
      remapForCodexOAuth: true,
      requestContext,
    });

    // Memory routes its auto pick through Mastra Code's credential-aware resolver.
    expect(om.resolveModel('openai/gpt-5.4-mini', { requestContext })).toEqual({ modelId: 'openai/gpt-5.4-mini' });
    expect(resolveModelMock).toHaveBeenLastCalledWith('openai/gpt-5.4-mini', {
      remapForCodexOAuth: true,
      requestContext,
    });
  });

  it('resolves title generation for an auto observer from the active main model', async () => {
    const { config, requestContext } = await createMemoryConfig({
      projectPath: '/tmp/project',
      observerModelSelection: 'auto',
      currentModelId: 'mastra/openai/gpt-5.6-sol',
    });

    expect(config.options.generateTitle.model({ requestContext })).toEqual({
      modelId: 'mastra/openai/gpt-5.4-mini',
    });
  });

  it('keeps storage-backed memory and title generation while suppressing OM work in generic E2E scenarios', async () => {
    process.env.MASTRACODE_DISABLE_OBSERVATIONAL_MEMORY = '1';

    const { config } = await createMemoryConfig({ projectPath: '/tmp/project' });

    expect(config.storage).toEqual({ storage: true });
    expect(config.options.generateTitle).not.toBe(false);
    expect(config.options.observationalMemory).toBe(false);
  });

  it('can suppress title generation independently from observational memory in E2E scenarios', async () => {
    process.env.MASTRACODE_DISABLE_TITLE_GENERATION = '1';

    const { config } = await createMemoryConfig({ projectPath: '/tmp/project' });

    expect(config.options.generateTitle).toBe(false);
    expect(config.options.observationalMemory).not.toBe(false);
  });

  it('falls back to auto when a Factory run has no authoritative settings result', async () => {
    vi.resetModules();
    memoryConstructorMock.mockClear();
    getOmScopeMock.mockReturnValue('thread');
    const { getDynamicMemory } = await import('./memory.js');
    const requestContext = createRequestContext({
      projectPath: '/tmp/project',
      factoryProjectId: 'factory-project-1',
      observerModelSelection: 'openai/stale-observer',
      reflectorModelSelection: 'openai/stale-reflector',
    });
    requestContext.set('mastra__factoryMemorySettings', undefined);

    const resolve = getDynamicMemory({ storage: true } as never);
    const memory = resolve({ requestContext: requestContext as never }) as unknown as { config: MemoryConfig };
    const unscopedContext = createRequestContext({
      observerModelSelection: 'openai/stale-observer',
      reflectorModelSelection: 'openai/stale-reflector',
    });
    unscopedContext.set('mastra__factoryMemorySettings', {
      status: 'unavailable',
      reason: 'storage unavailable',
    });
    const unscopedMemory = resolve({ requestContext: unscopedContext as never }) as unknown as { config: MemoryConfig };

    expect(memory.config.storage).toEqual({ storage: true });
    expect(memory.config.options.generateTitle).not.toBe(false);
    const om = memory.config.options.observationalMemory;
    expect(om.observation.model({ requestContext })).toBe('auto');
    expect(om.reflection.model({ requestContext })).toBe('auto');
    expect(om.observation.messageTokens).toBe(30_000);
    const unscopedOm = unscopedMemory.config.options.observationalMemory;
    expect(unscopedOm.observation.model({ requestContext: unscopedContext })).toBe('auto');
    expect(unscopedOm.reflection.model({ requestContext: unscopedContext })).toBe('auto');
    expect(resolveModelMock).not.toHaveBeenCalled();
  });

  it('keeps Subconscious memory inert unless explicitly opted in', async () => {
    const { config, requestContext } = await createMemoryConfig({ projectPath: '/tmp/project' }, 'thread', {
      vector: true,
    });

    expect(config.options.observationalMemory.experimental_subconscious).toBeUndefined();
    expect(requestContext.get('organizationId')).toBeUndefined();
  });

  it('enables project-scoped Subconscious memory when explicitly opted in with vector storage', async () => {
    process.env.MASTRACODE_EXPERIMENTAL_SUBCONSCIOUS = '1';
    const vector = { vector: true };
    const { config, requestContext } = await createMemoryConfig({ projectPath: '/tmp/project' }, 'thread', vector);

    expect(config.vector).toBe(vector);
    expect(config.embedder).toBe('fastembed-small');
    expect(config.options.observationalMemory.experimental_subconscious?.config).toEqual({
      defaultScope: 'resource',
      maxScope: 'resource',
      pins: true,
    });
    expect(requestContext.get('organizationId')).toBe(LOCAL_KNOWLEDGE_ORG_ID);
    // Outside the factory there is no project id, so the knowledge scope is untouched.
    expect(requestContext.get('knowledgeResourceId')).toBeUndefined();
  });

  it('prefers the factory org id from session state over the session owner for organizationId', async () => {
    process.env.MASTRACODE_EXPERIMENTAL_SUBCONSCIOUS = '1';
    const { requestContext } = await createMemoryConfig(
      {
        projectPath: '/tmp/project',
        factoryProjectId: 'project-1',
        factoryOrgId: 'org-real',
      },
      'thread',
      { vector: true },
    );
    expect(requestContext.set).toHaveBeenCalledWith('organizationId', 'org-real');
    expect(requestContext.get('organizationId')).toBe('org-real');
  });

  it('curates local (TUI/studio) knowledge under the fixed local org, never the per-checkout session owner', async () => {
    process.env.MASTRACODE_EXPERIMENTAL_SUBCONSCIOUS = '1';
    const { LOCAL_KNOWLEDGE_ORG_ID: exported } = await import('./memory.js');

    const { requestContext } = await createMemoryConfig({ projectPath: '/tmp/project' }, 'thread', { vector: true });
    const org = requestContext.get('organizationId');
    expect(org).toBe('local');
    expect(org).toBe(exported);
    expect(org).not.toBe('mastracode-owner');
  });

  it('refuses to curate for a factory session whose organization never resolved', async () => {
    process.env.MASTRACODE_EXPERIMENTAL_SUBCONSCIOUS = '1';
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      const { config, requestContext } = await createMemoryConfig(
        { projectPath: '/tmp/project', factoryProjectId: 'project-1' },
        'thread',
        { vector: true },
      );
      expect(requestContext.get('organizationId')).toBeUndefined();
      expect(requestContext.set).not.toHaveBeenCalledWith('organizationId', expect.anything());
      expect(config.options.observationalMemory.experimental_subconscious).toBeUndefined();
      expect(errorSpy).toHaveBeenCalledTimes(1);
      expect(errorSpy.mock.calls[0]?.[0]).toContain('Knowledge curation disabled');
    } finally {
      errorSpy.mockRestore();
    }
  });

  it('refuses to curate for a projectless factory session marked unresolved', async () => {
    process.env.MASTRACODE_EXPERIMENTAL_SUBCONSCIOUS = '1';
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      const { config, requestContext } = await createMemoryConfig(
        { projectPath: '/tmp/project', factoryOrgUnresolved: true },
        'thread',
        { vector: true },
      );
      expect(requestContext.get('organizationId')).toBeUndefined();
      expect(config.options.observationalMemory.experimental_subconscious).toBeUndefined();
      expect(errorSpy).toHaveBeenCalledTimes(1);
    } finally {
      errorSpy.mockRestore();
    }
  });

  it('logs the refusal once per session, not once per memory resolution', async () => {
    process.env.MASTRACODE_EXPERIMENTAL_SUBCONSCIOUS = '1';
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      vi.resetModules();
      getOmScopeMock.mockReturnValue('thread');
      const { getDynamicMemory } = await import('./memory.js');
      const resolve = getDynamicMemory({ storage: true } as never, { vector: true } as never);
      const requestContext = createRequestContext({ projectPath: '/tmp/project', factoryProjectId: 'project-1' });

      resolve({ requestContext: requestContext as never });
      resolve({ requestContext: requestContext as never });

      expect(errorSpy).toHaveBeenCalledTimes(1);
    } finally {
      errorSpy.mockRestore();
    }
  });

  it('logs the refusal once per session even across separate request contexts', async () => {
    // The controller is read off the request context on every resolution, so it
    // is a fresh object per request. Dedupe has to key on the session id, or a
    // long-lived refusing session logs once per run forever.
    process.env.MASTRACODE_EXPERIMENTAL_SUBCONSCIOUS = '1';
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      vi.resetModules();
      getOmScopeMock.mockReturnValue('thread');
      const { getDynamicMemory } = await import('./memory.js');
      const resolve = getDynamicMemory({ storage: true } as never, { vector: true } as never);
      const state = { projectPath: '/tmp/project', factoryProjectId: 'project-1' };

      resolve({ requestContext: createRequestContext(state, 'session-same') as never });
      resolve({ requestContext: createRequestContext(state, 'session-same') as never });

      expect(errorSpy).toHaveBeenCalledTimes(1);

      // A genuinely different session still gets its own error.
      resolve({ requestContext: createRequestContext(state, 'session-other') as never });
      expect(errorSpy).toHaveBeenCalledTimes(2);
    } finally {
      errorSpy.mockRestore();
    }
  });

  it.each([
    ['refusing first', ['refusing', 'healthy']],
    ['healthy first', ['healthy', 'refusing']],
  ])('keeps a refusing and a healthy session apart in the memory cache (%s)', async (_label, order) => {
    process.env.MASTRACODE_EXPERIMENTAL_SUBCONSCIOUS = '1';
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      vi.resetModules();
      getOmScopeMock.mockReturnValue('thread');
      const { getDynamicMemory } = await import('./memory.js');
      const resolve = getDynamicMemory({ storage: true } as never, { vector: true } as never);

      const contexts: Record<string, RequestContextStub> = {
        refusing: createRequestContext({ projectPath: '/tmp/project', factoryProjectId: 'project-1' }, 'session-bad'),
        healthy: createRequestContext(
          { projectPath: '/tmp/project', factoryProjectId: 'project-1', factoryOrgId: 'org-real' },
          'session-good',
        ),
      };

      const results: Record<string, MemoryConfig> = {};
      for (const key of order) {
        results[key] = (
          resolve({ requestContext: contexts[key] as never }) as unknown as { config: MemoryConfig }
        ).config;
      }

      expect(results.healthy.options.observationalMemory.experimental_subconscious).toBeDefined();
      expect(results.refusing.options.observationalMemory.experimental_subconscious).toBeUndefined();
      expect(contexts.healthy.get('organizationId')).toBe('org-real');
      expect(contexts.refusing.get('organizationId')).toBeUndefined();
    } finally {
      errorSpy.mockRestore();
    }
  });

  it('anchors the knowledge scope on the factory project id when present', async () => {
    process.env.MASTRACODE_EXPERIMENTAL_SUBCONSCIOUS = '1';
    const { requestContext } = await createMemoryConfig(
      {
        projectPath: '/tmp/project',
        factoryProjectId: 'project-1',
      },
      'thread',
      { vector: true },
    );
    expect(requestContext.set).toHaveBeenCalledWith('knowledgeResourceId', 'project-1');
    expect(requestContext.get('knowledgeResourceId')).toBe('project-1');
  });

  it('configures factory curation scope and limits', async () => {
    process.env.MASTRACODE_EXPERIMENTAL_SUBCONSCIOUS = '1';
    const vector = { vector: true };
    const { config } = await createMemoryConfig(
      { projectPath: '/tmp/project', factoryProjectId: 'project-1', factoryOrgId: 'org-real' },
      'thread',
      vector,
    );
    expect(config.options.observationalMemory.experimental_subconscious?.config).toEqual({
      defaultScope: 'resource',
      maxScope: 'resource',
      pins: true,
      maxSteps: 25,
    });
  });

  it('splits the memory cache between opted-in factory and non-factory sessions', async () => {
    process.env.MASTRACODE_EXPERIMENTAL_SUBCONSCIOUS = '1';
    vi.resetModules();
    memoryConstructorMock.mockClear();
    getOmScopeMock.mockReturnValue('thread');
    const { getDynamicMemory } = await import('./memory.js');
    const factory = getDynamicMemory({ storage: true } as never, { vector: true } as never);
    const nonFactoryMemory = factory({
      requestContext: createRequestContext({ projectPath: '/tmp/project' }) as never,
    });
    const factoryMemory = factory({
      requestContext: createRequestContext({ projectPath: '/tmp/project', factoryProjectId: 'project-1' }) as never,
    });
    // A factory-conditional config must not be cross-served from the cache.
    expect(factoryMemory).not.toBe(nonFactoryMemory);
    expect(memoryConstructorMock).toHaveBeenCalledTimes(2);
  });

  it('uses invocation-scoped Factory settings without mutating session OM state', async () => {
    const state: Record<string, unknown> = {
      observerModelSelection: 'openai/session-observer',
      reflectorModelSelection: 'openai/session-reflector',
    };
    const { config, requestContext } = await createMemoryConfig(state);
    const controllerContext = requestContext.get('controller');
    requestContext.get = vi.fn(key =>
      key === 'mastra__factoryMemorySettings'
        ? { observerModelId: 'openai/factory-observer', reflectorModelId: null }
        : key === 'controller'
          ? { ...(controllerContext as object), session: { modelId: 'anthropic/claude-sonnet-4-5' } }
          : undefined,
    );

    expect(config.options.observationalMemory.observation.model({ requestContext })).toEqual({
      modelId: 'openai/factory-observer',
    });
    expect(config.options.observationalMemory.reflection.model({ requestContext })).toBe('auto');
    expect(state).toEqual({
      observerModelSelection: 'openai/session-observer',
      reflectorModelSelection: 'openai/session-reflector',
    });
  });

  it('applies the Factory row thresholds and observe-attachments over session state', async () => {
    // Session hydration no longer copies the stored row into session state, so
    // the request-context row is the only channel that reaches the running
    // Memory for a Factory run.
    const state: Record<string, unknown> = {
      observationThreshold: 99_000,
      reflectionThreshold: 88_000,
      observeAttachments: true,
    };
    vi.resetModules();
    memoryConstructorMock.mockClear();
    getOmScopeMock.mockReturnValue('thread');

    const { getDynamicMemory } = await import('./memory.js');
    const requestContext = createRequestContext(state);
    const contextGet = requestContext.get;
    requestContext.get = vi.fn(key =>
      key === 'mastra__factoryMemorySettings'
        ? { observationThreshold: 12_000, reflectionThreshold: 16_000, observeAttachments: false }
        : contextGet(key),
    );

    const memory = getDynamicMemory(
      { storage: true } as never,
      undefined as never,
    )({
      requestContext: requestContext as never,
    }) as unknown as { config: MemoryConfig };

    const { observation, reflection } = memory.config.options.observationalMemory;
    expect(observation.messageTokens).toBe(12_000);
    expect(observation.observeAttachments).toBe(false);
    expect(reflection.observationTokens).toBe(16_000);
    // Session state is untouched: the row is read, never written back.
    expect(state).toMatchObject({ observationThreshold: 99_000, reflectionThreshold: 88_000 });
  });

  it('uses Factory defaults for unset threshold and attachment columns', async () => {
    const state: Record<string, unknown> = {
      observationThreshold: 99_000,
      observeAttachments: true,
    };
    vi.resetModules();
    memoryConstructorMock.mockClear();
    getOmScopeMock.mockReturnValue('thread');

    const { getDynamicMemory } = await import('./memory.js');
    const requestContext = createRequestContext(state);
    const contextGet = requestContext.get;
    requestContext.get = vi.fn(key =>
      key === 'mastra__factoryMemorySettings'
        ? { observationThreshold: null, observeAttachments: null }
        : contextGet(key),
    );

    const memory = getDynamicMemory(
      { storage: true } as never,
      undefined as never,
    )({
      requestContext: requestContext as never,
    }) as unknown as { config: MemoryConfig };

    const { observation } = memory.config.options.observationalMemory;
    // Once a Factory row is present, its null columns mean the Factory defaults;
    // stale values from session state must not override the settings UI.
    expect(observation.messageTokens).toBe(30_000);
    expect(observation.observeAttachments).toBe('auto');
  });

  it('hands auto roles to Memory and reports the effective model on every invocation', async () => {
    const state: Record<string, unknown> = {
      observerModelSelection: 'auto',
      reflectorModelSelection: 'auto',
    };
    const getState = () => state;
    let modelId = 'anthropic/claude-opus-4-8';
    const attributes = new Map<string, unknown>();
    const requestContext = {
      get: vi.fn((key: string) =>
        key === 'controller'
          ? {
              getState,
              session: {
                get modelId() {
                  return modelId;
                },
                state: { get: getState },
              },
            }
          : attributes.get(key),
      ),
      set: vi.fn((key: string, value: unknown) => attributes.set(key, value)),
    } as RequestContextStub;
    const { config } = await createMemoryConfig(state);
    const om = config.options.observationalMemory;

    expect(om.observation.model({ requestContext })).toBe('auto');
    expect(om.reflection.model({ requestContext })).toBe('auto');
    expect(requestContext.get('om.observer.selectionMode')).toBe('auto');
    expect(requestContext.get('om.observer.effectiveModelId')).toBe('anthropic/claude-haiku-4-5');
    expect(requestContext.get('om.reflector.selectionMode')).toBe('auto');
    expect(requestContext.get('om.reflector.effectiveModelId')).toBe('anthropic/claude-haiku-4-5');

    modelId = 'openai/gpt-5.6-sol';
    expect(om.observation.model({ requestContext })).toBe('auto');
    expect(requestContext.get('om.observer.effectiveModelId')).toBe('openai/gpt-5.4-mini');
    expect(om.reflection.model({ requestContext })).toBe('auto');
    expect(requestContext.get('om.reflector.effectiveModelId')).toBe('openai/gpt-5.4-mini');
    expect(resolveModelMock).not.toHaveBeenCalled();
  });

  it('keeps an explicit role pinned while the auto role follows the main model', async () => {
    const state: Record<string, unknown> = {
      observerModelId: 'deepseek/deepseek-v4-flash',
      observerModelSelection: 'deepseek/deepseek-v4-flash',
      reflectorModelSelection: 'auto',
    };
    const getState = () => state;
    let modelId = 'anthropic/claude-opus-4-8';
    const attributes = new Map<string, unknown>();
    const requestContext = {
      get: vi.fn((key: string) =>
        key === 'controller'
          ? {
              getState,
              session: {
                get modelId() {
                  return modelId;
                },
                state: { get: getState },
              },
            }
          : attributes.get(key),
      ),
      set: vi.fn((key: string, value: unknown) => attributes.set(key, value)),
    } as RequestContextStub;
    const { config } = await createMemoryConfig(state);
    const om = config.options.observationalMemory;

    expect(om.observation.model({ requestContext })).toEqual({ modelId: 'deepseek/deepseek-v4-flash' });
    expect(om.reflection.model({ requestContext })).toBe('auto');
    expect(requestContext.get('om.observer.selectionMode')).toBe('model');
    expect(requestContext.get('om.observer.effectiveModelId')).toBe('deepseek/deepseek-v4-flash');
    expect(requestContext.get('om.reflector.selectionMode')).toBe('auto');

    modelId = 'custom-provider/custom-model';
    expect(om.observation.model({ requestContext })).toEqual({ modelId: 'deepseek/deepseek-v4-flash' });
    expect(om.reflection.model({ requestContext })).toBe('auto');
    expect(requestContext.get('om.reflector.effectiveModelId')).toBe('custom-provider/custom-model');
  });

  it('uses controller state overrides and disables async buffering for resource-scoped OM', async () => {
    const { config, requestContext } = await createMemoryConfig({
      projectPath: '/tmp/project',
      omScope: 'resource',
      observationThreshold: 12_345,
      reflectionThreshold: 23_456,
      observerModelId: 'openai/gpt-5.4-mini',
      reflectorModelId: 'anthropic/claude-sonnet-4-5',
      cavemanObservations: true,
      observeAttachments: 'auto',
    });

    expect(getOmScopeMock).not.toHaveBeenCalled();

    const om = config.options.observationalMemory;
    expect(om.scope).toBe('resource');
    expect(om.observation).toMatchObject({
      bufferTokens: false,
      bufferActivation: undefined,
      messageTokens: 12_345,
      observeAttachments: 'auto',
    });
    expect(om.reflection).toMatchObject({
      bufferActivation: undefined,
      observationTokens: 23_456,
    });
    expect(om.observation.instruction).toContain('Respond terse like smart caveman');
    expect(om.reflection.instruction).toContain('Respond terse like smart caveman');

    expect(om.observation.model({ requestContext })).toEqual({ modelId: 'openai/gpt-5.4-mini' });
    expect(om.reflection.model({ requestContext })).toEqual({ modelId: 'anthropic/claude-sonnet-4-5' });
    expect(resolveModelMock).toHaveBeenNthCalledWith(1, 'openai/gpt-5.4-mini', {
      remapForCodexOAuth: true,
      requestContext,
    });
    expect(resolveModelMock).toHaveBeenNthCalledWith(2, 'anthropic/claude-sonnet-4-5', {
      remapForCodexOAuth: true,
      requestContext,
    });
  });
});

describe('pack-driven OM models (A11)', () => {
  beforeEach(() => {
    memoryConstructorMock.mockReset();
    getOmScopeMock.mockReset();
    getOmScopeMock.mockReturnValue('thread');
    resolveModelMock.mockReset();
    resolveModelMock.mockImplementation((modelId: string) => ({ modelId }));
    resolvePackMemoryModelChainMock.mockReset();
    loadSettingsMock.mockReset();
    delete process.env.MASTRACODE_EXPERIMENTAL_SUBCONSCIOUS;
    vi.unstubAllEnvs();
    vi.stubEnv('GOOGLE_GENERATIVE_AI_API_KEY', '');
  });

  it('reads role overrides and pack memory models from the configured settings file', async () => {
    // A caller pointing the agent at another settings path must not have OM
    // resolve from the default one — it would read another user's overrides.
    loadSettingsMock.mockReturnValue({ models: { activeModelPackId: 'anthropic' } });
    resolvePackMemoryModelChainMock.mockReturnValue({ modelId: 'gpt-5.4-mini' });
    const { config, requestContext } = await createMemoryConfig(
      { projectPath: '/tmp/project' },
      'thread',
      undefined,
      '/custom/settings.json',
    );

    expect(loadSettingsMock).not.toHaveBeenCalled();
    config.options.observationalMemory.observation.model({ requestContext });
    expect(loadSettingsMock).toHaveBeenCalledWith('/custom/settings.json');
    config.options.observationalMemory.reflection.model({ requestContext });
    expect(loadSettingsMock).toHaveBeenLastCalledWith('/custom/settings.json');
  });

  it('falls back to the default settings file when none is configured', async () => {
    loadSettingsMock.mockReturnValue({ models: {} });
    const { config, requestContext } = await createMemoryConfig({ projectPath: '/tmp/project' });

    config.options.observationalMemory.observation.model({ requestContext });

    expect(loadSettingsMock).toHaveBeenCalledWith(undefined);
  });

  it('resolves observer and reflector from the active pack OM chain when set', async () => {
    const chain = [
      { id: 'custom:Work:memory', model: { modelId: 'claude-haiku-4-5' } },
      { id: 'openai:memory', model: { modelId: 'gpt-5.4-mini' } },
    ];
    loadSettingsMock.mockReturnValue({ models: { activeModelPackId: 'anthropic' } });
    resolvePackMemoryModelChainMock.mockReturnValue(chain);
    const { config, requestContext } = await createMemoryConfig({
      projectPath: '/tmp/project',
      activeModelPackId: 'custom:Work',
      observerModelId: 'google/gemini-3.5-flash',
    });

    const om = config.options.observationalMemory;
    expect(om.observation.model({ requestContext })).toBe(chain);
    expect(om.reflection.model({ requestContext })).toBe(chain);
    expect(resolvePackMemoryModelChainMock).toHaveBeenCalledWith(
      { models: { activeModelPackId: 'anthropic' } },
      'custom:Work',
      { remapForCodexOAuth: true, requestContext },
    );
    expect(resolveModelMock).not.toHaveBeenCalled();
  });

  it('follows per-role settings when the active pack leaves its memory model unset', async () => {
    loadSettingsMock.mockReturnValue({ models: { activeModelPackId: 'anthropic' } });
    resolvePackMemoryModelChainMock.mockReturnValue(undefined);
    const { config, requestContext } = await createMemoryConfig({
      projectPath: '/tmp/project',
      activeModelPackId: 'anthropic',
      observerModelSelection: 'auto',
      reflectorModelSelection: 'anthropic/claude-sonnet-4-5',
      currentModelId: 'openai/gpt-5.6-sol',
    });

    const om = config.options.observationalMemory;
    expect(om.observation.model({ requestContext })).toBe('auto');
    expect(om.reflection.model({ requestContext })).toEqual({ modelId: 'anthropic/claude-sonnet-4-5' });
    expect(resolvePackMemoryModelChainMock).toHaveBeenCalledWith(
      { models: { activeModelPackId: 'anthropic' } },
      'anthropic',
      expect.anything(),
    );
  });

  it('uses auto for both roles when the active pack memory model is auto, over role pins', async () => {
    loadSettingsMock.mockReturnValue({ models: { observerModelOverride: 'openai/gpt-5-mini' } });
    resolvePackMemoryModelChainMock.mockReturnValue('auto');
    const { config, requestContext } = await createMemoryConfig({
      projectPath: '/tmp/project',
      activeModelPackId: 'custom:Work',
      observerModelSelection: 'openai/gpt-5-mini',
      reflectorModelSelection: 'anthropic/claude-sonnet-4-5',
    });

    const om = config.options.observationalMemory;
    expect(om.observation.model({ requestContext })).toBe('auto');
    expect(om.reflection.model({ requestContext })).toBe('auto');
    expect(resolveModelMock).not.toHaveBeenCalled();
  });

  it('keeps a session role pin ahead of a conflicting settings override', async () => {
    loadSettingsMock.mockReturnValue({ models: { observerModelOverride: 'openai/gpt-5-mini' } });
    const { config, requestContext } = await createMemoryConfig({
      projectPath: '/tmp/project',
      observerModelSelection: 'anthropic/claude-haiku-4-5',
      observerModelId: 'anthropic/claude-haiku-4-5',
    });

    expect(config.options.observationalMemory.observation.model({ requestContext })).toEqual({
      modelId: 'anthropic/claude-haiku-4-5',
    });
  });

  it('lets an active pack memory model win over per-role settings', async () => {
    loadSettingsMock.mockReturnValue({
      models: { observerModelOverride: 'openai/gpt-5-mini', reflectorModelOverride: null },
    });
    resolvePackMemoryModelChainMock.mockReturnValue([{ id: 'x:memory', model: { modelId: 'x' } }]);
    const { config, requestContext } = await createMemoryConfig({
      projectPath: '/tmp/project',
      activeModelPackId: 'custom:Work',
      observerModelId: 'google/gemini-3.5-flash',
      reflectorModelId: 'anthropic/claude-sonnet-4-5',
    });

    const om = config.options.observationalMemory;
    expect(om.observation.model({ requestContext })).toEqual([{ id: 'x:memory', model: { modelId: 'x' } }]);
    expect(om.reflection.model({ requestContext })).toEqual([{ id: 'x:memory', model: { modelId: 'x' } }]);
    expect(resolveModelMock).not.toHaveBeenCalled();
  });

  it('prefers the pending landed pack over the settled pack id (immediate retrigger)', async () => {
    loadSettingsMock.mockReturnValue({ models: {} });
    resolvePackMemoryModelChainMock.mockReturnValue({ modelId: 'gpt-5.4-mini' });
    const { config, requestContext } = await createMemoryConfig({
      projectPath: '/tmp/project',
      activeModelPackId: 'anthropic',
      mastracodePendingPackFallback: { fromPackId: 'anthropic', toPackId: 'openai', toModelId: 'openai/gpt-5.6-sol' },
    });

    config.options.observationalMemory.observation.model({ requestContext });

    expect(resolvePackMemoryModelChainMock).toHaveBeenCalledWith({ models: {} }, 'openai', expect.anything());
  });

  it('ignores a pending hop captured for another thread', async () => {
    loadSettingsMock.mockReturnValue({ models: {} });
    resolvePackMemoryModelChainMock.mockReturnValue(undefined);
    const { config, requestContext } = await createMemoryConfig({
      projectPath: '/tmp/project',
      activeModelPackId: 'anthropic',
      observerModelId: 'google/gemini-3.5-flash',
      mastracodePendingPackFallback: {
        fromPackId: 'anthropic',
        toPackId: 'openai',
        toModelId: 'openai/gpt-5.6-sol',
        threadId: 'thread-other',
      },
    });

    // The controller stub carries no threadId, so a foreign pending marker is ignored.
    expect(config.options.observationalMemory.observation.model({ requestContext })).toEqual({
      modelId: 'google/gemini-3.5-flash',
    });
    expect(resolvePackMemoryModelChainMock).toHaveBeenCalledWith({ models: {} }, 'anthropic', expect.anything());
  });

  it('falls back to standalone OM state when no pack in the chain defines an OM model', async () => {
    loadSettingsMock.mockReturnValue({ models: { activeModelPackId: 'anthropic' } });
    resolvePackMemoryModelChainMock.mockReturnValue(undefined);
    const { config, requestContext } = await createMemoryConfig({
      projectPath: '/tmp/project',
      observerModelId: 'openai/gpt-5.4-mini',
    });

    expect(config.options.observationalMemory.observation.model({ requestContext })).toEqual({
      modelId: 'openai/gpt-5.4-mini',
    });
  });

  it('uses only the primary chain entry for title generation', async () => {
    const chain = [
      { id: 'custom:Work:memory', model: { modelId: 'claude-haiku-4-5' } },
      { id: 'openai:memory', model: { modelId: 'gpt-5.4-mini' } },
    ];
    loadSettingsMock.mockReturnValue({ models: {} });
    resolvePackMemoryModelChainMock.mockReturnValue(chain);
    const { config, requestContext } = await createMemoryConfig({
      projectPath: '/tmp/project',
      activeModelPackId: 'custom:Work',
    });

    expect(config.options.generateTitle.model({ requestContext })).toEqual({ modelId: 'claude-haiku-4-5' });
  });
});
