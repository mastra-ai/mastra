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
    observationalMemory: {
      enabled: boolean;
      temporalMarkers: boolean;
      retrieval: unknown;
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
};

function createRequestContext(state: Record<string, unknown>): RequestContextStub {
  const getState = () => state;
  return {
    get: vi.fn(key => (key === 'controller' ? { getState, session: { state: { get: getState } } } : undefined)),
  };
}

async function createMemoryConfig(state: Record<string, unknown>, projectScope: 'thread' | 'resource' = 'thread') {
  vi.resetModules();
  memoryConstructorMock.mockClear();
  getOmScopeMock.mockReturnValue(projectScope);

  const { getDynamicMemory } = await import('./memory.js');
  const storage = { storage: true };
  const requestContext = createRequestContext(state);

  const memory = getDynamicMemory(storage as never)({ requestContext: requestContext as never }) as unknown as {
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
  });

  it('wires Mastra Code observational memory activation defaults into core memory', async () => {
    const { config, requestContext } = await createMemoryConfig({ projectPath: '/tmp/project' });

    expect(getOmScopeMock).toHaveBeenCalledWith('/tmp/project');
    expect(config.storage).toEqual({ storage: true });
    expect(config.vector).toBe(false);
    expect(config.embedder).toBeUndefined();

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
    expect(resolveModelMock).toHaveBeenLastCalledWith('google/gemini-3.5-flash', {
      remapForCodexOAuth: true,
      requestContext,
    });
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
