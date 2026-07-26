import { describe, expect, it, vi, beforeEach } from 'vitest';

// Captures the createSession() args so tests can assert on wiring (e.g.
// id/ownerId). Hoisted so the vi.mock factory can reference it.
const createSessionCalls = vi.hoisted<Array<{ id?: string; ownerId?: string; resourceId?: string }>>(() => []);

// Captures the AgentController constructor initialState so tests can assert on
// which settings.json values were seeded into session state.
const controllerInitialStates = vi.hoisted<Array<Record<string, unknown>>>(() => []);

vi.mock('@mastra/core/llm', () => ({
  MastraModelGateway: class {},
  GatewayRegistry: {
    getInstance: vi.fn(() => ({
      syncGateways: vi.fn(),
      getProviders: vi.fn(() => ({})),
    })),
  },
  PROVIDER_REGISTRY: {},
}));

vi.mock('@mastra/core/agent', () => ({
  Agent: class {},
  SignalProvider: class {},
}));

vi.mock('@mastra/core/agent-controller', () => ({
  AgentController: class {
    constructor(config: {
      resourceId?: string;
      initialState?: Record<string, unknown>;
      intervalHandlers?: Array<{ immediate?: boolean; handler: () => unknown }>;
    }) {
      controllerInitialStates.push(config.initialState ?? {});
      for (const interval of config.intervalHandlers ?? []) {
        if (interval.immediate !== false) void interval.handler();
      }
    }

    async init() {}

    getMastra() {
      return undefined;
    }

    async createSession(args?: { id?: string; ownerId?: string; resourceId?: string }) {
      createSessionCalls.push({ id: args?.id, ownerId: args?.ownerId, resourceId: args?.resourceId });
      return {
        subscribe() {},
        thread: { getId: () => undefined },
      };
    }
  },
  taskWriteTool: {},
  taskCheckTool: {},
}));

vi.mock('@mastra/core/processors', () => ({
  AgentsMDInjector: class {},
  isBadRequestError: (error: unknown) =>
    typeof error === 'object' &&
    error !== null &&
    'statusCode' in error &&
    (error as { statusCode?: unknown }).statusCode === 400,
  PrefillErrorHandler: class {},
  ProviderHistoryCompat: class {},
  StreamErrorRetryProcessor: class {},
}));

vi.mock('./agents/instructions.js', () => ({
  getDynamicInstructions: vi.fn(),
}));

vi.mock('./agents/memory.js', () => ({
  getDynamicMemory: vi.fn(),
}));

vi.mock('./agents/model.js', () => ({
  createMastraCodeGateway: vi.fn(() => ({})),
  createMastraCodeModelCatalogProvider: vi.fn(() => vi.fn()),
  getDynamicModel: vi.fn(),
  getGoalJudgeModel: vi.fn(),
  resolveModel: vi.fn(),
}));

vi.mock('./agents/subagents/execute.js', () => ({ executeSubagent: {} }));
vi.mock('./agents/subagents/explore.js', () => ({ exploreSubagent: {} }));
vi.mock('./agents/subagents/plan.js', () => ({ planSubagent: {} }));
vi.mock('./agents/tools.js', () => ({ createDynamicTools: vi.fn(), createToolHooks: vi.fn() }));
vi.mock('./agents/workspace.js', () => ({ getDynamicWorkspace: vi.fn(), getGoalJudgeTools: vi.fn() }));

vi.mock('./auth/storage.js', () => ({
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

vi.mock('./hooks/index.js', () => ({ HookManager: class {} }));
vi.mock('./mcp/index.js', () => ({ createMcpManager: vi.fn() }));

vi.mock('./onboarding/packs.js', () => ({
  getAvailableModePacks: vi.fn(() => []),
  getAvailableOmPacks: vi.fn(() => []),
}));

vi.mock('./onboarding/settings.js', () => ({
  getCustomProviderId: vi.fn(),
  loadSettings: vi.fn(() => ({
    onboarding: { completedAt: null, skippedAt: null, version: 0, modePackId: null, omPackId: null },
    models: {
      activeModelPackId: null,
      modeDefaults: {},
      activeOmPackId: null,
      omModelOverride: null,
      observerModelOverride: null,
      reflectorModelOverride: null,
      omObservationThreshold: null,
      omReflectionThreshold: null,
      subagentModels: {},
    },
    preferences: { yolo: null, theme: 'auto', thinkingLevel: 'off', quietMode: false },
    storage: { backend: 'libsql', libsql: {}, pg: {} },
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
  })),
  MASTRA_GATEWAY_PROVIDER: 'mastra',
  resolveModelDefaults: vi.fn(() => ({ build: '', plan: '', fast: '' })),
  resolveOmModel: vi.fn(() => ''),
  resolveOmRoleModel: vi.fn(() => ''),
  saveSettings: vi.fn(),
  toCustomProviderModelId: vi.fn(),
}));

vi.mock('./permissions.js', () => ({ getToolCategory: vi.fn() }));

vi.mock('./providers/claude-max.js', () => ({
  setAuthStorage: vi.fn(),
}));

vi.mock('./providers/openai-codex.js', () => ({
  setAuthStorage: vi.fn(),
}));

vi.mock('./providers/github-copilot.js', () => ({
  setAuthStorage: vi.fn(),
}));

vi.mock('./providers/xai.js', () => ({
  setAuthStorage: vi.fn(),
}));

vi.mock('./tools/index.js', () => ({ defaultTools: {} }));
vi.mock('./schema.js', () => ({ stateSchema: {} }));
vi.mock('./tui/theme.js', () => ({ mastra: {} }));
vi.mock('./utils/gateway-sync.js', () => ({ syncGateways: vi.fn() }));

vi.mock('./utils/project.js', () => ({
  detectProject: vi.fn((cwd?: string) => ({
    mode: 'none',
    rootPath: cwd ?? process.cwd(),
    resourceId: `mock-resource-${cwd ?? process.cwd()}`,
    packageManager: 'pnpm',
    hasGit: false,
    contextFiles: [],
  })),
  getStorageConfig: vi.fn(() => ({ type: 'memory' })),
  getResourceIdOverride: vi.fn(() => undefined),
}));

vi.mock('./utils/storage-factory.js', () => ({
  createStorage: vi.fn(() => ({ storage: {}, backend: 'memory' })),
  createVectorStore: vi.fn(() => ({})),
}));

vi.mock('./utils/thread-lock.js', () => ({
  acquireThreadLock: vi.fn(),
  releaseThreadLock: vi.fn(),
}));

describe('createMastraCode startup performance', () => {
  it('does not wait for background gateway sync before returning storage warnings', async () => {
    const [{ syncGateways }, { createStorage }] = await Promise.all([
      import('./utils/gateway-sync.js'),
      import('./utils/storage-factory.js'),
    ]);
    let resolveSync: (() => void) | undefined;
    vi.mocked(syncGateways).mockImplementation(
      () =>
        new Promise<void>(resolve => {
          resolveSync = resolve;
        }),
    );
    vi.mocked(createStorage).mockReturnValue({
      storage: {},
      backend: 'memory',
      warning: 'Storage fallback warning',
    } as never);
    const { createMastraCode } = await import('./index.js');

    // The contract under test: createMastraCode() resolves with the storage
    // warning without kicking off gateway sync during startup. The periodic
    // heartbeat is intentionally not immediate so startup is never coupled to
    // sync timing or failures.
    const result = await createMastraCode();

    expect(result.storageWarning).toBe('Storage fallback warning');
    expect(syncGateways).not.toHaveBeenCalled();
    resolveSync?.();
  });
});

describe('createAuthStorage', () => {
  it('wires the same AuthStorage instance into every OAuth-capable provider', async () => {
    const claudeMax = await import('./providers/claude-max.js');
    const openaiCodex = await import('./providers/openai-codex.js');
    const githubCopilot = await import('./providers/github-copilot.js');
    const xai = await import('./providers/xai.js');
    const { createAuthStorage } = await import('./index.js');

    const authStorage = createAuthStorage();

    expect(claudeMax.setAuthStorage).toHaveBeenCalledWith(authStorage);
    expect(openaiCodex.setAuthStorage).toHaveBeenCalledWith(authStorage);
    expect(githubCopilot.setAuthStorage).toHaveBeenCalledWith(authStorage);
    expect(xai.setAuthStorage).toHaveBeenCalledWith(authStorage);
  });
});

describe('settings.json OM seeding', () => {
  beforeEach(() => {
    controllerInitialStates.length = 0;
  });

  it('seeds OM knobs from settings.json by default', async () => {
    const { resolveOmRoleModel, loadSettings } = await import('./onboarding/settings.js');
    vi.mocked(resolveOmRoleModel).mockReturnValue('openai/gpt-5-mini');
    const baseSettings = vi.mocked(loadSettings)();
    vi.mocked(loadSettings).mockReturnValue({
      ...baseSettings,
      models: { ...baseSettings.models, omObservationThreshold: 30000 },
    });
    const { createMastraCode } = await import('./index.js');

    try {
      await createMastraCode({ cwd: '/tmp/project-om-seed' });

      expect(controllerInitialStates).toHaveLength(1);
      expect(controllerInitialStates[0]!.observerModelId).toBe('openai/gpt-5-mini');
      expect(controllerInitialStates[0]!.reflectorModelId).toBe('openai/gpt-5-mini');
      expect(controllerInitialStates[0]!.observationThreshold).toBe(30000);
    } finally {
      vi.mocked(resolveOmRoleModel).mockReturnValue('');
      vi.mocked(loadSettings).mockReturnValue(baseSettings);
    }
  });

  it('does not seed OM knobs when disableSettingsOmSeed is set', async () => {
    const { resolveOmRoleModel, loadSettings } = await import('./onboarding/settings.js');
    vi.mocked(resolveOmRoleModel).mockReturnValue('openai/gpt-5-mini');
    const baseSettings = vi.mocked(loadSettings)();
    vi.mocked(loadSettings).mockReturnValue({
      ...baseSettings,
      models: { ...baseSettings.models, omObservationThreshold: 30000 },
    });
    const { createMastraCode } = await import('./index.js');

    try {
      await createMastraCode({ cwd: '/tmp/project-om-no-seed', disableSettingsOmSeed: true });

      expect(controllerInitialStates).toHaveLength(1);
      expect(controllerInitialStates[0]!).not.toHaveProperty('observerModelId');
      expect(controllerInitialStates[0]!).not.toHaveProperty('reflectorModelId');
      expect(controllerInitialStates[0]!).not.toHaveProperty('observationThreshold');
      expect(controllerInitialStates[0]!).not.toHaveProperty('observeAttachments');
    } finally {
      vi.mocked(resolveOmRoleModel).mockReturnValue('');
      vi.mocked(loadSettings).mockReturnValue(baseSettings);
    }
  });
});

describe('AgentController session id and ownerId wiring', () => {
  beforeEach(() => {
    createSessionCalls.length = 0;
  });

  it('passes non-empty, deterministic id and ownerId into createSession', async () => {
    const { createMastraCode } = await import('./index.js');
    await createMastraCode({ cwd: '/tmp/project-alpha' });

    expect(createSessionCalls).toHaveLength(1);
    const call = createSessionCalls[0]!;
    expect(call.id).toBeTruthy();
    expect(call.id).toMatch(/^mastracode-session-/);
    expect(call.ownerId).toBeTruthy();
    expect(call.ownerId).toMatch(/^mastracode-/);
  });

  it('derives stable id and ownerId for the same cwd across calls', async () => {
    const { createMastraCode } = await import('./index.js');
    await createMastraCode({ cwd: '/tmp/project-beta' });
    await createMastraCode({ cwd: '/tmp/project-beta' });

    expect(createSessionCalls).toHaveLength(2);
    expect(createSessionCalls[0]!.id).toBe(createSessionCalls[1]!.id);
    expect(createSessionCalls[0]!.ownerId).toBe(createSessionCalls[1]!.ownerId);
  });

  it('produces distinct ids for different cwds', async () => {
    const { createMastraCode } = await import('./index.js');
    await createMastraCode({ cwd: '/tmp/project-gamma' });
    await createMastraCode({ cwd: '/tmp/project-delta' });

    expect(createSessionCalls).toHaveLength(2);
    expect(createSessionCalls[0]!.id).not.toBe(createSessionCalls[1]!.id);
  });
});
