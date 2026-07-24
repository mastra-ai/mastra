import { beforeEach, describe, expect, it, vi } from 'vitest';

const providerRegistryMock: Record<string, unknown> = {};
const mastraCodeGatewayMock = {
  id: 'mastracode',
  name: 'MastraCode Gateway',
  fetchProviders: vi.fn(async () => ({})),
  buildUrl: vi.fn((modelId: string) => modelId),
  getApiKey: vi.fn(async () => ''),
  resolveLanguageModel: vi.fn(),
};
const createMastraCodeGatewayMock = vi.fn(() => mastraCodeGatewayMock);
const mastraCodeCatalogProviderMock = vi.fn();
const createMastraCodeModelCatalogProviderMock = vi.fn(() => mastraCodeCatalogProviderMock);
const resolveModelMock = vi.fn();

vi.mock('@mastra/core/llm', () => ({
  MastraModelGateway: class {},
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

// The code agent is built via the core `createCodingAgent` factory. Forward the
// config mastracode passes to the same constructor spy the tests assert against,
// returning a mocked Agent instance.
vi.mock('@mastra/core/coding-agent', () => ({
  createCodingAgent: (config: unknown) => {
    agentConstructorMock(config);
    return {};
  },
}));

const agentConstructorMock = vi.fn();

const controllerConstructorMock = vi.fn();
const loadSettingsMock = vi.fn();
const getAvailableModePacksMock = vi.fn(() => []);
const getAvailableOmPacksMock = vi.fn(() => []);
const controllerSubscribeMock = vi.fn();
const detectProjectMock = vi.fn(() => ({
  mode: 'none',
  rootPath: process.cwd(),
  resourceId: 'project-resource',
  packageManager: 'pnpm',
  hasGit: false,
  contextFiles: [],
}));
const controllerGetCurrentThreadIdMock = vi.fn();
const controllerListThreadsMock = vi.fn();
const controllerSetStateMock = vi.fn();
const controllerSetThreadSettingMock = vi.fn();
const createMcpManagerMock = vi.fn();
const hookManagerConstructorMock = vi.fn();
const getStorageConfigMock = vi.fn(() => ({ type: 'memory' }));
const getResourceIdOverrideMock = vi.fn(() => undefined);
const getDynamicWorkspaceMock = vi.fn();
let controllerStateMock: Record<string, unknown> = { cavemanObservations: false };

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

vi.mock('@mastra/core/agent-controller', () => ({
  AgentController: class {
    constructor(config: unknown) {
      controllerConstructorMock(config);
    }
    async init() {}
    getMastra() {
      return undefined;
    }
    async createSession() {
      return {
        subscribe: (eventHandler: unknown) => controllerSubscribeMock(eventHandler),
        identity: {
          getResourceId: () => 'project-resource',
        },
        thread: {
          getId: () => controllerGetCurrentThreadIdMock(),
          list: (options: unknown) => controllerListThreadsMock(options),
          setSetting: (setting: unknown) => controllerSetThreadSettingMock(setting),
        },
        mode: { get: () => 'build' },
        model: { get: () => 'anthropic/claude-opus-4-6' },
        state: {
          get: () => controllerStateMock,
          set: (state: unknown) => controllerSetStateMock(state),
          update: async (updater: any) => {
            const result = await updater(controllerStateMock);
            if (result?.updates) controllerSetStateMock(result.updates);
            return result?.result;
          },
        },
      };
    }
    getState() {
      return controllerStateMock;
    }
    setState(state: unknown) {
      return controllerSetStateMock(state);
    }
  },
  taskWriteTool: {},
  taskCheckTool: {},
}));

const streamErrorRetryProcessorConstructorMock = vi.fn();

vi.mock('@mastra/core/processors', () => ({
  AgentsMDInjector: class {
    readonly id = 'agents-md-injector';
  },
  isBadRequestError: (error: unknown) =>
    typeof error === 'object' &&
    error !== null &&
    'statusCode' in error &&
    (error as { statusCode?: unknown }).statusCode === 400,
  PrefillErrorHandler: class {
    readonly id = 'prefill-error-handler';
  },
  ProviderHistoryCompat: class {
    readonly id = 'provider-history-compat';
  },
  StreamErrorRetryProcessor: class {
    readonly id = 'stream-error-retry-processor';
    constructor(options?: unknown) {
      streamErrorRetryProcessorConstructorMock(options);
    }
  },
}));

vi.mock('../agents/instructions.js', () => ({
  getDynamicInstructions: vi.fn(),
}));

const getDynamicMemoryMock = vi.fn();

vi.mock('../agents/memory.js', () => ({
  getDynamicMemory: getDynamicMemoryMock,
}));

vi.mock('../agents/model.js', () => ({
  createMastraCodeGateway: createMastraCodeGatewayMock,
  createMastraCodeModelCatalogProvider: createMastraCodeModelCatalogProviderMock,
  getDynamicModel: vi.fn(),
  getGoalJudgeModel: vi.fn(),
  resolveModel: resolveModelMock,
}));

vi.mock('../agents/subagents/execute.js', () => ({
  executeSubagent: {},
}));

vi.mock('../agents/subagents/explore.js', () => ({
  exploreSubagent: {},
}));

vi.mock('../agents/subagents/plan.js', () => ({
  planSubagent: {},
}));

vi.mock('../agents/tools.js', () => ({
  createDynamicTools: vi.fn(),
  createToolHooks: vi.fn(),
}));

vi.mock('../agents/workspace.js', () => ({
  getDynamicWorkspace: getDynamicWorkspaceMock,
  getGoalJudgeTools: vi.fn(),
}));

vi.mock('../auth/storage.js', () => ({
  AuthStorage: class {
    get() {
      return undefined;
    }
    getStoredApiKey() {
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
  MASTRA_GATEWAY_PROVIDER: 'mastra',
  resolveModelDefaults: vi.fn(() => ({ build: '', plan: '', fast: '' })),
  resolveOmModel: vi.fn(() => ''),
  resolveOmRoleModel: vi.fn(() => ''),
  saveSettings: vi.fn(),
  toCustomProviderModelId: vi.fn(),
}));

vi.mock('../permissions.js', () => ({
  getToolCategory: vi.fn(),
}));

vi.mock('../providers/claude-max.js', () => ({
  setAuthStorage: vi.fn(),
}));

vi.mock('../providers/openai-codex.js', () => ({
  setAuthStorage: vi.fn(),
}));

vi.mock('../providers/github-copilot.js', () => ({
  setAuthStorage: vi.fn(),
}));

vi.mock('../providers/xai.js', () => ({
  setAuthStorage: vi.fn(),
}));

vi.mock('../tools/index.js', () => ({
  defaultTools: {},
}));

vi.mock('../schema.js', () => ({
  stateSchema: {},
}));

vi.mock('../theme-palette.js', () => ({
  mastraBrand: {},
}));

vi.mock('../utils/gateway-sync.js', () => ({
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

vi.mock('../utils/thread-lock.js', () => ({
  acquireThreadLock: vi.fn(),
  releaseThreadLock: vi.fn(),
}));

describe('createMastraCode', () => {
  beforeEach(() => {
    vi.resetModules();
    createMastraCodeGatewayMock.mockClear();
    createMastraCodeModelCatalogProviderMock.mockClear();
    mastraCodeCatalogProviderMock.mockClear();
    resolveModelMock.mockClear();
    mastraCodeGatewayMock.fetchProviders.mockClear();
    mastraCodeGatewayMock.buildUrl.mockClear();
    mastraCodeGatewayMock.getApiKey.mockClear();
    mastraCodeGatewayMock.resolveLanguageModel.mockClear();
    createStorageMock.mockReset();
    createStorageMock.mockReturnValue({ storage: {}, backend: 'memory' });
    createVectorStoreMock.mockReset();
    createVectorStoreMock.mockReturnValue({});
    getDynamicMemoryMock.mockReset();
    getDynamicMemoryMock.mockReturnValue(() => undefined);
    controllerSubscribeMock.mockReset();
    controllerGetCurrentThreadIdMock.mockReset();
    controllerGetCurrentThreadIdMock.mockReturnValue(undefined);
    controllerListThreadsMock.mockReset();
    controllerListThreadsMock.mockResolvedValue([]);
    controllerSetStateMock.mockReset();
    controllerSetStateMock.mockResolvedValue(undefined);
    controllerSetThreadSettingMock.mockReset();
    controllerSetThreadSettingMock.mockResolvedValue(undefined);
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
    controllerStateMock = { cavemanObservations: false };
    loadSettingsMock.mockReset();
    loadSettingsMock.mockReturnValue(createMockSettings());
    agentConstructorMock.mockReset();
    controllerConstructorMock.mockReset();
    streamErrorRetryProcessorConstructorMock.mockReset();
    getAvailableModePacksMock.mockClear();
    getAvailableOmPacksMock.mockClear();
    for (const key of Object.keys(providerRegistryMock)) {
      delete providerRegistryMock[key];
    }
    delete process.env.MC_E2E_PRIMARY_KEY;
    delete process.env.MC_E2E_SECONDARY_KEY;
    delete process.env.MASTRA_GATEWAY_API_KEY;
    delete process.env.MASTRA_GATEWAY_URL;
  });

  it('registers the MastraCode gateway and app-provided model hooks on AgentController', async () => {
    const { createMastraCode } = await import('../index.js');
    const subagent = { id: 'review', name: 'Review', instructions: 'Review changes' };

    await createMastraCode({ subagents: [subagent as any] });

    expect(createMastraCodeGatewayMock).toHaveBeenCalledWith({
      mastraGatewayBaseUrl: 'https://gateway-api.mastra.ai',
      mastraGatewayApiKey: undefined,
      routeThroughMastraGateway: false,
      settingsPath: undefined,
    });

    const agentControllerConfig = controllerConstructorMock.mock.calls[0]?.[0] as
      | {
          gateways?: Array<{ id?: string }>;
          subagents?: unknown[];
        }
      | undefined;
    expect(agentControllerConfig?.gateways?.[0]?.id).toBe('amazon-bedrock');
    expect(agentControllerConfig?.gateways?.[1]).toBe(mastraCodeGatewayMock);
    expect(agentControllerConfig?.subagents).toEqual([subagent]);
  }, 10_000);

  it('uses configured mastra gateway settings when creating the MastraCode gateway', async () => {
    const settings = createMockSettings();
    settings.memoryGateway = { baseUrl: 'https://gateway.example.com/v1' };
    loadSettingsMock.mockReturnValue(settings);
    const { createMastraCode } = await import('../index.js');

    await createMastraCode({ settingsPath: '/tmp/settings.json' });

    expect(createMastraCodeGatewayMock).toHaveBeenCalledWith(
      expect.objectContaining({
        mastraGatewayBaseUrl: 'https://gateway.example.com',
        settingsPath: '/tmp/settings.json',
      }),
    );
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

    expect(controllerConstructorMock).toHaveBeenCalled();
    const agentControllerConfig = controllerConstructorMock.mock.calls[0]?.[0] as { memory?: unknown } | undefined;
    expect(typeof agentControllerConfig?.memory).toBe('function');
  });

  it('passes an injected vector to dynamic memory', async () => {
    const vector = { id: 'custom-vector' };
    const { createMastraCode } = await import('../index.js');

    await createMastraCode({ vector: vector as any });

    expect(getDynamicMemoryMock).toHaveBeenCalledWith(expect.anything(), vector);
    expect(createVectorStoreMock).not.toHaveBeenCalled();
  });

  it('requires an explicit backend for unknown injected storage implementations', async () => {
    const { MastraCompositeStore } = await import('@mastra/core/storage');
    const storage = Object.create(MastraCompositeStore.prototype) as InstanceType<typeof MastraCompositeStore>;
    const { createMastraCode } = await import('../index.js');

    await expect(createMastraCode({ storage })).rejects.toThrow(
      'storageBackend is required when injecting a custom storage instance.',
    );
    expect(createStorageMock).not.toHaveBeenCalled();
  });

  // Simulates a duplicated-dependency graph: the injected store was built
  // against a different copy of @mastra/core, so `instanceof
  // MastraCompositeStore` (and `instanceof LibSQLStore`/`PostgresStore`) fail
  // even though the instance is a real store. Detection must be structural.
  describe('injected storage from a foreign @mastra/core copy', () => {
    class ForeignCompositeStore {
      stores = {};
      async init() {}
      __registerMastra() {}
    }

    it('detects a foreign LibSQLStore instance and resolves the libsql backend', async () => {
      class LibSQLStore extends ForeignCompositeStore {}
      const { createMastraCode } = await import('../index.js');

      await createMastraCode({ storage: new LibSQLStore() as any });

      expect(createStorageMock).not.toHaveBeenCalled();
    });

    it('detects a foreign PostgresStore subclass and resolves the pg backend', async () => {
      class PostgresStore extends ForeignCompositeStore {}
      class CustomPgStore extends PostgresStore {}
      const { createMastraCode } = await import('../index.js');

      await createMastraCode({ storage: new CustomPgStore() as any });

      expect(createStorageMock).not.toHaveBeenCalled();
    });

    it('accepts an unrecognized foreign store when storageBackend is configured', async () => {
      class SomeOtherStore extends ForeignCompositeStore {}
      const { createMastraCode } = await import('../index.js');

      await createMastraCode({ storage: new SomeOtherStore() as any, storageBackend: 'pg' });

      expect(createStorageMock).not.toHaveBeenCalled();
    });

    it('still requires an explicit backend for unrecognized foreign stores', async () => {
      class SomeOtherStore extends ForeignCompositeStore {}
      const { createMastraCode } = await import('../index.js');

      await expect(createMastraCode({ storage: new SomeOtherStore() as any })).rejects.toThrow(
        'storageBackend is required when injecting a custom storage instance.',
      );
      expect(createStorageMock).not.toHaveBeenCalled();
    });
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

    const agentControllerConfig = controllerConstructorMock.mock.calls[0]?.[0] as
      { memory?: unknown; initialState?: Record<string, unknown> } | undefined;
    expect(agentControllerConfig?.memory).toBe(customMemory);
    expect(agentControllerConfig?.initialState?.configDir).toBe('.acme-code');
    expect(getDynamicMemoryMock).not.toHaveBeenCalled();
    expect(getStorageConfigMock).toHaveBeenCalledWith(projectPath, expect.anything(), '.acme-code');
    expect(createMcpManagerMock).toHaveBeenCalledWith(projectPath, '.acme-code', undefined);
    expect(hookManagerConstructorMock).toHaveBeenCalledWith(projectPath, 'session-init', '.acme-code', undefined);
  });

  it('passes custom workspace config through to AgentController without using the default factory', async () => {
    const customWorkspace = { id: 'custom-workspace' };
    const { createMastraCode } = await import('../index.js');

    await createMastraCode({ workspace: customWorkspace as any });

    const agentControllerConfig = controllerConstructorMock.mock.calls[0]?.[0] as { workspace?: unknown } | undefined;
    expect(agentControllerConfig?.workspace).toBe(customWorkspace);
    expect(getDynamicWorkspaceMock).not.toHaveBeenCalled();
  });

  it('uses a workspace factory when no custom workspace is configured', async () => {
    const { createMastraCode } = await import('../index.js');

    await createMastraCode();

    const agentControllerConfig = controllerConstructorMock.mock.calls[0]?.[0] as { workspace?: unknown } | undefined;
    expect(typeof agentControllerConfig?.workspace).toBe('function');
    expect(agentControllerConfig?.workspace).not.toEqual({ id: 'custom-workspace' });
  });

  it('adds active plugin tool names to mode availableTools allowlists and seeds plugin instructions', async () => {
    const { createMastraCode } = await import('../index.js');
    const pluginManager = {
      reload: vi.fn(async () => [
        { id: 'acme.plugin', status: 'active', toolNames: ['plugin_tool'], instructions: 'Use plugin policy.' },
      ]),
      getPluginTools: vi.fn(() => ({ plugin_tool: { id: 'plugin_tool' } })),
    };

    await createMastraCode({ pluginManager: pluginManager as any });

    const agentControllerConfig = controllerConstructorMock.mock.calls[0]?.[0] as
      { modes?: Array<{ id: string; availableTools?: string[] }>; initialState?: Record<string, unknown> } | undefined;
    expect(agentControllerConfig?.modes?.find(mode => mode.id === 'plan')?.availableTools).toContain('plugin_tool');
    expect(agentControllerConfig?.modes?.find(mode => mode.id === 'fast')?.availableTools).toContain('plugin_tool');
    expect(agentControllerConfig?.initialState?.pluginInstructions).toEqual(['Use plugin policy.']);
  });

  it('registers the TaskSignalProvider on the code agent so task tools persist via state signals', async () => {
    const { TaskSignalProvider } = await import('@mastra/core/signals');
    const { createMastraCode } = await import('../index.js');

    await createMastraCode();

    expect(agentConstructorMock).toHaveBeenCalled();
    const codeAgentConfig = agentConstructorMock.mock.calls
      .map(call => call?.[0] as { id?: string; signals?: unknown[] } | undefined)
      .find(config => config?.id === 'code-agent');

    expect(codeAgentConfig).toBeDefined();
    expect(codeAgentConfig?.signals?.some(provider => provider instanceof TaskSignalProvider)).toBe(true);
  });

  it('uses the configured default mode when constructing AgentController', async () => {
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

    const agentControllerConfig = controllerConstructorMock.mock.calls[0]?.[0] as
      { modes?: { id: string; default?: boolean; defaultModelId: string }[] } | undefined;
    expect(agentControllerConfig?.modes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'review', default: true, defaultModelId: '__GATEWAY_OPENAI_MODEL__' }),
        expect.objectContaining({ id: 'ship', defaultModelId: '__GATEWAY_ANTHROPIC_MODEL_OPUS__' }),
      ]),
    );
  });

  it('configures AgentController project path from detected project metadata', async () => {
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

    const agentControllerConfig = controllerConstructorMock.mock.calls[0]?.[0] as
      { initialState?: Record<string, unknown> } | undefined;
    expect(agentControllerConfig?.initialState?.projectPath).toBe(projectPath);
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
    expect(hookManagerConstructorMock).toHaveBeenCalledWith(projectPath, 'session-init', '.acme-code', undefined);
    const agentControllerConfig = controllerConstructorMock.mock.calls[0]?.[0] as
      { initialState?: Record<string, unknown> } | undefined;
    expect(agentControllerConfig?.initialState?.configDir).toBe('.acme-code');
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

    const agentControllerConfig = controllerConstructorMock.mock.calls.at(-1)?.[0] as
      { pubsub?: unknown; threadLock?: unknown } | undefined;
    expect(agentControllerConfig?.pubsub).toBe(pubsub);
    expect(agentControllerConfig?.threadLock).toBeDefined();
  });

  it('skips thread locks for configured PubSub when cross-process mode is explicit', async () => {
    const pubsub = {} as any;
    const { createMastraCode } = await import('../index.js');

    await createMastraCode({ pubsub, crossProcessPubSub: true });

    const agentControllerConfig = controllerConstructorMock.mock.calls.at(-1)?.[0] as
      { pubsub?: unknown; threadLock?: unknown } | undefined;
    expect(agentControllerConfig?.pubsub).toBe(pubsub);
    expect(agentControllerConfig?.threadLock).toBeUndefined();
  });

  it('restores the current thread caveman observation setting at startup', async () => {
    controllerGetCurrentThreadIdMock.mockReturnValue('thread-1');
    controllerListThreadsMock.mockResolvedValue([{ id: 'thread-1', metadata: { cavemanObservations: true } }]);
    const { createMastraCode } = await import('../index.js');

    await createMastraCode();

    expect(controllerSubscribeMock).toHaveBeenCalled();
    expect(controllerListThreadsMock).toHaveBeenCalledWith({ allResources: true });
    expect(controllerSetStateMock).toHaveBeenCalledWith({ cavemanObservations: true });
  });

  it('restores an explicit false caveman observation setting at startup', async () => {
    controllerStateMock = { cavemanObservations: true };
    controllerGetCurrentThreadIdMock.mockReturnValue('thread-1');
    controllerListThreadsMock.mockResolvedValue([{ id: 'thread-1', metadata: { cavemanObservations: false } }]);
    const { createMastraCode } = await import('../index.js');

    await createMastraCode();

    expect(controllerSubscribeMock).toHaveBeenCalled();
    expect(controllerListThreadsMock).toHaveBeenCalledWith({ allResources: true });
    expect(controllerSetStateMock).toHaveBeenCalledWith({ cavemanObservations: false });
  });

  it('seeds observeAttachments from persisted global setting at startup', async () => {
    const settings = createMockSettings();
    (settings.models as { omObserveAttachments: boolean | null }).omObserveAttachments = false;
    loadSettingsMock.mockReturnValue(settings);
    const { createMastraCode } = await import('../index.js');

    await createMastraCode();

    const agentControllerCall = controllerConstructorMock.mock.calls[0]?.[0] as
      { initialState?: Record<string, unknown> } | undefined;
    expect(agentControllerCall?.initialState?.observeAttachments).toBe(false);
  });

  it('defaults observeAttachments to auto when global setting is null', async () => {
    const { createMastraCode } = await import('../index.js');

    await createMastraCode();

    const agentControllerCall = controllerConstructorMock.mock.calls[0]?.[0] as
      { initialState?: Record<string, unknown> } | undefined;
    expect(agentControllerCall?.initialState?.observeAttachments).toBe('auto');
  });

  it('restores observeAttachments metadata for the current thread at startup', async () => {
    controllerStateMock = { observeAttachments: true };
    controllerGetCurrentThreadIdMock.mockReturnValue('thread-1');
    controllerListThreadsMock.mockResolvedValue([{ id: 'thread-1', metadata: { observeAttachments: 'auto' } }]);
    const { createMastraCode } = await import('../index.js');

    await createMastraCode();

    expect(controllerSubscribeMock).toHaveBeenCalled();
    expect(controllerListThreadsMock).toHaveBeenCalledWith({ allResources: true });
    expect(controllerSetStateMock).toHaveBeenCalledWith({ observeAttachments: 'auto' });
  });

  it('runs provider history compat before stream error retries so bad requests are repaired, not blindly retried', async () => {
    const { createMastraCode } = await import('../index.js');

    await createMastraCode();

    expect(agentConstructorMock).toHaveBeenCalled();
    // createCodingAgent and workflowBuilderAgent both hit this mock; pick the
    // code-agent config by the processors under test (not calls[0], which is the
    // eagerly-constructed workflow-builder).
    const agentConfig = agentConstructorMock.mock.calls
      .map(call => call[0] as { errorProcessors?: Array<{ id?: string }> } | undefined)
      .find(config => config?.errorProcessors?.some(p => p.id === 'stream-error-retry-processor'));
    expect(agentConfig?.errorProcessors?.map(processor => processor.id)).toEqual([
      'provider-history-compat',
      'stream-error-retry-processor',
      'prefill-error-handler',
    ]);
  });

  it('configures a single StreamErrorRetryProcessor with per-matcher policies', async () => {
    const { createMastraCode } = await import('../index.js');

    await createMastraCode();

    expect(streamErrorRetryProcessorConstructorMock).toHaveBeenCalledTimes(1);
    const options = streamErrorRetryProcessorConstructorMock.mock.calls[0]?.[0] as
      { matchers?: Array<{ match?: unknown; maxRetries?: number; delayMs?: unknown }> } | undefined;
    expect(options?.matchers).toHaveLength(2);

    // First matcher: Bad Request (400) with maxRetries 1 and 2s delay.
    const badRequestPolicy = options!.matchers![0]!;
    expect(typeof badRequestPolicy.match).toBe('function');
    expect(badRequestPolicy.maxRetries).toBe(1);
    expect(badRequestPolicy.delayMs).toBe(2000);

    // Second matcher: transient connection failures with maxRetries 2 and exponential backoff.
    const transientConnectionPolicy = options!.matchers![1] as {
      match?: (error: unknown) => boolean;
      maxRetries?: number;
      delayMs?: (args: { retryCount: number }) => number;
    };
    expect(typeof transientConnectionPolicy.match).toBe('function');
    expect(transientConnectionPolicy.match!(Object.assign(new Error('write EPIPE'), { code: 'EPIPE' }))).toBe(true);
    expect(transientConnectionPolicy.match!(new Error('Cannot connect to API: other side closed'))).toBe(true);
    expect(transientConnectionPolicy.maxRetries).toBe(2);
    expect(typeof transientConnectionPolicy.delayMs).toBe('function');
    expect(transientConnectionPolicy.delayMs!({ retryCount: 0 })).toBe(1000);
    expect(transientConnectionPolicy.delayMs!({ retryCount: 1 })).toBe(2000);
    expect(transientConnectionPolicy.delayMs!({ retryCount: 2 })).toBe(4000);
    // High retry counts are capped at the max delay (30000ms).
    expect(transientConnectionPolicy.delayMs!({ retryCount: 10 })).toBe(30000);
  });

  it('prepends embedding input processors without replacing mandatory built-ins', async () => {
    const { createMastraCode } = await import('../index.js');
    const customProcessor = { id: 'embedding-reconciler', processInputStep: vi.fn() };

    await createMastraCode({ inputProcessors: [customProcessor] });

    const agentConfig = agentConstructorMock.mock.calls[0]?.[0] as
      { inputProcessors?: Array<{ id?: string }> } | undefined;
    const processors = agentConfig?.inputProcessors ?? [];
    expect(processors[0]).toBe(customProcessor);
    expect(processors.map(processor => processor.id)).toEqual([
      'embedding-reconciler',
      'plan-rejection-abort',
      'agents-md-injector',
      'provider-history-compat',
    ]);
  });

  it('configures ProviderHistoryCompat for prompt and API error compatibility', async () => {
    const { createMastraCode } = await import('../index.js');

    await createMastraCode();

    expect(agentConstructorMock).toHaveBeenCalled();
    const agentConfig = agentConstructorMock.mock.calls
      .map(
        call =>
          call[0] as { inputProcessors?: Array<{ id?: string }>; errorProcessors?: Array<{ id?: string }> } | undefined,
      )
      .find(config => config?.errorProcessors?.some(p => p.id === 'provider-history-compat'));
    expect(agentConfig?.inputProcessors?.map(processor => processor.id)).toContain('provider-history-compat');
    expect(agentConfig?.errorProcessors?.map(processor => processor.id)).toContain('provider-history-compat');
  });

  it('does not configure the polling GitHub provider when the embedding disables it', async () => {
    loadSettingsMock.mockReturnValue({
      ...createMockSettings(),
      signals: { unixSocketPubSub: false, experimentalGithubSignals: true },
    });
    const { createMastraCode } = await import('../index.js');

    await createMastraCode({ disableGithubSignals: true });

    // github-signals is wired on the code-agent; find a config that has a signals array.
    const agentConfigs = agentConstructorMock.mock.calls.map(
      call => call[0] as { signals?: Array<{ id?: string }> } | undefined,
    );
    const hasGithub = agentConfigs.some(config => config?.signals?.some(s => s.id === 'github-signals'));
    expect(hasGithub).toBe(false);
  });

  it('configures GitHubSignals as a signal provider for local PR subscriptions', async () => {
    loadSettingsMock.mockReturnValue({
      ...createMockSettings(),
      signals: { unixSocketPubSub: false, experimentalGithubSignals: true },
    });
    controllerGetCurrentThreadIdMock.mockReturnValue('thread-1');
    controllerListThreadsMock.mockResolvedValue([{ id: 'thread-1', resourceId: 'thread-resource', metadata: {} }]);
    const { GithubSignals } = await import('@mastra/github-signals');
    const startPollingForThread = vi.spyOn(GithubSignals.prototype, 'startPollingForThread').mockResolvedValue(true);
    const { createMastraCode } = await import('../index.js');

    await createMastraCode();

    expect(agentConstructorMock).toHaveBeenCalled();
    const agentConfig = agentConstructorMock.mock.calls
      .map(call => call[0] as { signals?: Array<{ id?: string }> } | undefined)
      .find(config => config?.signals?.some(s => s.id === 'github-signals'));
    expect(agentConfig?.signals?.map(s => s.id)).toContain('github-signals');
    expect(startPollingForThread).toHaveBeenCalledWith(
      { threadId: 'thread-1', resourceId: 'thread-resource' },
      { pollImmediately: true },
    );
  });
});
