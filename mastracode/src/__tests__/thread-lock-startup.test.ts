import { beforeEach, describe, expect, it, vi } from 'vitest';

const harnessConstructorMock = vi.fn();
const createStorageMock = vi.fn((): { storage: unknown; backend?: string } => ({ storage: {} }));
const createVectorStoreMock = vi.fn(() => ({}));
const acquireThreadLockMock = vi.fn();
const releaseThreadLockMock = vi.fn();
const syncGatewaysMock = vi.fn();

vi.mock('@mastra/core/agent', () => ({
  Agent: class {},
}));

vi.mock('@mastra/core/harness', () => ({
  Harness: class {
    constructor(config: unknown) {
      harnessConstructorMock(config);
    }
    subscribe() {}
  },
}));

vi.mock('@mastra/core/llm', () => ({
  GatewayRegistry: {
    getInstance: vi.fn(() => ({
      syncGateways: syncGatewaysMock,
      getProviders: vi.fn(() => ({})),
    })),
  },
  PROVIDER_REGISTRY: {},
}));

vi.mock('@mastra/core/processors', () => ({
  AgentsMDInjector: class {},
  PrefillErrorHandler: class {},
  ProviderHistoryCompat: class {},
  StreamErrorRetryProcessor: class {},
}));

vi.mock('@mastra/core/storage', () => ({
  MastraCompositeStore: class {
    constructor(readonly config: unknown) {}
  },
}));

vi.mock('@mastra/duckdb', () => ({
  DuckDBStore: class {},
}));

vi.mock('@mastra/observability', () => ({
  Observability: class {
    constructor(readonly config: unknown) {}
  },
  MastraStorageExporter: class {
    constructor(readonly config: unknown) {}
  },
  MastraPlatformExporter: class {
    constructor(readonly config: unknown) {}
  },
  SensitiveDataFilter: class {},
}));

vi.mock('../agents/instructions.js', () => ({ getDynamicInstructions: vi.fn() }));
vi.mock('../agents/memory.js', () => ({ getDynamicMemory: vi.fn(() => vi.fn()) }));
vi.mock('../agents/model.js', () => ({ getDynamicModel: vi.fn(), resolveModel: vi.fn() }));
vi.mock('../agents/prompts/agent-instructions.js', () => ({ getStaticallyLoadedInstructionPaths: vi.fn(() => []) }));
vi.mock('../agents/subagents/execute.js', () => ({ executeSubagent: { id: 'execute' } }));
vi.mock('../agents/subagents/explore.js', () => ({ exploreSubagent: { id: 'explore' } }));
vi.mock('../agents/subagents/plan.js', () => ({ planSubagent: { id: 'plan' } }));
vi.mock('../agents/thread-caveman-state.js', () => ({
  attachCavemanThreadStatePersistence: vi.fn(),
  restoreCavemanForCurrentThread: vi.fn(() => Promise.resolve()),
}));
vi.mock('../agents/tools.js', () => ({ createDynamicTools: vi.fn(() => ({})) }));
vi.mock('../agents/workspace.js', () => ({ getDynamicWorkspace: vi.fn() }));
vi.mock('../auth/storage.js', () => ({
  AuthStorage: class {
    get() {
      return undefined;
    }
    getStoredApiKey() {
      return undefined;
    }
    hasStoredApiKey() {
      return false;
    }
    isLoggedIn() {
      return false;
    }
    loadStoredApiKeysIntoEnv() {}
  },
}));
vi.mock('../evals/scorers/index.js', () => ({
  createOutcomeScorer: vi.fn(() => ({})),
  createEfficiencyScorer: vi.fn(() => ({})),
}));
vi.mock('../hooks/index.js', () => ({
  HookManager: class {
    setSessionId() {}
  },
}));
vi.mock('../mcp/index.js', () => ({ createMcpManager: vi.fn() }));
vi.mock('../onboarding/packs.js', () => ({
  getAvailableModePacks: vi.fn(() => []),
  getAvailableOmPacks: vi.fn(() => []),
}));
vi.mock('../onboarding/settings.js', () => ({
  getCustomProviderId: vi.fn(),
  loadSettings: vi.fn(() => ({
    models: {
      modeDefaults: {},
      omObservationThreshold: null,
      omReflectionThreshold: null,
      omCavemanObservations: null,
      subagentModels: {},
    },
    preferences: { yolo: null, thinkingLevel: 'off' },
    storage: { backend: 'libsql', libsql: {}, pg: {} },
    customProviders: [],
    modelUseCounts: {},
    memoryGateway: {},
    observability: { resources: {}, localTracing: false },
  })),
  MEMORY_GATEWAY_PROVIDER: 'mastra',
  OBSERVABILITY_AUTH_PREFIX: 'observability:',
  resolveModelDefaults: vi.fn(() => ({})),
  resolveOmRoleModel: vi.fn(() => undefined),
  saveSettings: vi.fn(),
  toCustomProviderModelId: vi.fn(),
}));
vi.mock('../permissions.js', () => ({ getToolCategory: vi.fn() }));
vi.mock('../providers/claude-max.js', () => ({ setAuthStorage: vi.fn() }));
vi.mock('../providers/github-copilot.js', () => ({
  getCopilotModelCatalog: vi.fn(() => Promise.resolve([])),
  setAuthStorage: vi.fn(),
}));
vi.mock('../providers/openai-codex.js', () => ({ setAuthStorage: vi.fn() }));
vi.mock('../schema.js', () => ({ stateSchema: {} }));
vi.mock('../tui/theme.js', () => ({ mastra: { green: 'green', purple: 'purple', orange: 'orange' } }));
vi.mock('../utils/gateway-sync.js', () => ({ syncGateways: syncGatewaysMock }));
vi.mock('../utils/project.js', () => ({
  detectProject: vi.fn(() => ({
    rootPath: process.cwd(),
    resourceId: 'resource-1',
    name: 'project',
    gitBranch: 'main',
  })),
  getObservabilityDatabasePath: vi.fn(() => ':memory:'),
  getStorageConfig: vi.fn(() => ({ type: 'memory' })),
  getResourceIdOverride: vi.fn(() => undefined),
}));
vi.mock('../utils/storage-factory.js', () => ({
  createStorage: createStorageMock,
  createVectorStore: createVectorStoreMock,
}));
vi.mock('../utils/thread-lock.js', () => ({
  acquireThreadLock: acquireThreadLockMock,
  releaseThreadLock: releaseThreadLockMock,
}));

describe('createMastraCode thread lock startup config', () => {
  beforeEach(() => {
    vi.resetModules();
    harnessConstructorMock.mockReset();
    createStorageMock.mockClear();
    createVectorStoreMock.mockClear();
    acquireThreadLockMock.mockClear();
    releaseThreadLockMock.mockClear();
    syncGatewaysMock.mockClear();
  });

  it('keeps file thread locks when cross-process PubSub mode is disabled', async () => {
    const { createMastraCode } = await import('../index.js');

    await createMastraCode();

    expect(harnessConstructorMock).toHaveBeenCalled();
    const harnessConfig = harnessConstructorMock.mock.calls[0]?.[0] as
      | { pubsub?: unknown; threadLock?: unknown }
      | undefined;
    expect(harnessConfig?.pubsub).toBeUndefined();
    expect(harnessConfig?.threadLock).toEqual({
      acquire: acquireThreadLockMock,
      release: releaseThreadLockMock,
    });
  });

  it('rejects cross-process PubSub mode before storage or Harness setup when PubSub is missing', async () => {
    const { createMastraCode } = await import('../index.js');

    await expect(createMastraCode({ crossProcessPubSub: true })).rejects.toThrow(
      'crossProcessPubSub requires config.pubsub',
    );

    expect(createStorageMock).not.toHaveBeenCalled();
    expect(harnessConstructorMock).not.toHaveBeenCalled();
  });

  it('uses configured PubSub instead of file thread locks for cross-process PubSub mode', async () => {
    const pubsub = { id: 'shared-pubsub' };
    const { createMastraCode } = await import('../index.js');

    await createMastraCode({ pubsub: pubsub as never, crossProcessPubSub: true });

    expect(harnessConstructorMock).toHaveBeenCalled();
    const harnessConfig = harnessConstructorMock.mock.calls[0]?.[0] as
      | { pubsub?: unknown; threadLock?: unknown }
      | undefined;
    expect(harnessConfig?.pubsub).toBe(pubsub);
    expect(harnessConfig?.threadLock).toBeUndefined();
  });
});
