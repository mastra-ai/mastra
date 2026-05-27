import { beforeEach, describe, expect, it, vi } from 'vitest';

const gatewayRegistrySyncGateways = vi.fn();
const gatewayRegistryGetProviders = vi.fn(() => ({}));
const gatewayRegistryGetInstance = vi.fn(() => ({
  syncGateways: gatewayRegistrySyncGateways,
  getProviders: gatewayRegistryGetProviders,
  getLastRefreshTime: vi.fn(() => undefined),
}));
const syncGatewaysMock = vi.fn();

vi.mock('@mastra/core/llm', () => ({
  GatewayRegistry: {
    getInstance: gatewayRegistryGetInstance,
  },
  PROVIDER_REGISTRY: {},
}));

vi.mock('@mastra/core/agent', () => ({
  Agent: class {
    constructor(config: unknown) {
      agentConstructorMock(config);
    }
  },
}));

const agentConstructorMock = vi.fn();

const harnessConstructorMock = vi.fn();
const loadSettingsMock = vi.fn();
const observabilityConstructorMock = vi.fn();
const mastraStorageExporterConstructorMock = vi.fn();
const mastraPlatformExporterConstructorMock = vi.fn();
const harnessSubscribeMock = vi.fn();
const harnessGetCurrentThreadIdMock = vi.fn();
const harnessListThreadsMock = vi.fn();
const harnessSetStateMock = vi.fn();
const harnessSetThreadSettingMock = vi.fn();
let harnessStateMock: Record<string, unknown> = { cavemanObservations: false };

function createMockSettings() {
  return {
    onboarding: {
      completedAt: null,
      skippedAt: null,
      version: 0,
      modePackId: null,
      omPackId: null,
    },
    models: {
      activeModelPackId: null,
      modeDefaults: {},
      activeOmPackId: null,
      omModelOverride: null,
      observerModelOverride: null,
      reflectorModelOverride: null,
      omObservationThreshold: null,
      omReflectionThreshold: null,
      omCavemanObservations: null,
      omObserveAttachments: null,
      subagentModels: {},
    },
    preferences: {
      yolo: null,
      theme: 'auto',
      thinkingLevel: 'off',
      quietMode: false,
    },
    storage: {
      backend: 'libsql',
      libsql: {},
      pg: {},
    },
    customModelPacks: [],
    customProviders: [],
    modelUseCounts: {},
    updateDismissedVersion: null,
    memoryGateway: {},
    lsp: {},
    browser: {
      enabled: false,
      provider: 'stagehand',
      headless: false,
      viewport: { width: 1280, height: 720 },
      stagehand: { env: 'LOCAL' },
    },
    observability: { resources: {}, localTracing: false },
  };
}

vi.mock('@mastra/core/harness', () => ({
  taskWriteTool: {},
  taskCheckTool: {},
}));

vi.mock('@mastra/observability', () => ({
  Observability: class {
    constructor(config: unknown) {
      observabilityConstructorMock(config);
    }
  },
  MastraStorageExporter: class {
    constructor(config: unknown) {
      mastraStorageExporterConstructorMock(config);
    }
  },
  MastraPlatformExporter: class {
    constructor(config: unknown) {
      mastraPlatformExporterConstructorMock(config);
    }
  },
  SensitiveDataFilter: class {},
}));

vi.mock('../harness/index.js', () => ({
  createHarnessV1SubagentAgents: vi.fn(() => ({})),
  defaultStdioLeaseRecoveryPrompt: vi.fn(() => undefined),
  MastraCodeSessionLeaseRecoveryError: class extends Error {
    readonly name = 'MastraCodeSessionLeaseRecoveryError';
  },
  MastraCodeHarnessRuntime: class {
    constructor(config: unknown) {
      harnessConstructorMock(config);
    }
    subscribe(eventHandler: unknown) {
      harnessSubscribeMock(eventHandler);
    }
    getCurrentThreadId() {
      return harnessGetCurrentThreadIdMock();
    }
    getState() {
      return harnessStateMock;
    }
    listThreads(options: unknown) {
      return harnessListThreadsMock(options);
    }
    setState(state: unknown) {
      return harnessSetStateMock(state);
    }
    setThreadSetting(setting: unknown) {
      return harnessSetThreadSettingMock(setting);
    }
  },
}));

vi.mock('@mastra/core/processors', () => ({
  AgentsMDInjector: class {
    readonly id = 'agents-md-injector';
  },
  PrefillErrorHandler: class {
    readonly id = 'prefill-error-handler';
  },
  ProviderHistoryCompat: class {
    readonly id = 'provider-history-compat';
  },
  StreamErrorRetryProcessor: class {
    readonly id = 'stream-error-retry-processor';
  },
}));

vi.mock('./agents/instructions.js', () => ({
  getDynamicInstructions: vi.fn(),
}));

const getDynamicMemoryMock = vi.fn();

vi.mock('./agents/memory.js', () => ({
  getDynamicMemory: getDynamicMemoryMock,
}));

vi.mock('../agents/memory.js', () => ({
  getDynamicMemory: getDynamicMemoryMock,
}));

vi.mock('./agents/model.js', () => ({
  getDynamicModel: vi.fn(),
  resolveModel: vi.fn(),
}));

vi.mock('./agents/subagents/execute.js', () => ({
  executeSubagent: {},
}));

vi.mock('./agents/subagents/explore.js', () => ({
  exploreSubagent: {},
}));

vi.mock('./agents/subagents/plan.js', () => ({
  planSubagent: {},
}));

vi.mock('./agents/tools.js', () => ({
  createDynamicTools: vi.fn(),
}));

vi.mock('./agents/workspace.js', () => ({
  getDynamicWorkspace: vi.fn(),
}));

vi.mock('./auth/storage.js', () => ({
  AuthStorage: class {
    get() {
      return undefined;
    }
    loadStoredApiKeysIntoEnv() {}
  },
}));

vi.mock('./hooks/index.js', () => ({
  HookManager: class {},
}));

vi.mock('./mcp/index.js', () => ({
  createMcpManager: vi.fn(),
}));

vi.mock('./onboarding/packs.js', () => ({
  getAvailableModePacks: vi.fn(() => []),
  getAvailableOmPacks: vi.fn(() => []),
}));

vi.mock('../onboarding/settings.js', () => ({
  getCustomProviderId: vi.fn(),
  loadSettings: loadSettingsMock,
  MEMORY_GATEWAY_PROVIDER: 'mastra',
  resolveModelDefaults: vi.fn(() => ({ build: '', plan: '', fast: '' })),
  resolveOmModel: vi.fn(() => ''),
  resolveOmRoleModel: vi.fn(() => ''),
  saveSettings: vi.fn(),
  toCustomProviderModelId: vi.fn(),
}));

vi.mock('./permissions.js', () => ({
  getToolCategory: vi.fn(),
}));

vi.mock('./providers/claude-max.js', () => ({
  setAuthStorage: vi.fn(),
}));

vi.mock('./providers/openai-codex.js', () => ({
  setAuthStorage: vi.fn(),
}));

vi.mock('./providers/github-copilot.js', () => ({
  setAuthStorage: vi.fn(),
}));

vi.mock('./tools/index.js', () => ({
  defaultTools: {},
}));

vi.mock('./schema.js', () => ({
  stateSchema: {},
}));

vi.mock('./tui/theme.js', () => ({
  mastra: {},
}));

vi.mock('../utils/gateway-sync.js', () => ({
  syncGateways: syncGatewaysMock,
}));

vi.mock('./utils/project.js', () => ({
  detectProject: vi.fn(() => ({
    mode: 'none',
    rootPath: process.cwd(),
    packageManager: 'pnpm',
    hasGit: false,
    contextFiles: [],
  })),
  getStorageConfig: vi.fn(() => ({ type: 'memory' })),
  getResourceIdOverride: vi.fn(() => undefined),
}));

const createStorageMock = vi.fn((): { storage: unknown; backend?: string } => ({ storage: {} }));
const createVectorStoreMock = vi.fn(() => ({}));

vi.mock('./utils/storage-factory.js', () => ({
  createStorage: createStorageMock,
  createVectorStore: createVectorStoreMock,
}));

vi.mock('./utils/thread-lock.js', () => ({
  acquireThreadLock: vi.fn(),
  releaseThreadLock: vi.fn(),
}));

describe('createMastraCode', () => {
  beforeEach(() => {
    vi.resetModules();
    gatewayRegistrySyncGateways.mockReset();
    gatewayRegistryGetProviders.mockReset();
    gatewayRegistryGetProviders.mockReturnValue({});
    gatewayRegistryGetInstance.mockClear();
    createStorageMock.mockReset();
    createStorageMock.mockReturnValue({ storage: {}, backend: 'memory' });
    createVectorStoreMock.mockReset();
    createVectorStoreMock.mockReturnValue({});
    getDynamicMemoryMock.mockReset();
    observabilityConstructorMock.mockReset();
    mastraStorageExporterConstructorMock.mockReset();
    mastraPlatformExporterConstructorMock.mockReset();
    harnessSubscribeMock.mockReset();
    harnessGetCurrentThreadIdMock.mockReset();
    harnessGetCurrentThreadIdMock.mockReturnValue(undefined);
    harnessListThreadsMock.mockReset();
    harnessListThreadsMock.mockResolvedValue([]);
    harnessSetStateMock.mockReset();
    harnessSetStateMock.mockResolvedValue(undefined);
    harnessSetThreadSettingMock.mockReset();
    harnessSetThreadSettingMock.mockResolvedValue(undefined);
    harnessStateMock = { cavemanObservations: false };
    loadSettingsMock.mockReset();
    loadSettingsMock.mockReturnValue(createMockSettings());
    agentConstructorMock.mockReset();
    harnessConstructorMock.mockReset();
    syncGatewaysMock.mockReset();
    gatewayRegistryGetInstance.mockImplementation(() => ({
      syncGateways: gatewayRegistrySyncGateways,
      getProviders: gatewayRegistryGetProviders,
      getLastRefreshTime: vi.fn(() => undefined),
    }));
  });

  it('enables dynamic provider registry loading before bootstrapping auth and models', async () => {
    const { createMastraCode } = await import('../index.js');

    await createMastraCode();

    expect(gatewayRegistryGetInstance).toHaveBeenCalledWith({ useDynamicLoading: true });
  }, 10_000);

  it('starts gateway sync in the background after loading stored API keys', async () => {
    let resolveSync: (() => void) | undefined;
    gatewayRegistrySyncGateways.mockReturnValue(
      new Promise<void>(resolve => {
        resolveSync = resolve;
      }),
    );
    const { createMastraCode } = await import('../index.js');

    await expect(createMastraCode()).resolves.toBeTruthy();

    expect(gatewayRegistrySyncGateways).toHaveBeenCalledWith(true);
    resolveSync?.();
  });

  it('always configures dynamic local memory at startup', async () => {
    const { createMastraCode } = await import('../index.js');

    await createMastraCode();

    expect(getDynamicMemoryMock).toHaveBeenCalled();
  });

  it('passes the default gateway sync heartbeat handler into the MastraCode runtime', async () => {
    const { createMastraCode } = await import('../index.js');

    await createMastraCode();

    const harnessConfig = harnessConstructorMock.mock.calls[0]?.[0] as
      | { heartbeatHandlers?: Array<{ id?: string; intervalMs?: number; handler?: unknown }> }
      | undefined;
    expect(harnessConfig?.heartbeatHandlers).toHaveLength(1);
    expect(harnessConfig?.heartbeatHandlers?.[0]).toMatchObject({
      id: 'gateway-sync',
      intervalMs: 5 * 60 * 1000,
    });
    expect(typeof harnessConfig?.heartbeatHandlers?.[0]?.handler).toBe('function');
  });

  it('wires the default gateway sync heartbeat to syncGateways', async () => {
    const { createMastraCode } = await import('../index.js');

    await createMastraCode();

    const harnessConfig = harnessConstructorMock.mock.calls[0]?.[0] as
      | { heartbeatHandlers?: Array<{ handler?: () => unknown }> }
      | undefined;
    await harnessConfig?.heartbeatHandlers?.[0]?.handler?.();

    expect(syncGatewaysMock).toHaveBeenCalledOnce();
  });

  it('passes configured heartbeat handlers into the MastraCode runtime', async () => {
    const customHeartbeat = { id: 'custom-heartbeat', intervalMs: 1_000, handler: vi.fn() };
    const { createMastraCode } = await import('../index.js');

    await createMastraCode({ heartbeatHandlers: [customHeartbeat] });

    const harnessConfig = harnessConstructorMock.mock.calls[0]?.[0] as
      | { heartbeatHandlers?: Array<typeof customHeartbeat> }
      | undefined;
    expect(harnessConfig?.heartbeatHandlers).toEqual([customHeartbeat]);
  });

  it('does not attach the local storage observability exporter when local tracing is disabled', async () => {
    const { createMastraCode } = await import('../index.js');

    await createMastraCode();

    expect(mastraStorageExporterConstructorMock).not.toHaveBeenCalled();
    expect(mastraPlatformExporterConstructorMock).toHaveBeenCalledOnce();
    expect(observabilityConstructorMock).toHaveBeenCalledWith(
      expect.objectContaining({
        configs: expect.objectContaining({
          default: expect.objectContaining({
            exporters: [expect.any(Object)],
          }),
        }),
      }),
    );
  });

  it('rejects cross-process PubSub mode without a PubSub instance', async () => {
    const { createMastraCode } = await import('../index.js');

    await expect(createMastraCode({ crossProcessPubSub: true })).rejects.toThrow(
      'crossProcessPubSub requires a pubsub instance',
    );
  });

  it('keeps thread locks enabled for configured PubSub unless cross-process mode is explicit', async () => {
    const pubsub = {} as any;
    const { createMastraCode } = await import('../index.js');

    await createMastraCode({ pubsub, unixSocketPubSub: true });

    expect(harnessConstructorMock).toHaveBeenCalled();
  });

  it('skips thread locks for configured PubSub when cross-process mode is explicit', async () => {
    const pubsub = {} as any;
    const { createMastraCode } = await import('../index.js');

    await createMastraCode({ pubsub, crossProcessPubSub: true });

    expect(harnessConstructorMock).toHaveBeenCalled();
  });

  it('restores the current thread caveman observation setting at startup', async () => {
    harnessGetCurrentThreadIdMock.mockReturnValue('thread-1');
    harnessListThreadsMock.mockResolvedValue([{ id: 'thread-1', metadata: { cavemanObservations: true } }]);
    const { createMastraCode } = await import('../index.js');

    await createMastraCode();

    expect(harnessSubscribeMock).toHaveBeenCalled();
    expect(harnessListThreadsMock).toHaveBeenCalledWith({ allResources: true });
    expect(harnessSetStateMock).toHaveBeenCalledWith({ cavemanObservations: true });
  });

  it('restores an explicit false caveman observation setting at startup', async () => {
    harnessStateMock = { cavemanObservations: true };
    harnessGetCurrentThreadIdMock.mockReturnValue('thread-1');
    harnessListThreadsMock.mockResolvedValue([{ id: 'thread-1', metadata: { cavemanObservations: false } }]);
    const { createMastraCode } = await import('../index.js');

    await createMastraCode();

    expect(harnessSubscribeMock).toHaveBeenCalled();
    expect(harnessListThreadsMock).toHaveBeenCalledWith({ allResources: true });
    expect(harnessSetStateMock).toHaveBeenCalledWith({ cavemanObservations: false });
  });

  it('seeds observeAttachments from persisted global setting at startup', async () => {
    const settings = createMockSettings();
    (settings.models as { omObserveAttachments: boolean | null }).omObserveAttachments = false;
    loadSettingsMock.mockReturnValue(settings);
    const { createMastraCode } = await import('../index.js');

    await createMastraCode();

    const harnessCall = harnessConstructorMock.mock.calls[0]?.[0] as
      | { initialState?: Record<string, unknown> }
      | undefined;
    expect(harnessCall?.initialState?.observeAttachments).toBe(false);
  });

  it('defaults observeAttachments to auto when global setting is null', async () => {
    const { createMastraCode } = await import('../index.js');

    await createMastraCode();

    const harnessCall = harnessConstructorMock.mock.calls[0]?.[0] as
      | { initialState?: Record<string, unknown> }
      | undefined;
    expect(harnessCall?.initialState?.observeAttachments).toBe('auto');
  });

  it('restores observeAttachments metadata for the current thread at startup', async () => {
    harnessStateMock = { observeAttachments: true };
    harnessGetCurrentThreadIdMock.mockReturnValue('thread-1');
    harnessListThreadsMock.mockResolvedValue([{ id: 'thread-1', metadata: { observeAttachments: 'auto' } }]);
    const { createMastraCode } = await import('../index.js');

    await createMastraCode();

    expect(harnessSubscribeMock).toHaveBeenCalled();
    expect(harnessListThreadsMock).toHaveBeenCalledWith({ allResources: true });
    expect(harnessSetStateMock).toHaveBeenCalledWith({ observeAttachments: 'auto' });
  });

  it('enables OpenAI Responses stream error retries by default', async () => {
    const { createMastraCode } = await import('../index.js');

    await createMastraCode();

    expect(agentConstructorMock).toHaveBeenCalled();
    const agentConfig = agentConstructorMock.mock.calls[0]?.[0] as
      | { errorProcessors?: Array<{ id?: string }> }
      | undefined;
    expect(agentConfig?.errorProcessors?.map(processor => processor.id)).toContain('stream-error-retry-processor');
  });

  it('configures ProviderHistoryCompat for prompt and API error compatibility', async () => {
    const { createMastraCode } = await import('../index.js');

    await createMastraCode();

    expect(agentConstructorMock).toHaveBeenCalled();
    const agentConfig = agentConstructorMock.mock.calls[0]?.[0] as
      | { inputProcessors?: Array<{ id?: string }>; errorProcessors?: Array<{ id?: string }> }
      | undefined;
    expect(agentConfig?.inputProcessors?.map(processor => processor.id)).toContain('provider-history-compat');
    expect(agentConfig?.errorProcessors?.map(processor => processor.id)).toContain('provider-history-compat');
  });
});
