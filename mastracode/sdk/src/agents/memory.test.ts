import { beforeEach, describe, expect, it, vi } from 'vitest';

const memoryConstructorMock = vi.fn();
const getOmScopeMock = vi.fn();
const resolveModelMock = vi.fn();

vi.mock('@mastra/memory', () => ({
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

vi.mock('./model.js', () => ({
  resolveModel: resolveModelMock,
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
    [
      'controller',
      {
        getState,
        session: { id: sessionId, ownerId: 'mastracode-owner', state: { get: getState } },
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
    delete process.env.MASTRACODE_EXPERIMENTAL_SUBCONSCIOUS;
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

    expect(om.observation.model({ requestContext })).toEqual({ modelId: 'google/gemini-3.5-flash' });
    expect(requestContext.get('user')).toEqual({ workosId: 'user-1', organizationId: 'org-1' });
    expect(resolveModelMock).toHaveBeenLastCalledWith('google/gemini-3.5-flash', {
      remapForCodexOAuth: true,
      requestContext,
    });
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
    expect(requestContext.get('organizationId')).toBe('local');
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

  it('curates local (TUI/studio) knowledge under the explicit local scope, never the session owner', async () => {
    process.env.MASTRACODE_EXPERIMENTAL_SUBCONSCIOUS = '1';
    const { getDynamicMemory, LOCAL_KNOWLEDGE_ORG_ID } = await import('./memory.js');
    expect(LOCAL_KNOWLEDGE_ORG_ID).toBe('local');

    const { requestContext } = await createMemoryConfig({ projectPath: '/tmp/project' }, 'thread', { vector: true });
    const org = requestContext.get('organizationId');
    expect(org).toBe('local');
    expect(org).not.toBe('mastracode-owner');
    expect(org).not.toBe('mastra-code');
    expect(typeof getDynamicMemory).toBe('function');
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
