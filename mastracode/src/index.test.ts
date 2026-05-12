import { describe, expect, it, vi } from 'vitest';

vi.mock('@mastra/core/llm', () => ({
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
}));

vi.mock('@mastra/core/harness', () => ({
  Harness: class {
    subscribe() {}
  },
  taskWriteTool: {},
  taskCheckTool: {},
}));

vi.mock('@mastra/core/processors', () => ({
  AgentsMDInjector: class {},
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
  getDynamicModel: vi.fn(),
  resolveModel: vi.fn(),
}));

vi.mock('./agents/subagents/execute.js', () => ({ executeSubagent: {} }));
vi.mock('./agents/subagents/explore.js', () => ({ exploreSubagent: {} }));
vi.mock('./agents/subagents/plan.js', () => ({ planSubagent: {} }));
vi.mock('./agents/tools.js', () => ({ createDynamicTools: vi.fn() }));
vi.mock('./agents/workspace.js', () => ({ getDynamicWorkspace: vi.fn() }));

vi.mock('./auth/storage.js', () => ({
  AuthStorage: class {
    get() {
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
  MEMORY_GATEWAY_PROVIDER: 'mastra',
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

vi.mock('./tools/index.js', () => ({ defaultTools: {} }));
vi.mock('./schema.js', () => ({ stateSchema: {} }));
vi.mock('./tui/theme.js', () => ({ mastra: {} }));
vi.mock('./utils/gateway-sync.js', () => ({ syncGateways: vi.fn() }));

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

vi.mock('./utils/storage-factory.js', () => ({
  createStorage: vi.fn(() => ({ storage: {}, backend: 'memory' })),
  createVectorStore: vi.fn(() => ({})),
}));

vi.mock('./utils/thread-lock.js', () => ({
  acquireThreadLock: vi.fn(),
  releaseThreadLock: vi.fn(),
}));

describe('createAuthStorage', () => {
  it('wires the same AuthStorage instance into every OAuth-capable provider', async () => {
    const claudeMax = await import('./providers/claude-max.js');
    const openaiCodex = await import('./providers/openai-codex.js');
    const githubCopilot = await import('./providers/github-copilot.js');
    const { createAuthStorage } = await import('./index.js');

    const authStorage = createAuthStorage();

    expect(claudeMax.setAuthStorage).toHaveBeenCalledWith(authStorage);
    expect(openaiCodex.setAuthStorage).toHaveBeenCalledWith(authStorage);
    expect(githubCopilot.setAuthStorage).toHaveBeenCalledWith(authStorage);
  });
});
