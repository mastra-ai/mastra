import { createHash } from 'node:crypto';
import { hostname } from 'node:os';
import path from 'node:path';

import { Agent } from '@mastra/core/agent';
import type { PubSub } from '@mastra/core/events';
import { Harness } from '@mastra/core/harness';
import type {
  CustomAvailableModel,
  HeartbeatHandler,
  HarnessConfig,
  HarnessEvent,
  HarnessMode,
  HarnessSubagent,
  HarnessRequestContext,
} from '@mastra/core/harness';
// import { Harness as HarnessV1 } from '@mastra/core/harness/v1';
import type { HarnessMode as HarnessModeV1 } from '@mastra/core/harness/v1';
import { GatewayRegistry, PROVIDER_REGISTRY } from '@mastra/core/llm';
import type { LanguageModel, ProviderConfig } from '@mastra/core/llm';
import type { StorageThreadType } from '@mastra/core/memory';
import {
  AgentsMDInjector,
  PrefillErrorHandler,
  ProviderHistoryCompat,
  StreamErrorRetryProcessor,
} from '@mastra/core/processors';
import { RequestContext } from '@mastra/core/request-context';
import type { PublicSchema } from '@mastra/core/schema';
import { InMemoryHarness, MastraCompositeStore } from '@mastra/core/storage';
import { DuckDBStore } from '@mastra/duckdb';

import { GithubSignals } from '@mastra/github-signals';
import {
  Observability,
  MastraStorageExporter,
  MastraPlatformExporter,
  SensitiveDataFilter,
} from '@mastra/observability';

import { getDynamicInstructions } from './agents/instructions.js';
import { getDynamicMemory } from './agents/memory.js';
import { getDynamicModel, resolveModel } from './agents/model.js';
import { getStaticallyLoadedInstructionPaths } from './agents/prompts/agent-instructions.js';
import { executeSubagent } from './agents/subagents/execute.js';
import { exploreSubagent } from './agents/subagents/explore.js';
import { planSubagent } from './agents/subagents/plan.js';
import { attachOMThreadStatePersistence, restoreOMThreadStateForCurrentThread } from './agents/thread-caveman-state.js';
import { createDynamicTools } from './agents/tools.js';

import { getDynamicWorkspace } from './agents/workspace.js';
import { AuthStorage } from './auth/storage.js';
import { DEFAULT_CONFIG_DIR, validateConfigDirName } from './constants.js';
import { createOutcomeScorer, createEfficiencyScorer } from './evals/scorers/index.js';
import { v1ModeToLegacy } from './HarnessCompat';
import { HookManager } from './hooks/index.js';
import { createMcpManager } from './mcp/index.js';
import type { McpServerConfig } from './mcp/index.js';
import type { ProviderAccess } from './onboarding/packs.js';
import { getAvailableModePacks, getAvailableOmPacks } from './onboarding/packs.js';
import {
  getCustomProviderId,
  loadSettings,
  MEMORY_GATEWAY_PROVIDER,
  OBSERVABILITY_AUTH_PREFIX,
  resolveModelDefaults,
  resolveOmRoleModel,
  saveSettings,
  toCustomProviderModelId,
} from './onboarding/settings.js';
import { getToolCategory } from './permissions.js';
import { setAuthStorage } from './providers/claude-max.js';
import { getCopilotModelCatalog, setAuthStorage as setGitHubCopilotAuthStorage } from './providers/github-copilot.js';
import { setAuthStorage as setOpenAIAuthStorage } from './providers/openai-codex.js';

import { stateSchema } from './schema.js';
import type { MastraCodeState } from './schema.js';

import { mastra } from './tui/theme.js';
import { syncGateways } from './utils/gateway-sync.js';
import {
  detectProject,
  getObservabilityDatabasePath,
  getStorageConfig,
  getResourceIdOverride,
} from './utils/project.js';
import type { StorageConfig } from './utils/project.js';
import { createSignalsPubSub } from './utils/signals-pubsub.js';
import { createStorage, createVectorStore } from './utils/storage-factory.js';
import { acquireThreadLock, releaseThreadLock } from './utils/thread-lock.js';

const PROVIDER_TO_OAUTH_ID: Record<string, string> = {
  anthropic: 'anthropic',
  openai: 'openai-codex',
  'github-copilot': 'github-copilot',
};

const CODE_AGENT_ID = 'code-agent';

function hash(value: string): string {
  return createHash('sha256').update(value).digest('hex').slice(0, 32);
}

function legacyModeToV1(mode: HarnessMode<MastraCodeState>, fallbackAgent: Agent): HarnessModeV1 {
  const agent = typeof mode.agent === 'function' ? mode.agent({} as MastraCodeState) : mode.agent;
  return {
    id: mode.id,
    agentId: (agent ?? fallbackAgent).id,
    defaultModelId: mode.defaultModelId ?? 'openai/gpt-5.5',
    description: mode.name,
    ...(mode.id === 'plan' ? { transitionsTo: 'build' } : {}),
    metadata: {
      color: mode.color,
      default: mode.default,
      name: mode.name,
    },
  };
}

function applyEffectiveDefaultsToV1Modes(
  modes: HarnessModeV1[],
  effectiveDefaults: Record<string, string>,
): HarnessModeV1[] {
  return modes.map(mode => {
    const savedModel = effectiveDefaults[mode.id];
    if (!savedModel) {
      return mode;
    }
    return {
      ...mode,
      defaultModelId: savedModel,
    };
  });
}

export interface MastraCodeConfig {
  /** Working directory for project detection. Default: process.cwd() */
  cwd?: string;
  /** Override modes (model IDs, colors, which modes exist). Default: build/plan/fast */
  modes?: HarnessMode<MastraCodeState>[];
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
  /** Path to a custom settings.json file. Default: global settings */
  settingsPath?: string;
  /** Initial state overrides (yolo, thinkingLevel, etc.) */
  initialState?: Partial<MastraCodeState>;
  /** Override heartbeat handlers. Default: gateway-sync */
  heartbeatHandlers?: HeartbeatHandler[];
  /** Override the workspace. Default: local filesystem + local sandbox based on detected project */
  workspace?: HarnessConfig<MastraCodeState>['workspace'];
  /** Override the config directory name. Default: '.mastracode'. Replaces '.mastracode' in all project-level and global config paths (MCP, hooks, commands, database, skills, agent instructions). */
  configDir?: string;
  /** Programmatic MCP server configurations, merged with (and overriding) file-based configs. */
  mcpServers?: Record<string, McpServerConfig>;
  /** Disable MCP server discovery. Default: false */
  disableMcp?: boolean;
  /** Disable hooks. Default: false */
  disableHooks?: boolean;
  /**
   * Override the memory instance (or dynamic factory) passed to the Harness.
   * When provided, this replaces the default `getDynamicMemory(storage, vectorStore)` which
   * uses mastracode's built-in model resolution (Anthropic OAuth, OpenAI Codex,
   * models.dev gateway).
   *
   * Use this when your models are served by a custom provider (e.g. Augment)
   * that mastracode's `resolveModel` cannot resolve.
   */
  memory?: HarnessConfig<MastraCodeState>['memory'];
  /** Browser provider for browser automation tools. When set, the agent gains access to browser tools. */
  browser?: HarnessConfig<MastraCodeState>['browser'];
  /** PubSub for signal routing. When crossProcessPubSub is true, thread locks are disabled. */
  pubsub?: PubSub;
  /** Use Mastra Code's built-in Unix socket PubSub for local cross-process signal routing. */
  unixSocketPubSub?: boolean;
  /** Marks the configured PubSub as cross-process-safe, allowing Mastra Code to skip file thread locks. */
  crossProcessPubSub?: boolean;
}

export function createAuthStorage() {
  const authStorage = new AuthStorage();
  setAuthStorage(authStorage);
  setOpenAIAuthStorage(authStorage);
  setGitHubCopilotAuthStorage(authStorage);
  return authStorage;
}

/**
 * Resolve cloud observability credentials for the MastraPlatformExporter.
 * Priority: per-resource settings > environment variables > disabled.
 */
function resolveCloudObservabilityConfig(
  settings: ReturnType<typeof loadSettings>,
  authStorage: AuthStorage,
  resourceId: string,
): { accessToken?: string; projectId?: string } {
  const resourceConfig = settings.observability.resources[resourceId];
  if (resourceConfig) {
    const token = authStorage.getStoredApiKey(`${OBSERVABILITY_AUTH_PREFIX}${resourceId}`);
    if (token) {
      return { accessToken: token, projectId: resourceConfig.projectId };
    }
  }
  // Fall back to environment variables for backwards compatibility
  return {
    accessToken: process.env.MASTRA_CLOUD_ACCESS_TOKEN,
    projectId: process.env.MASTRA_PROJECT_ID,
  };
}

export async function createMastraCode(config?: MastraCodeConfig) {
  const cwd = config?.cwd ?? process.cwd();
  const configDir = config?.configDir ?? DEFAULT_CONFIG_DIR;
  if (configDir !== DEFAULT_CONFIG_DIR) {
    validateConfigDirName(configDir);
  }

  // Load .env file from cwd if present (for observability API keys, etc.)
  try {
    process.loadEnvFile(path.join(cwd, '.env'));
  } catch {
    // No .env file — that's fine, keys may be in shell environment
  }

  const gatewayRegistry = GatewayRegistry.getInstance({ useDynamicLoading: true });

  // Auth storage (shared with Claude Max / OpenAI providers and Harness)
  const authStorage = createAuthStorage();
  const globalSettings = loadSettings(config?.settingsPath);
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

  void Promise.resolve(gatewayRegistry.syncGateways(true)).catch(() => {});

  const mgApiKey = storedGatewayKey ?? process.env['MASTRA_GATEWAY_API_KEY'];

  // Project detection
  const project = detectProject(cwd);

  const resourceIdOverride = getResourceIdOverride(project.rootPath, configDir);
  if (resourceIdOverride) {
    project.resourceId = resourceIdOverride;
    project.resourceIdOverride = true;
  }

  const configuredPubSub = config?.pubsub;
  const useUnixSocketPubSub =
    (config?.unixSocketPubSub ?? globalSettings.signals?.unixSocketPubSub ?? false) && process.platform !== 'win32';
  const signalsPubSub = configuredPubSub ?? (useUnixSocketPubSub ? createSignalsPubSub(project.resourceId) : undefined);
  const crossProcessPubSub = config?.crossProcessPubSub ?? (!configuredPubSub && useUnixSocketPubSub);
  if (crossProcessPubSub && !signalsPubSub) {
    throw new Error('crossProcessPubSub requires a pubsub instance');
  }

  // Storage
  const storageConfig = config?.storage ?? getStorageConfig(project.rootPath, globalSettings.storage, configDir);
  const storageResult = await createStorage(storageConfig);
  const storageWarning = storageResult.warning;

  // Observability storage (DuckDB — separate file for OLAP-style trace/score/feedback queries).
  // Local tracing is opt-in to avoid writing gigabytes of trace data to disk without the
  // user's knowledge. Enable via `/observability local on`.
  let observabilityDomain: DuckDBStore['observability'] | undefined;
  let observabilityWarning: string | undefined;
  if (globalSettings.observability.localTracing) {
    try {
      const observabilityDuckDB = new DuckDBStore({
        id: 'mastra-code-observability',
        path: getObservabilityDatabasePath(),
      });
      // Force an early connection attempt so the lock error surfaces now, not mid-session.
      await observabilityDuckDB.db.getConnection();
      observabilityDomain = observabilityDuckDB.observability;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      const isLockError = /lock|locked|busy/i.test(message);
      if (isLockError) {
        observabilityWarning =
          'Observability unavailable — another MastraCode instance holds the database lock. Traces, scores, and feedback will not be recorded in this session.';
      } else {
        observabilityWarning = `Observability unavailable — DuckDB initialization failed: ${message}`;
      }
    }
  }

  const harnessStorage = new InMemoryHarness();

  // Compose the main storage with the DuckDB observability domain (if available)
  const storage = new MastraCompositeStore({
    id: 'mastra-code-storage',
    default: storageResult.storage,
    domains: {
      ...(observabilityDomain ? { observability: observabilityDomain } : {}),
      harness: harnessStorage,
    },
  });

  // Observability (tracing, scoring, feedback)
  const observability = new Observability({
    configs: {
      default: {
        serviceName: 'mastracode',
        // Only these requestContext keys are stored on spans — prevents leaking
        // large objects (harness state, workspace, env vars) into trace data.
        // Use dot-notation because these are nested inside the 'harness' key.
        //
        // Session identifiers:
        //   threadId, resourceId, modeId, harnessId
        // Environment & project:
        //   state.projectName, state.gitBranch
        // Model configuration:
        //   state.currentModelId, state.subagentModelId
        // Agent settings:
        //   state.yolo, state.thinkingLevel, state.smartEditing
        // Observational memory settings:
        //   state.omScope, state.observerModelId, state.reflectorModelId,
        //   state.observationThreshold, state.reflectionThreshold
        requestContextKeys: [
          // Session identifiers
          'harness.threadId',
          'harness.resourceId',
          'harness.modeId',
          'harness.harnessId',
          // Environment & project
          'harness.state.projectName',
          'harness.state.gitBranch',
          // Model configuration
          'harness.state.currentModelId',
          'harness.state.subagentModelId',
          // Agent settings
          'harness.state.yolo',
          'harness.state.thinkingLevel',
          'harness.state.smartEditing',
          // Observational memory settings
          'harness.state.omScope',
          'harness.state.observerModelId',
          'harness.state.reflectorModelId',
          'harness.state.observationThreshold',
          'harness.state.reflectionThreshold',
        ],
        exporters: [
          new MastraStorageExporter({ strategy: 'event-sourced' }),
          new MastraPlatformExporter(resolveCloudObservabilityConfig(globalSettings, authStorage, project.resourceId)),
        ],
        spanOutputProcessors: [new SensitiveDataFilter()],
      },
    },
  });

  // Vector store for recall search (separate DB file to avoid bloating main storage)
  const vectorStore = await createVectorStore(storageConfig, storageResult.backend);

  const memory = config?.memory ?? getDynamicMemory(storage, vectorStore);

  // MCP
  const mcpManager = config?.disableMcp ? undefined : createMcpManager(project.rootPath, configDir, config?.mcpServers);

  // Hooks
  const hookManager = config?.disableHooks ? undefined : new HookManager(project.rootPath, 'session-init', configDir);

  // Scorers (live evaluation with sampling)
  const outcomeScorer = createOutcomeScorer();
  const efficiencyScorer = createEfficiencyScorer();

  // Agent — githubSignals is created before `harness` but the closure below
  // captures `harness` by reference; it is only invoked at notification time,
  // well after harness is constructed (line ~692). Explicit type annotations
  // on githubSignals, codeAgent, modes, and harness break the circular
  // inference chain this forward reference would otherwise create.
  const githubSignals: GithubSignals | undefined = globalSettings.signals?.experimentalGithubSignals
    ? new GithubSignals({
        cwd: project.rootPath,
        getNotificationStreamOptions: ({ resourceId, threadId }) => {
          const requestContext = new RequestContext();
          const harnessContext: HarnessRequestContext = {
            harnessId: harness.id,
            state: harness.getState(),
            getState: () => harness.getState(),
            setState: updates => harness.setState(updates),
            threadId,
            resourceId,
            modeId: harness.getCurrentModeId(),
            workspace: harness.getWorkspace(),
            registerQuestion: params => harness.registerQuestion(params),
            registerPlanApproval: params => harness.registerPlanApproval(params),
            getSubagentModelId: params => harness.getSubagentModelId(params),
          };
          requestContext.set('harness', harnessContext);

          return {
            memory: { thread: threadId, resource: resourceId },
            requestContext,
            maxSteps: 1000,
            savePerStep: false,
            requireToolApproval: (harness.getState() as Record<string, unknown>).yolo !== true,
            modelSettings: { temperature: 1 },
          };
        },
      })
    : undefined;
  const codeAgent: Agent = new Agent({
    id: CODE_AGENT_ID,
    name: 'Code Agent',
    instructions: getDynamicInstructions,
    model: getDynamicModel,
    tools: createDynamicTools(mcpManager, config?.extraTools, hookManager, config?.disabledTools, storage),
    scorers: {
      outcome: {
        scorer: outcomeScorer,
        sampling: { type: 'none' },
      },
      efficiency: {
        scorer: efficiencyScorer,
        sampling: { type: 'ratio', rate: 0.3 },
      },
    },
    signals: githubSignals ? [githubSignals] : [],
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
      new ProviderHistoryCompat(),
    ],
    errorProcessors: [new StreamErrorRetryProcessor(), new PrefillErrorHandler(), new ProviderHistoryCompat()],
  });

  const defaultSubagents = [exploreSubagent, planSubagent, executeSubagent];

  const defaultModesV1: HarnessModeV1[] = [
    {
      id: 'build',
      agentId: CODE_AGENT_ID,
      description: 'Build',
      defaultModelId: 'anthropic/claude-opus-4-7',
      metadata: {
        color: mastra.green,
        default: true,
      },
    },
    {
      id: 'plan',
      agentId: CODE_AGENT_ID,
      description: 'Plan',
      transitionsTo: 'build',
      defaultModelId: 'openai/gpt-5.5',
      metadata: {
        color: mastra.purple,
      },
    },
    {
      id: 'fast',
      agentId: CODE_AGENT_ID,
      description: 'Fast',
      defaultModelId: 'cerebras/zai-glm-4.7',
      metadata: {
        color: mastra.orange,
      },
    },
  ];

  const defaultHeartbeatHandlers: HeartbeatHandler[] = [
    {
      id: 'gateway-sync',
      intervalMs: 5 * 60 * 1000,
      handler: () => syncGateways(),
    },
  ];
  const heartbeatHandlers = config?.heartbeatHandlers ?? defaultHeartbeatHandlers;

  // Build lightweight provider access for resolving built-in packs at startup.
  // Anthropic/OpenAI use AuthStorage; other providers use env API keys.
  // Also scan the full provider registry so configured API keys satisfy access checks.
  const anthropicCred = authStorage.get('anthropic');
  const openaiCred = authStorage.get('openai-codex');
  const githubCopilotCred = authStorage.get('github-copilot');
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
    'github-copilot': githubCopilotCred?.type === 'oauth' ? 'oauth' : false,
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
  const effectiveObserverModel = resolveOmRoleModel(globalSettings, 'observer', builtinOmPacks);
  const effectiveReflectorModel = resolveOmRoleModel(globalSettings, 'reflector', builtinOmPacks);
  const effectiveObservationThreshold = globalSettings.models.omObservationThreshold ?? undefined;
  const effectiveReflectionThreshold = globalSettings.models.omReflectionThreshold ?? undefined;
  const effectiveCavemanObservations = globalSettings.models.omCavemanObservations ?? undefined;
  const effectiveObserveAttachments = globalSettings.models.omObserveAttachments ?? 'auto';

  const modesV1 = applyEffectiveDefaultsToV1Modes(
    config?.modes ? config.modes.map(mode => legacyModeToV1(mode, codeAgent)) : defaultModesV1,
    effectiveDefaults,
  );
  const defaultModeId =
    modesV1.find(mode => mode.metadata?.default === true)?.id ??
    modesV1.find(mode => mode.id === 'plan')?.id ??
    modesV1[0]?.id;
  if (!defaultModeId) {
    throw new Error('MastraCode requires at least one mode');
  }
  const modes: HarnessMode<MastraCodeState>[] = modesV1.map(mode => v1ModeToLegacy(mode, codeAgent));

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
  const globalInitialState: Partial<MastraCodeState> = {};
  if (effectiveObserverModel) {
    globalInitialState.observerModelId = effectiveObserverModel;
  }
  if (effectiveReflectorModel) {
    globalInitialState.reflectorModelId = effectiveReflectorModel;
  }
  if (effectiveObservationThreshold !== undefined) {
    globalInitialState.observationThreshold = effectiveObservationThreshold;
  }
  if (effectiveReflectionThreshold !== undefined) {
    globalInitialState.reflectionThreshold = effectiveReflectionThreshold;
  }
  if (effectiveCavemanObservations !== undefined) {
    globalInitialState.cavemanObservations = effectiveCavemanObservations;
  }
  if (effectiveObserveAttachments !== undefined) {
    globalInitialState.observeAttachments = effectiveObserveAttachments;
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

  const { threads } = (await (
    await storage.getStore('memory')
  )?.listThreads({
    perPage: false,
    filter: {
      resourceId: project.resourceId,
    },
  })) ?? { threads: [] as StorageThreadType[] };
  const ownerId = `mastracode-${hash(`${hostname()}\0${project.rootPath}`)}`;

  // temporary prefill sessions from threads
  await Promise.all(
    threads.map(thread => {
      const sessionHash = hash(`${thread.resourceId}\0${thread.id}`);

      const meta = thread.metadata as Record<string, unknown> | undefined;
      const modeId = typeof meta?.currentModeId === 'string' ? meta.currentModeId : defaultModeId;
      const mode = modesV1.find(mode => mode.id === modeId) ?? modesV1.find(mode => mode.id === defaultModeId)!;
      const modelId = typeof meta?.currentModelId === 'string' ? meta.currentModelId : mode.defaultModelId;
      return harnessStorage.saveSession({
        id: `sess-${sessionHash}`,
        ownerId,
        resourceId: thread.resourceId,
        threadId: thread.id,
        modeId: mode.id,
        modelId,
        origin: 'top-level',
        createdAt: thread.createdAt,
        lastActivityAt: thread.updatedAt,
      });
    }),
  );

  // const harnessV1 = new HarnessV1({
  //   ownerId,
  //   agents: { [CODE_AGENT_ID]: codeAgent },
  //   memory,
  //   modes: modesV1,
  //   defaultModeId,
  //   storage: harnessStorage,
  // });

  const typedStateSchema = stateSchema as PublicSchema<MastraCodeState>;
  const harness: Harness<MastraCodeState> = new Harness<MastraCodeState>({
    id: 'mastra-code',
    resourceId: project.resourceId,
    storage,
    observability,
    memory,
    pubsub: signalsPubSub,
    stateSchema: typedStateSchema,
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
      // configDir must always win over initialState spreads to stay in sync
      // with MCP/hooks/storage which were already initialized with this value.
      configDir,
    },
    workspace: config?.workspace ?? getDynamicWorkspace,
    browser: config?.browser,
    modes,
    heartbeatHandlers,
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
    customModelCatalogProvider: async () => {
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

      // GitHub Copilot exposes its model list dynamically via `/models` since the
      // available models depend on the user's subscription tier and any org policies.
      // The catalog is cached + refreshed in the background, so steady-state cost is
      // a single Map lookup.
      //
      // The provider uses the generic OpenAI-compatible adapter pointed at
      // GitHub Copilot's API, so expose the full live model catalog returned by
      // Copilot instead of filtering by vendor family here.
      try {
        const copilotModels = await getCopilotModelCatalog({ authStorage });
        for (const m of copilotModels) {
          customModels.push({
            id: `github-copilot/${m.id}`,
            provider: 'github-copilot',
            modelName: m.id,
            hasApiKey: true,
            apiKeyEnvVar: undefined,
          });
        }
      } catch (error) {
        console.warn('Failed to load GitHub Copilot model catalog:', error);
      }

      return customModels;
    },
    threadLock: crossProcessPubSub
      ? undefined
      : {
          acquire: acquireThreadLock,
          release: releaseThreadLock,
        },
    // , harnessV1
  });

  // Sync hookManager session ID on thread changes
  if (hookManager) {
    harness.subscribe((event: HarnessEvent) => {
      if (event.type === 'thread_changed') {
        hookManager.setSessionId(event.threadId);
      } else if (event.type === 'thread_created') {
        hookManager.setSessionId(event.thread.id);
      }
    });
  }

  if (githubSignals) {
    const startGithubPollingForCurrentThread = async (threadId?: string | null) => {
      if (!threadId) return;
      githubSignals.stopAllPolling();
      try {
        const threads = await harness.listThreads({ allResources: true });
        const thread = threads.find((item: { id: string }) => item.id === threadId);
        await githubSignals.startPollingForThread(
          {
            threadId,
            resourceId: thread?.resourceId ?? harness.getResourceId(),
          },
          { pollImmediately: true },
        );
      } catch (error) {
        console.warn('Failed to start GitHub PR polling:', error);
      }
    };

    harness.subscribe((event: HarnessEvent) => {
      if (event.type === 'thread_changed') void startGithubPollingForCurrentThread(event.threadId);
      else if (event.type === 'thread_created') void startGithubPollingForCurrentThread(event.thread.id);
    });
    void startGithubPollingForCurrentThread(harness.getCurrentThreadId());
  }

  // Persist MastraCode-owned /om settings per-thread (mastracode-only concern;
  // intentionally not in core's harness loadThreadMetadata).
  const omThreadStateHarness = harness as unknown as Harness<Record<string, unknown>>;
  attachOMThreadStatePersistence(omThreadStateHarness);
  await restoreOMThreadStateForCurrentThread(omThreadStateHarness).catch(() => {
    // Persistence is best-effort; don't crash startup if storage hiccups.
  });

  return {
    harness,
    mcpManager,
    hookManager,
    signalsPubSub,
    authStorage,
    resolveModel,
    storageWarning,
    observabilityWarning,
    builtinPacks,
    builtinOmPacks,
    effectiveDefaults,
    githubSignals,
  };
}
