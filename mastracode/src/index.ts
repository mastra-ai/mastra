import { Agent } from '@mastra/core/agent';
import { Harness, taskWriteTool, taskCheckTool } from '@mastra/core/harness';
import type { HeartbeatHandler, HarnessMode, HarnessSubagent } from '@mastra/core/harness';

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
import { loadSettings, resolveModelDefaults, resolveOmModel, saveSettings } from './onboarding/settings.js';
import { getToolCategory } from './permissions.js';
import { setAuthStorage } from './providers/claude-max.js';
import { setAuthStorage as setOpenAIAuthStorage } from './providers/openai-codex.js';

import { stateSchema } from './schema.js';
import {
  createViewTool,
  createGrepTool,
  createGlobTool,
  createExecuteCommandTool,
  createWriteFileTool,
  createStringReplaceLspTool,
} from './tools/index.js';
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
  /** Extra tools merged into the dynamic tool set */
  extraTools?: Record<string, any>;
  /** Custom storage config instead of auto-detected default */
  storage?: StorageConfig;
  /** Initial state overrides (yolo, thinkingLevel, etc.) */
  initialState?: Record<string, unknown>;
  /** Override heartbeat handlers. Default: gateway-sync */
  heartbeatHandlers?: HeartbeatHandler[];
  /** Disable MCP server discovery. Default: false */
  disableMcp?: boolean;
  /** Disable hooks. Default: false */
  disableHooks?: boolean;
}

export async function createMastraCode(config?: MastraCodeConfig) {
  const cwd = config?.cwd ?? process.cwd();

  // Auth storage (shared with Claude Max / OpenAI providers and Harness)
  const authStorage = new AuthStorage();
  setAuthStorage(authStorage);
  setOpenAIAuthStorage(authStorage);

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

  // Agent
  const codeAgent = new Agent({
    id: 'code-agent',
    name: 'Code Agent',
    instructions: getDynamicInstructions,
    model: getDynamicModel,
    tools: createDynamicTools(mcpManager),
  });

  // Hooks
  const hookManager = config?.disableHooks ? undefined : new HookManager(project.rootPath, 'session-init');

  if (hookManager?.hasHooks()) {
    const hookConfig = hookManager.getConfig();
    const hookCount = Object.values(hookConfig).reduce((sum, hooks) => sum + (hooks?.length ?? 0), 0);
    console.info(`Hooks: ${hookCount} hook(s) configured`);
  }

  // Build subagent definitions with project-scoped tools
  const viewTool = createViewTool(project.rootPath);
  const grepTool = createGrepTool(project.rootPath);
  const globTool = createGlobTool(project.rootPath);
  const executeCommandTool = createExecuteCommandTool(project.rootPath);
  const writeFileTool = createWriteFileTool(project.rootPath);
  const stringReplaceLspTool = createStringReplaceLspTool(project.rootPath);

  const readOnlyTools = {
    view: viewTool,
    search_content: grepTool,
    find_files: globTool,
  };

  const defaultSubagents: HarnessSubagent[] = [
    {
      id: exploreSubagent.id,
      name: exploreSubagent.name,
      description:
        "Read-only codebase exploration. Use for questions like 'find all usages of X', 'how does module Y work'.",
      instructions: exploreSubagent.instructions,
      tools: readOnlyTools,
    },
    {
      id: planSubagent.id,
      name: planSubagent.name,
      description:
        "Read-only analysis and planning. Use for 'create an implementation plan for X', 'analyze the architecture of Y'.",
      instructions: planSubagent.instructions,
      tools: readOnlyTools,
    },
    {
      id: executeSubagent.id,
      name: executeSubagent.name,
      description:
        "Task execution with write capabilities. Use for 'implement feature X', 'fix bug Y', 'refactor module Z'.",
      instructions: executeSubagent.instructions,
      tools: {
        ...readOnlyTools,
        string_replace_lsp: stringReplaceLspTool,
        write_file: writeFileTool,
        execute_command: executeCommandTool,
        task_write: taskWriteTool,
        task_check: taskCheckTool,
      },
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
  // OAuth providers are checked via authStorage, env-only providers via process.env.
  const startupAccess: ProviderAccess = {
    anthropic: authStorage.isLoggedIn('anthropic') ? 'oauth' : process.env.ANTHROPIC_API_KEY ? 'apikey' : false,
    openai: authStorage.isLoggedIn('openai-codex') ? 'oauth' : process.env.OPENAI_API_KEY ? 'apikey' : false,
    cerebras: process.env.CEREBRAS_API_KEY ? 'apikey' : false,
    google: process.env.GOOGLE_GENERATIVE_AI_API_KEY ? 'apikey' : false,
    deepseek: process.env.DEEPSEEK_API_KEY ? 'apikey' : false,
  };
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
    workspace: getDynamicWorkspace,
    modes,
    heartbeatHandlers: config?.heartbeatHandlers ?? defaultHeartbeatHandlers,
    modelAuthChecker: provider => {
      const oauthId = PROVIDER_TO_OAUTH_ID[provider];
      if (oauthId && authStorage.isLoggedIn(oauthId)) {
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

  return { harness, mcpManager, hookManager, authStorage, storageWarning };
}
