import path from 'node:path';

import { Agent } from '@mastra/core/agent';
import type { PubSub } from '@mastra/core/events';
import { Harness } from '@mastra/core/harness';
import type {
  HeartbeatHandler,
  HarnessConfig,
  HarnessEvent,
  HarnessMode,
  HarnessSubagent,
  HarnessRequestContext,
} from '@mastra/core/harness';
import { PROVIDER_REGISTRY } from '@mastra/core/llm';
import type { ProviderConfig } from '@mastra/core/llm';
import {
  AgentsMDInjector,
  PrefillErrorHandler,
  ProviderHistoryCompat,
  StreamErrorRetryProcessor,
} from '@mastra/core/processors';
import { RequestContext } from '@mastra/core/request-context';
import type { PublicSchema } from '@mastra/core/schema';
import { TaskSignalProvider } from '@mastra/core/signals';
import { InMemoryHarness, MastraCompositeStore } from '@mastra/core/storage';
import { DEFAULT_GOAL_JUDGE_PROMPT } from '@mastra/core/tools';
import { DuckDBStore } from '@mastra/duckdb';

import { GithubSignals } from '@mastra/github-signals';
import { SlackSignals, SlackWebApiSyncClient } from '@mastra/slack-signals';
import {
  Observability,
  MastraStorageExporter,
  MastraPlatformExporter,
  SensitiveDataFilter,
} from '@mastra/observability';

import { getDynamicInstructions } from './agents/instructions.js';
import { getDynamicMemory } from './agents/memory.js';
import {
  createMastraCodeGateway,
  createMastraCodeModelCatalogProvider,
  getDynamicModel,
  getGoalJudgeModel,
  resolveModel,
} from './agents/model.js';
import { buildMode } from './agents/modes/build.js';
import { fastMode } from './agents/modes/explore.js';
import { planMode } from './agents/modes/plan.js';
import { getStaticallyLoadedInstructionPaths } from './agents/prompts/agent-instructions.js';
// import { executeSubagent } from './agents/subagents/execute.js';
// import { exploreSubagent } from './agents/subagents/explore.js';
// import { planSubagent } from './agents/subagents/plan.js';
import { attachOMThreadStatePersistence, restoreOMThreadStateForCurrentThread } from './agents/thread-caveman-state.js';
import { createDynamicTools, createToolHooks } from './agents/tools.js';

import { getDynamicWorkspace, getGoalJudgeTools } from './agents/workspace.js';
import { AuthStorage } from './auth/storage.js';
import { DEFAULT_CONFIG_DIR, validateConfigDirName } from './constants.js';
import { createOutcomeScorer, createEfficiencyScorer } from './evals/scorers/index.js';
import { HookManager } from './hooks/index.js';
import { createMcpManager } from './mcp/index.js';
import type { McpServerConfig } from './mcp/index.js';
import type { ProviderAccess } from './onboarding/packs.js';
import { getAvailableModePacks, getAvailableOmPacks } from './onboarding/packs.js';
import {
  loadSettings,
  MEMORY_GATEWAY_PROVIDER,
  OBSERVABILITY_AUTH_PREFIX,
  resolveModelDefaults,
  resolveOmRoleModel,
  saveSettings,
} from './onboarding/settings.js';
import { getToolCategory } from './permissions.js';
import { setAuthStorage } from './providers/claude-max.js';
import { setAuthStorage as setGitHubCopilotAuthStorage } from './providers/github-copilot.js';
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

const CODE_AGENT_ID = 'code-agent';

function applyEffectiveDefaultsToModes(modes: HarnessMode[], effectiveDefaults: Record<string, string>): HarnessMode[] {
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
  /** Home directory for global config discovery. Default: os.homedir() */
  homeDir?: string;
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
   * uses mastracode's built-in model gateway (Anthropic OAuth, OpenAI Codex,
   * custom providers, and models.dev fallback).
   *
   * Use this when you need to override memory model behavior completely.
   */
  memory?: HarnessConfig<MastraCodeState>['memory'] | false;
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
  const homeDir = config?.homeDir ?? config?.initialState?.homeDir;
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
      'slack-signals': 'SLACK_USER_TOKEN',
    });
  }

  const mgApiKey = process.env['MASTRA_GATEWAY_API_KEY'] ?? storedGatewayKey;
  const mastraGatewayBaseUrl = (
    process.env['MASTRA_GATEWAY_URL'] ??
    storedGatewayUrl ??
    'https://gateway-api.mastra.ai'
  )
    .replace(/\/+$/, '')
    .replace(/\/v1$/, '');
  const mastraCodeGateway = createMastraCodeGateway({
    mastraGatewayBaseUrl,
    mastraGatewayApiKey: mgApiKey,
    routeThroughMastraGateway: false,
    settingsPath: config?.settingsPath,
  });

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
  // Local tracing is opt-in via `/observability local on`. When disabled, the
  // MastraStorageExporter is omitted entirely so traces never fall through to
  // the default libsql backend.
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
        //   threadId, resourceId, session.modeId, harnessId
        // Environment & project:
        //   state.projectName, state.gitBranch
        // Model configuration:
        //   session.modelId, state.subagentModelId
        // Agent settings:
        //   state.yolo, state.thinkingLevel, state.smartEditing
        // Observational memory settings:
        //   state.omScope, state.observerModelId, state.reflectorModelId,
        //   state.observationThreshold, state.reflectionThreshold
        requestContextKeys: [
          // Session identifiers
          'harness.threadId',
          'harness.resourceId',
          'harness.session.modeId',
          'harness.harnessId',
          // Environment & project
          'harness.state.projectName',
          'harness.state.gitBranch',
          // Model configuration
          'harness.session.modelId',
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
          // Only persist traces locally when DuckDB observability is available
          // (via `/observability local on`). Without this guard the storage
          // exporter falls through to the default libsql backend and silently
          // fills the main database with gigabytes of span data.
          ...(observabilityDomain ? [new MastraStorageExporter({ strategy: 'event-sourced' })] : []),
          new MastraPlatformExporter(resolveCloudObservabilityConfig(globalSettings, authStorage, project.resourceId)),
        ],
        spanOutputProcessors: [new SensitiveDataFilter()],
      },
    },
  });

  // Vector store for recall search (separate DB file to avoid bloating main storage)
  const vectorStore = await createVectorStore(storageConfig, storageResult.backend);

  const memory = config?.memory === false ? undefined : (config?.memory ?? getDynamicMemory(storage, vectorStore));

  // MCP
  const mcpManager = config?.disableMcp ? undefined : createMcpManager(project.rootPath, configDir, config?.mcpServers);

  // Hooks
  const hookManager = config?.disableHooks
    ? undefined
    : new HookManager(project.rootPath, 'session-init', configDir, homeDir);

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
        gitcrawlCommand:
          process.env.MASTRACODE_GITCRAWL_BIN ??
          process.env.GITCRAWL_BIN ??
          process.env.MASTRACODE_GITCRAWL_COMMAND ??
          process.env.GITCRAWL_COMMAND,
        getNotificationStreamOptions: ({ resourceId, threadId }) => {
          const requestContext = new RequestContext();
          const harnessContext: HarnessRequestContext = {
            harnessId: harness.id,
            state: harness.session.state.get(),
            getState: () => harness.session.state.get(),
            setState: updates => harness.session.state.set(updates),
            threadId,
            resourceId,
            session: {
              modeId: harness.session.mode.get(),
              modelId: harness.session.model.get(),
              state: {
                get: () => harness.session.state.get(),
                set: updates => harness.session.state.set(updates),
                update: updater => harness.session.state.update(updater),
              },
            },
            workspace: harness.getWorkspace(),
            getSubagentModelId: params => harness.session.subagents.model.get(params ?? {}),
          };
          requestContext.set('harness', harnessContext);

          return {
            memory: { thread: threadId, resource: resourceId },
            requestContext,
            maxSteps: 1000,
            savePerStep: false,
            requireToolApproval: (harness.session.state.get() as Record<string, unknown>).yolo !== true,
            modelSettings: { temperature: 1 },
          };
        },
      })
    : undefined;
  const slackToken =
    authStorage.getStoredApiKey('slack-signals') ??
    process.env.SLACK_USER_TOKEN ??
    process.env.MASTRACODE_SLACK_USER_TOKEN ??
    '';
  const slackApiBaseUrl = process.env.MASTRACODE_SLACK_API_BASE_URL;
  const slackSignals: SlackSignals | undefined =
    globalSettings.signals?.experimentalSlackSignals && slackToken
      ? new SlackSignals({
          token: slackToken,
          pollIntervalMs: globalSettings.signals.slackPollIntervalMs,
          ...(slackApiBaseUrl
            ? { syncClient: new SlackWebApiSyncClient({ token: slackToken, baseUrl: slackApiBaseUrl }) }
            : {}),
        })
      : undefined;
  const codeAgent: Agent = new Agent({
    id: CODE_AGENT_ID,
    name: 'Code Agent',
    instructions: getDynamicInstructions,
    model: getDynamicModel,
    tools: createDynamicTools(mcpManager, config?.extraTools, config?.disabledTools, storage),
    hooks: createToolHooks(hookManager),
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
    // TaskSignalProvider bundles the task tools + TaskStateProcessor: it merges
    // the tools into the toolset and registers the task state-signal processor,
    // so the task list persists across turns and survives OM truncation.
    signals: [new TaskSignalProvider(), ...(githubSignals ? [githubSignals] : []), ...(slackSignals ? [slackSignals] : [])],
    // Native goal mechanism: the in-loop goal step judges the thread's active
    // objective each qualifying iteration. The judge model is required for any
    // gating to occur; when unset the goal step is a complete no-op. A6 auto-wires
    // the GoalStateProcessor so the `<current-objective>` signal persists across
    // turns. Per-thread overrides live in the ThreadState `goal` record and win
    // over these defaults.
    goal: {
      // Resolve the judge model through mastracode's gateway (a model-resolver
      // function) so provider credentials are injected; returns undefined when no
      // judge model is configured, keeping the goal step a no-op. Bind the same
      // `settingsPath` used above so the judge model and `maxRuns` come from one
      // config (a custom settings file would otherwise diverge).
      judge: ctx => getGoalJudgeModel(ctx, config?.settingsPath),
      maxRuns: globalSettings.models.goalMaxTurns ?? 50,
      prompt: DEFAULT_GOAL_JUDGE_PROMPT,
      // Read-only workspace tools the default goal judge may call to verify the
      // agent's work against the actual filesystem (view, search_content,
      // find_files, file_stat, lsp_inspect) rather than grading prose alone —
      // restoring the original MastraCode judge's verification ability. Resolved
      // per-request from the active workspace (mirrors `judge`).
      tools: getGoalJudgeTools,
    },
    inputProcessors: [
      new AgentsMDInjector({
        getIgnoredInstructionPaths: ({ requestContext }) => {
          const harnessContext = requestContext?.get('harness') as
            | HarnessRequestContext<{ projectPath?: string }>
            | undefined;
          const state = harnessContext?.session.state.get();
          return getStaticallyLoadedInstructionPaths(state?.projectPath ?? project.rootPath);
        },
      }),
      new ProviderHistoryCompat(),
    ],
    errorProcessors: [new StreamErrorRetryProcessor(), new PrefillErrorHandler(), new ProviderHistoryCompat()],
  });

  // const defaultSubAgents: Array<HarnessSubagent> = [];
  // const defaultSubagents = [exploreSubagent, planSubagent, executeSubagent];

  const defaultModes: HarnessMode[] = [
    {
      ...buildMode,
      metadata: {
        ...buildMode.metadata,
        color: mastra.green,
      },
    },
    {
      ...planMode,
      metadata: {
        ...planMode.metadata,
        color: mastra.purple,
      },
    },
    {
      ...fastMode,
      metadata: {
        ...fastMode.metadata,
        color: mastra.orange,
      },
    },
  ];

  const defaultHeartbeatHandlers: HeartbeatHandler[] = [
    {
      id: 'gateway-sync',
      intervalMs: 5 * 60 * 1000,
      immediate: false,
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

  const modes = applyEffectiveDefaultsToModes(config?.modes ? config.modes : defaultModes, effectiveDefaults);
  const defaultModeId =
    modes.find(mode => mode.metadata?.default === true)?.id ??
    modes.find(mode => mode.id === 'build')?.id ??
    modes[0]?.id;
  if (!defaultModeId) {
    throw new Error('MastraCode requires at least one mode');
  }

  // Map subagent types to mode models: explore→fast, plan→plan, execute→build
  // const subagentModeMap: Record<string, string> = { explore: 'fast', plan: 'plan', execute: 'build' };
  // Subagents inherit workspace tools from the parent agent's workspace automatically.
  // Apply disabledTools filter to both default and custom subagents.
  // const subagents = [];

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

  // const { threads } = (await (
  //   await storage.getStore('memory')
  // )?.listThreads({
  //   perPage: false,
  //   filter: {
  //     resourceId: project.resourceId,
  //   },
  // })) ?? { threads: [] as StorageThreadType[] };
  // const ownerId = `mastracode-${hash(`${hostname()}\0${project.rootPath}`)}`;

  const typedStateSchema = stateSchema as PublicSchema<MastraCodeState>;
  const harness: Harness<MastraCodeState> = new Harness<MastraCodeState>({
    id: 'mastra-code',
    resourceId: project.resourceId,
    storage,
    observability,
    memory,
    pubsub: signalsPubSub,
    stateSchema: typedStateSchema,
    agent: codeAgent,
    subagents: config?.subagents ?? [],
    gateways: [mastraCodeGateway],
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
    workspace: config?.workspace ?? (args => getDynamicWorkspace(args)),
    browser: config?.browser,
    modes,
    heartbeatHandlers,
    resolveModel,
    customModelCatalogProvider: createMastraCodeModelCatalogProvider(mastraCodeGateway),
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
        const threads = await harness.session.thread.list({ allResources: true });
        const thread = threads.find((item: { id: string }) => item.id === threadId);
        await githubSignals.startPollingForThread(
          {
            threadId,
            resourceId: thread?.resourceId ?? harness.session.identity.getResourceId(),
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
    void startGithubPollingForCurrentThread(harness.session.thread.getId());
  }

  if (slackSignals) {
    const startSlackPollingForCurrentThread = async (threadId?: string | null) => {
      if (!threadId) return;
      slackSignals.stopAllPolling();
      try {
        const threads = await harness.session.thread.list({ allResources: true });
        const thread = threads.find((item: { id: string }) => item.id === threadId);
        await slackSignals.startPollingForThread(
          {
            threadId,
            resourceId: thread?.resourceId ?? harness.session.identity.getResourceId(),
          },
          { pollImmediately: true },
        );
      } catch (error) {
        console.warn('Failed to start Slack polling:', error);
      }
    };

    harness.subscribe((event: HarnessEvent) => {
      if (event.type === 'thread_changed') void startSlackPollingForCurrentThread(event.threadId);
      else if (event.type === 'thread_created') void startSlackPollingForCurrentThread(event.thread.id);
    });
    void startSlackPollingForCurrentThread(harness.session.thread.getId());
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
    slackSignals,
  };
}
