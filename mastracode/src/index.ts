import { Agent } from '@mastra/core/agent';
import { Harness, taskWriteTool, taskCheckTool } from '@mastra/core/harness';
import type {
  CustomAvailableModel,
  HeartbeatHandler,
  HarnessConfig,
  HarnessMode,
  HarnessSubagent,
} from '@mastra/core/harness';
import { PROVIDER_REGISTRY } from '@mastra/core/llm';
import type { ProviderConfig } from '@mastra/core/llm';
import type { RequestContext } from '@mastra/core/request-context';

import { getDynamicInstructions } from './agents/instructions.js';
import { getDynamicMemory } from './agents/memory.js';
import { getDynamicModel, resolveModel } from './agents/model.js';
import { executeSubagent } from './agents/subagents/execute.js';
import { exploreSubagent } from './agents/subagents/explore.js';
import { planSubagent } from './agents/subagents/plan.js';
import { createDynamicTools } from './agents/tools.js';

import { getDynamicWorkspace } from './agents/workspace.js';
import { AuthStorage } from './auth/storage.js';
import { HookManager } from './hooks/index.js';
import { createMcpManager } from './mcp/index.js';
import type { ProviderAccess } from './onboarding/packs.js';
import { getAvailableModePacks, getAvailableOmPacks } from './onboarding/packs.js';
import {
  getCustomProviderId,
  loadSettings,
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
import { createStorage } from './utils/storage-factory.js';
import { acquireThreadLock, releaseThreadLock } from './utils/thread-lock.js';

const PROVIDER_TO_OAUTH_ID: Record<string, string> = {
  anthropic: 'anthropic',
  openai: 'openai-codex',
};

export interface MastraCodeConfig {
  /** Working directory for project detection. Default: process.cwd() */
  cwd?: string;
  /** Override modes (model IDs, colors, which modes exist). Default: build/plan/fast */
  modes?: HarnessMode[];
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
  /** Disable MCP server discovery. Default: false */
  disableMcp?: boolean;
  /** Disable hooks. Default: false */
  disableHooks?: boolean;
}

export function createAuthStorage() {
  const authStorage = new AuthStorage();
  setAuthStorage(authStorage);
  setOpenAIAuthStorage(authStorage);
  return authStorage;
}

export async function createMastraCode(config?: MastraCodeConfig) {
  const cwd = config?.cwd ?? process.cwd();

  // Auth storage (shared with Claude Max / OpenAI providers and Harness)
  const authStorage = createAuthStorage();

  // Project detection
  const project = detectProject(cwd);

  const resourceIdOverride = getResourceIdOverride(project.rootPath);
  if (resourceIdOverride) {
    project.resourceId = resourceIdOverride;
    project.resourceIdOverride = true;
  }

  // Load global settings to resolve storage preferences (needed before storage creation)
  const globalSettings = loadSettings();

  // Storage
  const storageConfig = config?.storage ?? getStorageConfig(project.rootPath, globalSettings.storage);
  const storageResult = await createStorage(storageConfig);
  const storage = storageResult.storage;
  const storageWarning = storageResult.warning;

  const memory = getDynamicMemory(storage);

  // MCP
  const mcpManager = config?.disableMcp ? undefined : createMcpManager(project.rootPath);

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
  });

  // Build subagent definitions.
  // Subagents inherit workspace tools from the parent agent's workspace automatically.
  // allowedWorkspaceTools restricts which workspace tools the model can see.
  // Non-workspace tools (task_write, task_check) are passed explicitly.
  const filterDisabled = (tools: string[]) =>
    config?.disabledTools?.length ? tools.filter(t => !config.disabledTools!.includes(t)) : tools;

  const defaultSubagents: HarnessSubagent[] = [
    {
      id: exploreSubagent.id,
      name: exploreSubagent.name,
      description:
        "Read-only codebase exploration. Use for questions like 'find all usages of X', 'how does module Y work'.",
      instructions: exploreSubagent.instructions,
      allowedWorkspaceTools: filterDisabled(exploreSubagent.allowedTools),
    },
    {
      id: planSubagent.id,
      name: planSubagent.name,
      description:
        "Read-only analysis and planning. Use for 'create an implementation plan for X', 'analyze the architecture of Y'.",
      instructions: planSubagent.instructions,
      allowedWorkspaceTools: filterDisabled(planSubagent.allowedTools),
    },
    {
      id: executeSubagent.id,
      name: executeSubagent.name,
      description:
        "Task execution with write capabilities. Use for 'implement feature X', 'fix bug Y', 'refactor module Z'.",
      instructions: executeSubagent.instructions,
      tools: {
        task_write: taskWriteTool,
        task_check: taskCheckTool,
      },
      allowedWorkspaceTools: filterDisabled(executeSubagent.allowedTools),
    },
  ];

  const defaultModes: HarnessMode[] = [
    {
      id: 'build',
      name: 'Build',
      default: true,
      defaultModelId: 'anthropic/claude-opus-4-6',
      color: mastra.purple,
      agent: codeAgent,
    },
    {
      id: 'plan',
      name: 'Plan',
      defaultModelId: 'openai/gpt-5.2-codex',
      color: mastra.blue,
      agent: codeAgent,
    },
    {
      id: 'fast',
      name: 'Fast',
      defaultModelId: 'cerebras/zai-glm-4.7',
      color: mastra.green,
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
  // Anthropic/OpenAI use AuthStorage only; other providers use env API keys.
  // Also scan the full provider registry so configured env API keys satisfy access checks.
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
  // Check all providers in the registry for API keys
  try {
    const registry = PROVIDER_REGISTRY as Record<string, ProviderConfig>;
    for (const [provider, config] of Object.entries(registry)) {
      if (startupAccess[provider] && startupAccess[provider] !== false) continue; // Already enabled above
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

  // Apply resolved model defaults to modes
  const modes = (config?.modes ?? defaultModes).map(mode => {
    const savedModel = effectiveDefaults[mode.id];
    return savedModel ? { ...mode, defaultModelId: savedModel } : mode;
  });

  // Map subagent types to mode models: explore→fast, plan→plan, execute→build
  const subagentModeMap: Record<string, string> = { explore: 'fast', plan: 'plan', execute: 'build' };
  const subagents = (config?.subagents ?? defaultSubagents).map(sa => {
    const modeId = subagentModeMap[sa.id];
    const model = modeId ? effectiveDefaults[modeId] : undefined;
    return model ? { ...sa, defaultModelId: model } : sa;
  });

  // Build initial state with global preferences
  const globalInitialState: Record<string, unknown> = {};
  if (effectiveOmModel) {
    globalInitialState.observerModelId = effectiveOmModel;
    globalInitialState.reflectorModelId = effectiveOmModel;
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
    if (key === '_default') {
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
    resolveModel,
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
    modes,
    heartbeatHandlers: config?.heartbeatHandlers ?? defaultHeartbeatHandlers,
    modelAuthChecker: provider => {
      const oauthId = PROVIDER_TO_OAUTH_ID[provider];
      if (oauthId && authStorage.isLoggedIn(oauthId)) {
        return true;
      }
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
