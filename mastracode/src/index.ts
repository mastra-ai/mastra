import { Agent } from '@mastra/core/agent';
import type { MastraBrowser } from '@mastra/core/browser';
import { Harness } from '@mastra/core/harness';
import type {
  CustomAvailableModel,
  HeartbeatHandler,
  HarnessConfig,
  HarnessMode,
  HarnessSubagent,
} from '@mastra/core/harness';
import { GatewayRegistry, PROVIDER_REGISTRY } from '@mastra/core/llm';
import type { LanguageModel, ProviderConfig } from '@mastra/core/llm';
import { AgentsMDInjector } from '@mastra/core/processors';
import type { RequestContext } from '@mastra/core/request-context';

import { getDynamicInstructions } from './agents/instructions.js';
import { getDynamicMemory } from './agents/memory.js';
import { getDynamicModel, resolveModel } from './agents/model.js';
import { getStaticallyLoadedInstructionPaths } from './agents/prompts/agent-instructions.js';
import { executeSubagent } from './agents/subagents/execute.js';
import { exploreSubagent } from './agents/subagents/explore.js';
import { planSubagent } from './agents/subagents/plan.js';
import { createDynamicTools } from './agents/tools.js';

import { getDynamicWorkspace } from './agents/workspace.js';
import { AuthStorage } from './auth/storage.js';
import { HookManager } from './hooks/index.js';
import { createMcpManager } from './mcp/index.js';
import type { McpServerConfig } from './mcp/index.js';
import type { ProviderAccess } from './onboarding/packs.js';
import { getAvailableModePacks, getAvailableOmPacks } from './onboarding/packs.js';
import {
  getCustomProviderId,
  loadSettings,
  MEMORY_GATEWAY_PROVIDER,
  resolveModelDefaults,
  resolveOmModel,
  saveSettings,
  toCustomProviderModelId,
} from './onboarding/settings.js';
import { getToolCategory } from './permissions.js';
import { setAuthStorage } from './providers/claude-max.js';
import { setAuthStorage as setOpenAIAuthStorage } from './providers/openai-codex.js';

import { stateSchema } from './schema.js';

import { mastra } from './tui/theme.js';
import { syncGateways } from './utils/gateway-sync.js';
import { detectProject, getStorageConfig, getResourceIdOverride } from './utils/project.js';
import type { StorageConfig } from './utils/project.js';
import { createStorage, createVectorStore } from './utils/storage-factory.js';
import { acquireThreadLock, releaseThreadLock } from './utils/thread-lock.js';

const PROVIDER_TO_OAUTH_ID: Record<string, string> = {
  anthropic: 'anthropic',
  openai: 'openai-codex',
};

export interface MastraCodeConfig {
  /** Working directory for project detection. Default: process.cwd() */
  cwd?: string;
  /** Override modes (model IDs, colors, which modes exist). Default: build/plan/fast */
  modes?: HarnessMode<Record<string, unknown>>[];
  /** Override or extend subagent definitions. Default: explore/plan/execute */
  subagents?: HarnessSubagent[];
  /** Extra tools merged into the dynamic tool set. Can be a static record or a function that receives requestContext. */
  extraTools?:
    | Record<
        string,
        { execute?: (input: unknown, context?: unknown) => Promise<unknown> | unknown; [key: string]: unknown }
      >
    | ((ctx: {
        requestContext: RequestContext;
      }) => Record<
        string,
        { execute?: (input: unknown, context?: unknown) => Promise<unknown> | unknown; [key: string]: unknown }
      >);
  /** Tools removed from the dynamic tool set before exposure to the model */
  disabledTools?: string[];
  /** Custom storage config instead of auto-detected default */
  storage?: StorageConfig;
  /** Observational memory scope. Default: auto-detected from env/config files, falls back to 'thread' */
  omScope?: 'thread' | 'resource';
  /** Initial state overrides (yolo, thinkingLevel, etc.) */
  initialState?: Record<string, unknown>;
  /** Override heartbeat handlers. Default: gateway-sync */
  heartbeatHandlers?: HeartbeatHandler[];
  /** Override the workspace. Default: local filesystem + local sandbox based on detected project */
  workspace?: HarnessConfig['workspace'];
  /** Programmatic MCP server configurations, merged with (and overriding) file-based configs. */
  mcpServers?: Record<string, McpServerConfig>;
  /** Disable MCP server discovery. Default: false */
  disableMcp?: boolean;
  /** Disable hooks. Default: false */
  disableHooks?: boolean;
  /** Browser provider for browser automation tools. When set, the agent gains access to browser tools. */
  browser?: MastraBrowser;
}

export function createAuthStorage() {
  const authStorage = new AuthStorage();
  setAuthStorage(authStorage);
  setOpenAIAuthStorage(authStorage);
  return authStorage;
}

export async function createMastraCode(config?: MastraCodeConfig) {
  const cwd = config?.cwd ?? process.cwd();

  const gatewayRegistry = GatewayRegistry.getInstance({ useDynamicLoading: true });

  // Auth storage (shared with Claude Max / OpenAI providers and Harness)
  const authStorage = createAuthStorage();
  const globalSettings = loadSettings();
  const storedGatewayKey = authStorage.getStoredApiKey(MEMORY_GATEWAY_PROVIDER);
  const storedGatewayUrl = globalSettings.memoryGateway?.baseUrl;

  if (storedGatewayKey) {
    process.env['MASTRA_GATEWAY_API_KEY'] ??= storedGatewayKey;
  }

  if (storedGatewayUrl) {
    process.env['MASTRA_GATEWAY_URL'] ??= storedGatewayUrl;
  }

  // Load user-entered API keys from auth.json into process.env
  // (only sets env vars that aren't already present — env vars take precedence)
  try {
    const registry = PROVIDER_REGISTRY as Record<string, ProviderConfig>;
    const providerEnvVars: Record<string, string | undefined> = {};
    for (const [provider, cfg] of Object.entries(registry)) {
      const envVars = cfg?.apiKeyEnvVar;
      providerEnvVars[provider] = Array.isArray(envVars) ? envVars[0] : envVars;
    }
    providerEnvVars[MEMORY_GATEWAY_PROVIDER] ??= 'MASTRA_GATEWAY_API_KEY';
    authStorage.loadStoredApiKeysIntoEnv(providerEnvVars);
  } catch {
    // Registry unavailable — load well-known provider keys so non-gateway flows still work
    authStorage.loadStoredApiKeysIntoEnv({
      [MEMORY_GATEWAY_PROVIDER]: 'MASTRA_GATEWAY_API_KEY',
      anthropic: 'ANTHROPIC_API_KEY',
      openai: 'OPENAI_API_KEY',
      google: 'GOOGLE_GENERATIVE_AI_API_KEY',
      cerebras: 'CEREBRAS_API_KEY',
      deepseek: 'DEEPSEEK_API_KEY',
    });
  }

  try {
    await gatewayRegistry.syncGateways(true);
  } catch (error) {
    console.warn('Failed to sync gateways at startup', error);
  }

  const mgApiKey = authStorage.getStoredApiKey(MEMORY_GATEWAY_PROVIDER) ?? process.env['MASTRA_GATEWAY_API_KEY'];

  // Project detection
  const project = detectProject(cwd);

  const resourceIdOverride = getResourceIdOverride(project.rootPath);
  if (resourceIdOverride) {
    project.resourceId = resourceIdOverride;
    project.resourceIdOverride = true;
  }

  // Storage
  const storageConfig = config?.storage ?? getStorageConfig(project.rootPath, globalSettings.storage);
  const storageResult = await createStorage(storageConfig);
  const storage = storageResult.storage;
  const storageWarning = storageResult.warning;

  // Vector store for recall search (separate DB file to avoid bloating main storage)
  const vectorStore = await createVectorStore(storageConfig, storageResult.backend);

  const memory = getDynamicMemory(storage, vectorStore);

  // MCP
  const mcpManager = config?.disableMcp ? undefined : createMcpManager(project.rootPath, config?.mcpServers);

  // Hooks
  const hookManager = config?.disableHooks ? undefined : new HookManager(project.rootPath, 'session-init');

  if (hookManager?.hasHooks()) {
    const hookConfig = hookManager.getConfig();
    const hookCount = Object.values(hookConfig).reduce((sum, hooks) => sum + (hooks?.length ?? 0), 0);
    console.info(`Hooks: ${hookCount} hook(s) configured`);
  }

  // Agent
  const codeAgent = new Agent({
    id: 'code-agent',
    name: 'Code Agent',
    instructions: getDynamicInstructions,
    model: getDynamicModel,
    tools: createDynamicTools(mcpManager, config?.extraTools, hookManager, config?.disabledTools),
    inputProcessors: [
      new AgentsMDInjector({
        getIgnoredInstructionPaths: ({ requestContext }) => {
          const harnessContext = requestContext?.get('harness') as
            | { state?: { projectPath?: string }; getState?: () => { projectPath?: string } }
            | undefined;
          const projectPath =
            harnessContext?.getState?.()?.projectPath ?? harnessContext?.state?.projectPath ?? project.rootPath;
          return getStaticallyLoadedInstructionPaths(projectPath);
        },
      }),
    ],
  });

  const defaultSubagents = [exploreSubagent, planSubagent, executeSubagent];

  const defaultModes: HarnessMode<Record<string, unknown>>[] = [
    {
      id: 'build',
      name: 'Build',
      default: true,
      defaultModelId: 'anthropic/claude-opus-4-6',
      color: mastra.green,
      agent: codeAgent,
    },
    {
      id: 'plan',
      name: 'Plan',
      defaultModelId: 'openai/gpt-5.2-codex',
      color: mastra.purple,
      agent: codeAgent,
    },
    {
      id: 'fast',
      name: 'Fast',
      defaultModelId: 'cerebras/zai-glm-4.7',
      color: mastra.orange,
      agent: codeAgent,
    },
  ];

  const defaultHeartbeatHandlers: HeartbeatHandler[] = [
    {
      id: 'gateway-sync',
      intervalMs: 5 * 60 * 1000,
      handler: () => syncGateways(),
    },
  ];

  // Build lightweight provider access for resolving built-in packs at startup.
  // Anthropic/OpenAI use AuthStorage; other providers use env API keys.
  // Also scan the full provider registry so configured API keys satisfy access checks.
  const anthropicCred = authStorage.get('anthropic');
  const openaiCred = authStorage.get('openai-codex');
  const startupAccess: ProviderAccess = {
    anthropic:
      anthropicCred?.type === 'oauth'
        ? 'oauth'
        : anthropicCred?.type === 'api_key' && anthropicCred.key.trim().length > 0
          ? 'apikey'
          : false,
    openai:
      openaiCred?.type === 'oauth'
        ? 'oauth'
        : openaiCred?.type === 'api_key' && openaiCred.key.trim().length > 0
          ? 'apikey'
          : false,
    cerebras: process.env.CEREBRAS_API_KEY ? 'apikey' : false,
    google: process.env.GOOGLE_GENERATIVE_AI_API_KEY ? 'apikey' : false,
    deepseek: process.env.DEEPSEEK_API_KEY ? 'apikey' : false,
  };
  // Gateway covers all providers — ensure Anthropic/OpenAI packs are visible
  if (mgApiKey) {
    if (!startupAccess.anthropic) startupAccess.anthropic = 'apikey';
    if (!startupAccess.openai) startupAccess.openai = 'apikey';
  }
  // Check all providers in the registry for API keys
  try {
    const registry = PROVIDER_REGISTRY as Record<string, ProviderConfig>;
    for (const [provider, config] of Object.entries(registry)) {
      if (startupAccess[provider] === 'oauth' || startupAccess[provider] === 'apikey') continue; // Already enabled above
      if (provider === 'anthropic' || provider === 'openai') continue;
      const envVars = config?.apiKeyEnvVar;
      const envVarList = Array.isArray(envVars) ? envVars : envVars ? [envVars] : [];
      if (envVarList.some(envVar => process.env[envVar])) {
        startupAccess[provider] = 'apikey';
      }
    }
  } catch {
    // Registry may not be loaded yet; the 5 hardcoded providers are sufficient fallback
  }
  const builtinPacks = getAvailableModePacks(startupAccess);
  const builtinOmPacks = getAvailableOmPacks(startupAccess);
  const effectiveDefaults = resolveModelDefaults(globalSettings, builtinPacks);
  const effectiveOmModel = resolveOmModel(globalSettings, builtinOmPacks);
  const effectiveObservationThreshold = globalSettings.models.omObservationThreshold ?? undefined;
  const effectiveReflectionThreshold = globalSettings.models.omReflectionThreshold ?? undefined;

  // Apply resolved model defaults to modes
  const modes = (config?.modes ?? defaultModes).map(mode => {
    const savedModel = effectiveDefaults[mode.id];
    return savedModel ? { ...mode, defaultModelId: savedModel } : mode;
  });

  // Map subagent types to mode models: explore→fast, plan→plan, execute→build
  const subagentModeMap: Record<string, string> = { explore: 'fast', plan: 'plan', execute: 'build' };
  // Subagents inherit workspace tools from the parent agent's workspace automatically.
  // Apply disabledTools filter to both default and custom subagents.
  const subagents = (config?.subagents ?? defaultSubagents).map(sa => {
    const modeId = subagentModeMap[sa.id];
    const model = modeId ? effectiveDefaults[modeId] : undefined;
    let filtered = sa;
    if (config?.disabledTools?.length) {
      if (sa.allowedWorkspaceTools) {
        filtered = {
          ...filtered,
          allowedWorkspaceTools: sa.allowedWorkspaceTools.filter(t => !config.disabledTools!.includes(t)),
        };
      }
      if (sa.tools) {
        filtered = {
          ...filtered,
          tools: Object.fromEntries(Object.entries(sa.tools).filter(([k]) => !config.disabledTools!.includes(k))),
        };
      }
    }
    return model ? { ...filtered, defaultModelId: model } : filtered;
  });

  // Build initial state with global preferences
  const globalInitialState: Record<string, unknown> = {};
  if (effectiveOmModel) {
    globalInitialState.observerModelId = effectiveOmModel;
    globalInitialState.reflectorModelId = effectiveOmModel;
  }
  if (effectiveObservationThreshold !== undefined) {
    globalInitialState.observationThreshold = effectiveObservationThreshold;
  }
  if (effectiveReflectionThreshold !== undefined) {
    globalInitialState.reflectionThreshold = effectiveReflectionThreshold;
  }
  if (globalSettings.preferences.yolo !== null) {
    globalInitialState.yolo = globalSettings.preferences.yolo;
  }
  globalInitialState.thinkingLevel = globalSettings.preferences.thinkingLevel;
  if (config?.omScope) {
    globalInitialState.omScope = config.omScope;
  }
  // Seed subagent models from global settings
  for (const [key, modelId] of Object.entries(globalSettings.models.subagentModels)) {
    if (key === 'default' || key === '_default') {
      globalInitialState.subagentModelId = modelId;
    } else {
      globalInitialState[`subagentModelId_${key}`] = modelId;
    }
  }
  const harness = new Harness({
    id: 'mastra-code',
    resourceId: project.resourceId,
    storage,
    memory,
    stateSchema,
    subagents,
    resolveModel: modelId => resolveModel(modelId) as LanguageModel,
    toolCategoryResolver: getToolCategory,
    initialState: {
      projectPath: project.rootPath,
      projectName: project.name,
      gitBranch: project.gitBranch,
      yolo: true,
      ...globalInitialState,
      ...config?.initialState,
    },
    workspace: config?.workspace ?? getDynamicWorkspace,
    browser: config?.browser,
    modes,
    heartbeatHandlers: config?.heartbeatHandlers ?? defaultHeartbeatHandlers,
    modelAuthChecker: provider => {
      // Gateway key only authorizes providers that the Mastra gateway actually serves
      const gatewayKey = authStorage.getStoredApiKey(MEMORY_GATEWAY_PROVIDER) ?? process.env['MASTRA_GATEWAY_API_KEY'];
      if (gatewayKey) {
        const providerConfig = gatewayRegistry.getProviders()[provider];
        if (providerConfig?.gateway === 'mastra') return true;
      }
      const oauthId = PROVIDER_TO_OAUTH_ID[provider];
      if (oauthId && authStorage.isLoggedIn(oauthId)) {
        return true;
      }
      // Check for user-entered API keys stored in auth.json
      if (authStorage.hasStoredApiKey(provider)) {
        return true;
      }
      // Backward-compatible direct credential checks for Anthropic/OpenAI storage keys.
      if (provider === 'anthropic') {
        const cred = authStorage.get('anthropic');
        if (cred?.type === 'api_key' && cred.key.trim().length > 0) {
          return true;
        }
      }
      if (provider === 'openai') {
        const cred = authStorage.get('openai-codex');
        if (cred?.type === 'api_key' && cred.key.trim().length > 0) {
          return true;
        }
      }

      const customProvider = loadSettings().customProviders.find(entry => {
        return provider === getCustomProviderId(entry.name);
      });
      if (customProvider) {
        return true;
      }
      return undefined;
    },
    modelUseCountProvider: () => loadSettings().modelUseCounts,
    modelUseCountTracker: modelId => {
      try {
        const settings = loadSettings();
        settings.modelUseCounts[modelId] = (settings.modelUseCounts[modelId] ?? 0) + 1;
        saveSettings(settings);
      } catch (error) {
        console.error('Failed to persist model usage count', error);
      }
    },
    customModelCatalogProvider: () => {
      const settings = loadSettings();
      const customModels: CustomAvailableModel[] = [];
      for (const provider of settings.customProviders) {
        const providerId = getCustomProviderId(provider.name);
        for (const modelName of provider.models) {
          customModels.push({
            id: toCustomProviderModelId(provider.name, modelName),
            provider: providerId,
            modelName,
            hasApiKey: true,
            apiKeyEnvVar: undefined,
          });
        }
      }
      return customModels;
    },
    threadLock: {
      acquire: acquireThreadLock,
      release: releaseThreadLock,
    },
  });

  // Sync hookManager session ID on thread changes
  if (hookManager) {
    harness.subscribe(event => {
      if (event.type === 'thread_changed') {
        hookManager.setSessionId(event.threadId);
      } else if (event.type === 'thread_created') {
        hookManager.setSessionId(event.thread.id);
      }
    });
  }

  return { harness, mcpManager, hookManager, authStorage, resolveModel, storageWarning };
}
