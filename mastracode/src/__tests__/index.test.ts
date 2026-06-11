import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  getHarnessConstructorCalls,
  recordHarnessConfig,
  resetHarnessCaptures,
  setHarnessTestControls,
} from '../test-utils/harness-test-captures.js';

const gatewayRegistrySyncGateways = vi.fn();
const gatewayRegistryGetProviders = vi.fn(() => ({}));
const gatewayRegistryGetInstance = vi.fn(() => ({
  syncGateways: gatewayRegistrySyncGateways,
  getProviders: gatewayRegistryGetProviders,
}));
const providerRegistryMock: Record<string, unknown> = {};

vi.mock('@mastra/core/llm', () => ({
  GatewayRegistry: {
    getInstance: gatewayRegistryGetInstance,
  },
  PROVIDER_REGISTRY: providerRegistryMock,
}));

vi.mock('@mastra/core/agent', () => ({
  Agent: class {
    constructor(config: unknown) {
      agentConstructorMock(config);
    }
  },
  SignalProvider: class {},
}));

const agentConstructorMock = vi.fn();

const harnessConstructorMock = vi.fn();
const loadSettingsMock = vi.fn();
const getAvailableModePacksMock = vi.fn(() => []);
const getAvailableOmPacksMock = vi.fn(() => []);
const harnessSubscribeMock = vi.fn();
const detectProjectMock = vi.fn(() => ({
  mode: 'none',
  rootPath: process.cwd(),
  resourceId: 'project-resource',
  packageManager: 'pnpm',
  hasGit: false,
  contextFiles: [],
}));
const harnessGetCurrentThreadIdMock = vi.fn();
const harnessListThreadsMock = vi.fn();
const harnessSetStateMock = vi.fn();
const harnessSetThreadSettingMock = vi.fn();
const createMcpManagerMock = vi.fn();
const hookManagerConstructorMock = vi.fn();
const getStorageConfigMock = vi.fn(() => ({ type: 'memory' }));
const getResourceIdOverrideMock = vi.fn(() => undefined);
const getDynamicWorkspaceMock = vi.fn();
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
    signals: { unixSocketPubSub: false, experimentalGithubSignals: false },
  };
}

vi.mock('@mastra/core/harness', async importOriginal => {
  if (process.env.MASTRACODE_TEST_HARNESS_BACKEND === 'v1-compat') {
    return importOriginal();
  }

  return {
    Harness: class {
      constructor(config: unknown) {
        harnessConstructorMock(config);
        recordHarnessConfig(config);
      }
      subscribe(eventHandler: unknown) {
        harnessSubscribeMock(eventHandler);
      }
      getCurrentThreadId() {
        return harnessGetCurrentThreadIdMock();
      }
      getResourceId() {
        return 'project-resource';
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
    taskWriteTool: {},
    taskCheckTool: {},
  };
});

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
  createToolHooks: vi.fn(),
}));

vi.mock('./agents/workspace.js', () => ({
  getDynamicWorkspace: getDynamicWorkspaceMock,
}));

vi.mock('./auth/storage.js', () => ({
  AuthStorage: class {
    get() {
      return undefined;
    }
    loadStoredApiKeysIntoEnv() {}
  },
}));

vi.mock('../hooks/index.js', () => ({
  HookManager: class {
    constructor(...args: unknown[]) {
      hookManagerConstructorMock(...args);
    }
  },
}));

vi.mock('../mcp/index.js', () => ({
  createMcpManager: createMcpManagerMock,
}));

vi.mock('../onboarding/packs.js', () => ({
  getAvailableModePacks: getAvailableModePacksMock,
  getAvailableOmPacks: getAvailableOmPacksMock,
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

vi.mock('./utils/gateway-sync.js', () => ({
  syncGateways: vi.fn(),
}));

vi.mock('../utils/project.js', () => ({
  detectProject: detectProjectMock,
  getAppDataDir: vi.fn(() => '/tmp/mastracode-app-data'),
  getDatabasePath: vi.fn(() => '/tmp/mastracode-app-data/mastra.db'),
  getVectorDatabasePath: vi.fn(() => '/tmp/mastracode-app-data/mastra-vectors.db'),
  getObservabilityDatabasePath: vi.fn(() => '/tmp/mastracode-app-data/observability.duckdb'),
  getCurrentGitBranch: vi.fn(() => undefined),
  getCurrentGitBranchAsync: vi.fn(async () => undefined),
  getOmScope: vi.fn(() => 'thread'),
  getUserId: vi.fn(() => 'test-user'),
  getUserName: vi.fn(() => 'Test User'),
  getStorageConfig: getStorageConfigMock,
  getResourceIdOverride: getResourceIdOverrideMock,
}));

const createStorageMock = vi.fn((): { storage: unknown; backend?: string } => ({ storage: {} }));
const createVectorStoreMock = vi.fn(() => ({}));

vi.mock('../utils/storage-factory.js', () => ({
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
    resetHarnessCaptures();
    gatewayRegistrySyncGateways.mockReset();
    gatewayRegistryGetProviders.mockReset();
    gatewayRegistryGetProviders.mockReturnValue({});
    gatewayRegistryGetInstance.mockClear();
    createStorageMock.mockReset();
    createStorageMock.mockReturnValue({ storage: {}, backend: 'memory' });
    createVectorStoreMock.mockReset();
    createVectorStoreMock.mockReturnValue({});
    getDynamicMemoryMock.mockReset();
    harnessSubscribeMock.mockReset();
    harnessGetCurrentThreadIdMock.mockReset();
    harnessGetCurrentThreadIdMock.mockReturnValue(undefined);
    harnessListThreadsMock.mockReset();
    harnessListThreadsMock.mockResolvedValue([]);
    harnessSetStateMock.mockReset();
    harnessSetStateMock.mockResolvedValue(undefined);
    harnessSetThreadSettingMock.mockReset();
    harnessSetThreadSettingMock.mockResolvedValue(undefined);
    createMcpManagerMock.mockReset();
    hookManagerConstructorMock.mockReset();
    getStorageConfigMock.mockReset();
    getStorageConfigMock.mockReturnValue({ type: 'memory' });
    getResourceIdOverrideMock.mockReset();
    getResourceIdOverrideMock.mockReturnValue(undefined);
    getDynamicWorkspaceMock.mockReset();
    detectProjectMock.mockReset();
    detectProjectMock.mockReturnValue({
      mode: 'none',
      rootPath: process.cwd(),
      resourceId: 'project-resource',
      packageManager: 'pnpm',
      hasGit: false,
      contextFiles: [],
    });
    harnessStateMock = { cavemanObservations: false };
    setHarnessTestControls({
      subscribe: harnessSubscribeMock,
      getCurrentThreadId: harnessGetCurrentThreadIdMock,
      getResourceId: () => 'project-resource',
      getState: () => harnessStateMock,
      listThreads: harnessListThreadsMock,
      setState: harnessSetStateMock,
      setThreadSetting: harnessSetThreadSettingMock,
    });
    loadSettingsMock.mockReset();
    loadSettingsMock.mockReturnValue(createMockSettings());
    agentConstructorMock.mockReset();
    harnessConstructorMock.mockReset();
    gatewayRegistryGetInstance.mockImplementation(() => ({
      syncGateways: gatewayRegistrySyncGateways,
      getProviders: gatewayRegistryGetProviders,
    }));
    getAvailableModePacksMock.mockClear();
    getAvailableOmPacksMock.mockClear();
    for (const key of Object.keys(providerRegistryMock)) {
      delete providerRegistryMock[key];
    }
    delete process.env.MC_E2E_PRIMARY_KEY;
    delete process.env.MC_E2E_SECONDARY_KEY;
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

  it('treats registry providers with any configured API-key env var as startup provider access', async () => {
    providerRegistryMock['multi-env-provider'] = {
      apiKeyEnvVar: ['MC_E2E_PRIMARY_KEY', 'MC_E2E_SECONDARY_KEY'],
    };
    process.env.MC_E2E_SECONDARY_KEY = 'configured';
    const { createMastraCode } = await import('../index.js');

    await createMastraCode();

    expect(getAvailableModePacksMock).toHaveBeenCalledWith(expect.objectContaining({ 'multi-env-provider': 'apikey' }));
    expect(getAvailableOmPacksMock).toHaveBeenCalledWith(expect.objectContaining({ 'multi-env-provider': 'apikey' }));
  });

  it('always configures dynamic local memory at startup', async () => {
    const { createMastraCode } = await import('../index.js');

    await createMastraCode();

    expect(getHarnessConstructorCalls()).toHaveLength(1);
    const harnessConfig = getHarnessConstructorCalls()[0]?.[0] as { memory?: unknown } | undefined;
    expect(typeof harnessConfig?.memory).toBe('function');
  });

  it('uses caller memory while applying configDir to startup services and state', async () => {
    const projectPath = '/tmp/mastracode-project';
    const customMemory = { id: 'custom-memory' };
    detectProjectMock.mockReturnValue({
      mode: 'none',
      rootPath: projectPath,
      resourceId: 'project-resource',
      packageManager: 'pnpm',
      hasGit: false,
      contextFiles: [],
    });
    const { createMastraCode } = await import('../index.js');

    await createMastraCode({
      cwd: projectPath,
      configDir: '.acme-code',
      memory: customMemory as any,
      initialState: { configDir: '.wrong-code' },
    });

    const harnessConfig = getHarnessConstructorCalls()[0]?.[0] as
      | { memory?: unknown; initialState?: Record<string, unknown> }
      | undefined;
    expect(harnessConfig?.memory).toBe(customMemory);
    expect(harnessConfig?.initialState?.configDir).toBe('.acme-code');
    expect(getDynamicMemoryMock).not.toHaveBeenCalled();
    expect(getStorageConfigMock).toHaveBeenCalledWith(projectPath, expect.anything(), '.acme-code');
    expect(createMcpManagerMock).toHaveBeenCalledWith(projectPath, '.acme-code', undefined);
    expect(hookManagerConstructorMock).toHaveBeenCalledWith(projectPath, 'session-init', '.acme-code');
  });

  it('passes custom workspace config through to Harness without using the default factory', async () => {
    const customWorkspace = { id: 'custom-workspace' };
    const { createMastraCode } = await import('../index.js');

    await createMastraCode({ workspace: customWorkspace as any });

    const harnessConfig = getHarnessConstructorCalls()[0]?.[0] as { workspace?: unknown } | undefined;
    expect(harnessConfig?.workspace).toBe(customWorkspace);
    expect(getDynamicWorkspaceMock).not.toHaveBeenCalled();
  });

  it('uses a workspace factory when no custom workspace is configured', async () => {
    const { createMastraCode } = await import('../index.js');

    await createMastraCode();

    const harnessConfig = getHarnessConstructorCalls()[0]?.[0] as { workspace?: unknown } | undefined;
    expect(typeof harnessConfig?.workspace).toBe('function');
    expect(harnessConfig?.workspace).not.toEqual({ id: 'custom-workspace' });
  });

  it('uses the configured default mode when constructing Harness', async () => {
    const { createMastraCode } = await import('../index.js');

    await createMastraCode({
      modes: [
        {
          id: 'review',
          name: 'Review',
          default: true,
          defaultModelId: '__GATEWAY_OPENAI_MODEL__',
          agent: { id: 'code-agent' } as any,
        },
        {
          id: 'ship',
          name: 'Ship',
          defaultModelId: '__GATEWAY_ANTHROPIC_MODEL_OPUS__',
          agent: { id: 'code-agent' } as any,
        },
      ],
    });

    const harnessConfig = getHarnessConstructorCalls()[0]?.[0] as
      | { modes?: { id: string; default?: boolean; defaultModelId: string }[] }
      | undefined;
    expect(harnessConfig?.modes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'review', default: true, defaultModelId: '__GATEWAY_OPENAI_MODEL__' }),
        expect.objectContaining({ id: 'ship', defaultModelId: '__GATEWAY_ANTHROPIC_MODEL_OPUS__' }),
      ]),
    );
  });

  it('configures Harness project path from detected project metadata', async () => {
    const projectPath = '/tmp/mastracode-project';
    detectProjectMock.mockReturnValue({
      mode: 'none',
      rootPath: projectPath,
      resourceId: 'project-resource',
      packageManager: 'pnpm',
      hasGit: false,
      contextFiles: [],
    });
    const { createMastraCode } = await import('../index.js');

    await createMastraCode({ cwd: projectPath });

    const harnessConfig = getHarnessConstructorCalls()[0]?.[0] as
      | { initialState?: Record<string, unknown> }
      | undefined;
    expect(harnessConfig?.initialState?.projectPath).toBe(projectPath);
  });

  it('uses configured configDir consistently for startup services and runtime state', async () => {
    const projectPath = '/tmp/mastracode-project';
    detectProjectMock.mockReturnValue({
      mode: 'none',
      rootPath: projectPath,
      resourceId: 'project-resource',
      packageManager: 'pnpm',
      hasGit: false,
      contextFiles: [],
    });
    const { createMastraCode } = await import('../index.js');

    await createMastraCode({
      cwd: projectPath,
      configDir: '.acme-code',
      initialState: { configDir: '.wrong-code' },
    });

    expect(getResourceIdOverrideMock).toHaveBeenCalledWith(projectPath, '.acme-code');
    expect(getStorageConfigMock).toHaveBeenCalledWith(projectPath, expect.anything(), '.acme-code');
    expect(createMcpManagerMock).toHaveBeenCalledWith(projectPath, '.acme-code', undefined);
    expect(hookManagerConstructorMock).toHaveBeenCalledWith(projectPath, 'session-init', '.acme-code');
    const harnessConfig = getHarnessConstructorCalls()[0]?.[0] as
      | { initialState?: Record<string, unknown> }
      | undefined;
    expect(harnessConfig?.initialState?.configDir).toBe('.acme-code');
  });

  it('passes programmatic MCP servers into the startup manager with project and configDir', async () => {
    const projectPath = '/tmp/mastracode-project';
    const cwd = `${projectPath}/packages/app`;
    const mcpServers = {
      remoteDocs: {
        url: 'https://mcp.example.com/sse',
        headers: { Authorization: 'Bearer token' },
      },
      localFs: {
        command: 'npx',
        args: ['-y', '@modelcontextprotocol/server-filesystem', projectPath],
      },
    };
    detectProjectMock.mockReturnValue({
      mode: 'none',
      rootPath: projectPath,
      resourceId: 'project-resource',
      packageManager: 'pnpm',
      hasGit: false,
      contextFiles: [],
    });
    const { createMastraCode } = await import('../index.js');

    await createMastraCode({ cwd, configDir: '.acme-code', mcpServers });

    expect(createMcpManagerMock).toHaveBeenCalledWith(projectPath, '.acme-code', mcpServers);
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

    const harnessConfig = getHarnessConstructorCalls().at(-1)?.[0] as
      | { pubsub?: unknown; threadLock?: unknown }
      | undefined;
    expect(harnessConfig?.pubsub).toBe(pubsub);
    expect(harnessConfig?.threadLock).toBeDefined();
  });

  it('skips thread locks for configured PubSub when cross-process mode is explicit', async () => {
    const pubsub = {} as any;
    const { createMastraCode } = await import('../index.js');

    await createMastraCode({ pubsub, crossProcessPubSub: true });

    const harnessConfig = getHarnessConstructorCalls().at(-1)?.[0] as
      | { pubsub?: unknown; threadLock?: unknown }
      | undefined;
    expect(harnessConfig?.pubsub).toBe(pubsub);
    expect(harnessConfig?.threadLock).toBeUndefined();
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

    const harnessCall = getHarnessConstructorCalls()[0]?.[0] as
      | { initialState?: Record<string, unknown> }
      | undefined;
    expect(harnessCall?.initialState?.observeAttachments).toBe(false);
  });

  it('defaults observeAttachments to auto when global setting is null', async () => {
    const { createMastraCode } = await import('../index.js');

    await createMastraCode();

    const harnessCall = getHarnessConstructorCalls()[0]?.[0] as
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

  it('runs stream error retries before provider-specific error recovery processors', async () => {
    const { createMastraCode } = await import('../index.js');

    await createMastraCode();

    expect(agentConstructorMock).toHaveBeenCalled();
    const agentConfig = agentConstructorMock.mock.calls[0]?.[0] as
      | { errorProcessors?: Array<{ id?: string }> }
      | undefined;
    expect(agentConfig?.errorProcessors?.map(processor => processor.id)).toEqual([
      'stream-error-retry-processor',
      'prefill-error-handler',
      'provider-history-compat',
    ]);
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

  it('configures GitHubSignals as a signal provider for local PR subscriptions', async () => {
    loadSettingsMock.mockReturnValue({
      ...createMockSettings(),
      signals: { unixSocketPubSub: false, experimentalGithubSignals: true },
    });
    harnessGetCurrentThreadIdMock.mockReturnValue('thread-1');
    harnessListThreadsMock.mockResolvedValue([{ id: 'thread-1', resourceId: 'thread-resource', metadata: {} }]);
    const { GithubSignals } = await import('@mastra/github-signals');
    const startPollingForThread = vi.spyOn(GithubSignals.prototype, 'startPollingForThread').mockResolvedValue(true);
    const { createMastraCode } = await import('../index.js');

    await createMastraCode();

    expect(agentConstructorMock).toHaveBeenCalled();
    const agentConfig = agentConstructorMock.mock.calls[0]?.[0] as { signals?: Array<{ id?: string }> } | undefined;
    expect(agentConfig?.signals?.map(s => s.id)).toContain('github-signals');
    expect(startPollingForThread).toHaveBeenCalledWith(
      { threadId: 'thread-1', resourceId: 'thread-resource' },
      { pollImmediately: true },
    );
  });
});
