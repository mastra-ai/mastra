import { createHash } from 'node:crypto';
import { hostname } from 'node:os';
import path from 'node:path';

import type { Agent } from '@mastra/core/agent';
import { AgentController } from '@mastra/core/agent-controller';
import type {
  IntervalHandler,
  AgentControllerConfig,
  AgentControllerEvent,
  AgentControllerMode,
  AgentControllerSubagent,
  AgentControllerRequestContext,
  Session,
} from '@mastra/core/agent-controller';
import { createCodingAgent } from '@mastra/core/coding-agent';
import type { PubSub } from '@mastra/core/events';
import { PROVIDER_REGISTRY } from '@mastra/core/llm';
import type { ProviderConfig } from '@mastra/core/llm';
import { Mastra } from '@mastra/core/mastra';
import { defaultNotificationDeliveryDecision } from '@mastra/core/notifications';
import {
  AgentsMDInjector,
  createBackgroundWorkSignalProcessor,
  isBadRequestError,
  PrefillErrorHandler,
  ProviderHistoryCompat,
  StreamErrorRetryProcessor,
} from '@mastra/core/processors';
import type { InputProcessor, Processor } from '@mastra/core/processors';
import { RequestContext } from '@mastra/core/request-context';
import type { PublicSchema } from '@mastra/core/schema';
import type { ApiRoute } from '@mastra/core/server';
import { TaskSignalProvider } from '@mastra/core/signals';
import { InMemoryHarness, MastraCompositeStore } from '@mastra/core/storage';
import { DEFAULT_GOAL_JUDGE_PROMPT } from '@mastra/core/tools';
import type { MastraVector } from '@mastra/core/vector';
import { DuckDBStore } from '@mastra/duckdb';

import { GithubSignals } from '@mastra/github-signals';
import { LibSQLStore, LibSQLVector } from '@mastra/libsql';
import {
  Observability,
  MastraStorageExporter,
  MastraPlatformExporter,
  SensitiveDataFilter,
} from '@mastra/observability';
import { PostgresStore } from '@mastra/pg';

import { createBackgroundCompletionEvents } from './agents/background-completion-events.js';
import { createBackgroundCompletionCallbacks } from './agents/background-completion.js';
import { hasCredentialStoreProvider } from './agents/credential-resolver.js';
import { getDynamicInstructions } from './agents/instructions.js';
import { getDynamicMemory } from './agents/memory.js';
import { createMastraCodeGateway, getDynamicModel, getGoalJudgeModel, resolveModel } from './agents/model.js';
import { buildMode } from './agents/modes/build.js';
import { fastMode } from './agents/modes/explore.js';
import { planMode } from './agents/modes/plan.js';
import {
  createGitRefInstructionReader,
  createGitRefReminderReader,
  getStaticallyLoadedInstructionPaths,
} from './agents/prompts/agent-instructions.js';
// import { executeSubagent } from './agents/subagents/execute.js';
// import { exploreSubagent } from './agents/subagents/explore.js';
// import { planSubagent } from './agents/subagents/plan.js';
import { attachOMThreadStatePersistence, restoreOMThreadStateForCurrentThread } from './agents/thread-caveman-state.js';
import { createDynamicTools, createToolHooks } from './agents/tools.js';
import type { PostToolObserver, ToolLike } from './agents/tools.js';

import { getDynamicWorkspace, getGoalJudgeTools } from './agents/workspace.js';
import { isKimiCodingDeviceId } from './auth/providers/kimi-coding.js';
import { AuthStorage } from './auth/storage.js';
import { DEFAULT_CONFIG_DIR, validateConfigDirName } from './constants.js';
import { createOutcomeScorer, createEfficiencyScorer } from './evals/scorers/index.js';
import { HookManager } from './hooks/index.js';
import { createKnowledgeInspector as createScopedKnowledgeInspector } from './knowledge-inspector.js';
import { createMcpManager } from './mcp/index.js';
import type { McpServerConfig } from './mcp/index.js';
import { hasExplicitOMConfiguration } from './onboarding/om-settings.js';
import type { ProviderAccess } from './onboarding/packs.js';
import { getAvailableModePacks, getAvailableOmPacks, selectPreferredOMPack } from './onboarding/packs.js';
import {
  loadSettings,
  MASTRA_GATEWAY_PROVIDER,
  OBSERVABILITY_AUTH_PREFIX,
  resolveModelDefaults,
  resolveOmRoleModel,
  saveSettings,
} from './onboarding/settings.js';
import { getToolCategory } from './permissions.js';
import { PluginManager } from './plugins/manager.js';
import { PluginSignalLane } from './plugins/signal-lane.js';
import type { PluginProcessorEntries } from './plugins/types.js';
import { PlanRejectionAbortProcessor } from './processors/plan-rejection-abort.js';
import { createAmazonBedrockGateway } from './providers/amazon-bedrock-gateway.js';
import { setAuthStorage } from './providers/claude-max.js';
import { setAuthStorage as setGitHubCopilotAuthStorage } from './providers/github-copilot.js';
import { setAuthStorage as setKimiCodingAuthStorage } from './providers/kimi-coding.js';
import { setAuthStorage as setOpenAIAuthStorage } from './providers/openai-codex.js';
import { setAuthStorage as setXAIAuthStorage } from './providers/xai.js';

import { stateSchema } from './schema.js';
import type { MastraCodeState } from './schema.js';

import { mastraBrand } from './theme-palette.js';
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
import type { StorageResult } from './utils/storage-factory.js';
import { createStorageMaintenance, DEFAULT_RETENTION, resolveLocalDbFiles } from './utils/storage-maintenance.js';
import type { StorageMaintenance } from './utils/storage-maintenance.js';
import { acquireThreadLock, releaseThreadLock } from './utils/thread-lock.js';
import { registerWorkflowBuilderPrimitives } from './workflows/register-primitives.js';

const CODE_AGENT_ID = 'code-agent';

// Global retry policy for transient provider failures (e.g. dropped sockets and server errors).
// Applied centrally to every model call via StreamErrorRetryProcessor, independent of model-pack
// settings, so all modes/subagents benefit from a short wait before retrying a transient failure.
// Delay uses exponential backoff: initialDelay * 2^retryCount, capped at maxDelay.
const MASTRACODE_TRANSIENT_CONNECTION_MAX_RETRIES = 10;
const MASTRACODE_TRANSIENT_CONNECTION_RETRY_INITIAL_DELAY_MS = 500;
const MASTRACODE_TRANSIENT_CONNECTION_RETRY_MAX_DELAY_MS = 30000;

const TRANSIENT_CONNECTION_ERROR_CODES = new Set(['ECONNRESET', 'EPIPE']);
const TRANSIENT_CONNECTION_MESSAGE_PATTERN = /econnreset|socket hang up|write epipe|other side closed/i;
const TRANSIENT_SERVER_ERROR_STATUSES = new Set([500, 502, 503]);
const TRANSIENT_SERVER_ERROR_MESSAGE_PATTERN = /internal server|server error|api may be experiencing issues/i;

/**
 * Matcher for transient connection failures. Cause-chain traversal is handled
 * by `StreamErrorRetryProcessor.isRetryableStreamError`, which calls each
 * matcher at every level of the cause chain.
 */
/**
 * Read the session state fields the AgentsMDInjector callbacks need from the
 * controller request context (set by hosts like the factory review flow).
 */
function getInjectorSessionState(
  requestContext: { get: (key: string) => unknown } | undefined,
): { untrustedCheckout?: boolean; baseRef?: string; projectPath?: string } | undefined {
  const agentControllerContext = requestContext?.get('controller') as
    | AgentControllerRequestContext<{ untrustedCheckout?: boolean; baseRef?: string; projectPath?: string }>
    | undefined;
  return agentControllerContext?.getState();
}

function isTransientConnectionError(error: unknown): boolean {
  if (!error) return false;

  const code = typeof error === 'object' && 'code' in error ? (error as { code?: unknown }).code : undefined;
  if (typeof code === 'string' && TRANSIENT_CONNECTION_ERROR_CODES.has(code.toUpperCase())) return true;

  const message = error instanceof Error ? error.message : undefined;
  if (typeof message === 'string' && TRANSIENT_CONNECTION_MESSAGE_PATTERN.test(message)) return true;

  return false;
}

function isTransientServerError(error: unknown): boolean {
  if (!error) return false;

  const errorObj = typeof error === 'object' ? (error as { status?: unknown; statusCode?: unknown }) : undefined;
  if (
    (typeof errorObj?.status === 'number' && TRANSIENT_SERVER_ERROR_STATUSES.has(errorObj.status)) ||
    (typeof errorObj?.statusCode === 'number' && TRANSIENT_SERVER_ERROR_STATUSES.has(errorObj.statusCode))
  ) {
    return true;
  }

  const message = error instanceof Error ? error.message : undefined;
  return typeof message === 'string' && TRANSIENT_SERVER_ERROR_MESSAGE_PATTERN.test(message);
}

function getTransientRetryDelay(retryCount: number): number {
  return Math.min(
    MASTRACODE_TRANSIENT_CONNECTION_RETRY_INITIAL_DELAY_MS * Math.pow(2, retryCount),
    MASTRACODE_TRANSIENT_CONNECTION_RETRY_MAX_DELAY_MS,
  );
}

function emitTransientRetry(
  error: unknown,
  retryCount: number,
  delayMs: number,
  requestContext?: RequestContext,
): void {
  const controllerContext = requestContext?.get('controller') as AgentControllerRequestContext | undefined;
  controllerContext?.emitEvent?.({
    type: 'error',
    error: error instanceof Error ? error : new Error(String(error)),
    retryable: true,
    retryDelay: delayMs,
    retryAttempt: retryCount + 1,
    maxRetries: MASTRACODE_TRANSIENT_CONNECTION_MAX_RETRIES,
  });
}

/** Short deterministic hash (sha256, first 12 hex chars) matching project.ts shortHash style. */
function shortHash(input: string): string {
  return createHash('sha256').update(input).digest('hex').slice(0, 12);
}

function applyEffectiveDefaultsToModes(
  modes: AgentControllerMode[],
  effectiveDefaults: Record<string, string>,
): AgentControllerMode[] {
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

function addPluginToolsToModeAllowlists(
  modes: AgentControllerMode[],
  pluginToolNames: string[],
): AgentControllerMode[] {
  if (pluginToolNames.length === 0) return modes;
  return modes.map(mode => {
    if (!mode.availableTools) return mode;
    return {
      ...mode,
      availableTools: Array.from(new Set([...mode.availableTools, ...pluginToolNames])),
    };
  });
}

export interface MastraCodeConfig {
  /** Working directory for project detection. Default: process.cwd() */
  cwd?: string;
  /** Home directory for global config discovery. Default: os.homedir() */
  homeDir?: string;
  /** Override modes (model IDs, colors, which modes exist). Default: build/plan/fast */
  modes?: AgentControllerMode[];
  /** Override or extend subagent definitions. Default: explore/plan/execute */
  subagents?: AgentControllerSubagent[];
  /** Extra tools merged into the dynamic tool set. Can be a static record or a (sync or async) function that receives requestContext. */
  extraTools?:
    | Record<string, ToolLike | undefined>
    | ((ctx: {
        requestContext: RequestContext;
      }) => Record<string, ToolLike | undefined> | Promise<Record<string, ToolLike | undefined>>);
  /** Observe completed tool calls without replacing or modifying the built-in tool implementation. */
  postToolObserver?: PostToolObserver;
  /**
   * Stateless input processor instances prepended before Mastra Code's mandatory processors.
   * Embedders may extend processing but cannot replace built-in safety and compatibility policy.
   */
  inputProcessors?: InputProcessor[];
  /** Tools removed from the dynamic tool set before exposure to the model */
  disabledTools?: string[];
  /**
   * Custom storage config instead of auto-detected default, or a pre-built
   * store instance. An instance is used as-is: no connection test and no
   * LibSQL fallback — if the injected store fails, that's a hard error.
   */
  storage?: StorageConfig | MastraCompositeStore;
  /** Backend for an injected custom storage instance. Inferred for LibSQLStore and PostgresStore. */
  storageBackend?: 'libsql' | 'pg';
  /** Pre-built vector store instance for recall search. Skips the default vector store creation. */
  vector?: MastraVector;
  /** Observational memory scope. Default: auto-detected from env/config files, falls back to 'thread' */
  omScope?: 'thread' | 'resource';
  /** Path to a custom settings.json file. Default: global settings */
  settingsPath?: string;
  /** Initial state overrides (yolo, thinkingLevel, etc.) */
  initialState?: Partial<MastraCodeState>;
  /** Trusted host instructions resolved outside mutable session state. */
  hostInstructions?:
    | string
    | ((ctx: { requestContext: RequestContext }) => string | undefined | Promise<string | undefined>);
  /** Override id generation for threads/messages. Primarily useful for deterministic tests. */
  idGenerator?: AgentControllerConfig<MastraCodeState>['idGenerator'];
  /** Override interval handlers. Default: gateway-sync */
  intervalHandlers?: IntervalHandler[];
  /** Override the workspace. Default: local filesystem + local sandbox based on detected project */
  workspace?: AgentControllerConfig<MastraCodeState>['workspace'];
  /** Override the config directory name. Default: '.mastracode'. Replaces '.mastracode' in all project-level and global config paths (MCP, hooks, commands, database, skills, agent instructions). */
  configDir?: string;
  /** Programmatic MCP server configurations, merged with (and overriding) file-based configs. */
  mcpServers?: Record<string, McpServerConfig>;
  /** Disable MCP server discovery. Default: false */
  disableMcp?: boolean;
  /** Disable hooks. Default: false */
  disableHooks?: boolean;
  /** Disable plugin discovery/loading. Default: false */
  disablePlugins?: boolean;
  /** Disable the polling-based GitHub signal provider even when enabled in global settings. Default: false */
  disableGithubSignals?: boolean;
  /**
   * Skip seeding observational-memory knobs (observer/reflector models,
   * thresholds, caveman mode, attachment observation) from settings.json.
   * Server deployments that persist memory settings in their own database
   * (the factory's `memory-settings` domain) set this so the host machine's
   * TUI settings file never leaks into server sessions. Default: false.
   */
  disableSettingsOmSeed?: boolean;
  /** Override the plugin manager. Primarily useful for tests or embedding. */
  pluginManager?: PluginManager;
  /**
   * Override the memory instance (or dynamic factory) passed to the AgentController.
   * When provided, this replaces the default `getDynamicMemory(storage, vector)` which
   * uses mastracode's built-in model gateway (Anthropic OAuth, OpenAI Codex,
   * custom providers, and models.dev fallback).
   *
   * Use this when you need to override memory model behavior completely.
   */
  memory?: AgentControllerConfig<MastraCodeState>['memory'] | false;
  /** Browser provider for browser automation tools. When set, the agent gains access to browser tools. */
  browser?: AgentControllerConfig<MastraCodeState>['browser'];
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
  setKimiCodingAuthStorage(authStorage);
  setXAIAuthStorage(authStorage);
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

/**
 * Base factory: builds every shared MastraCode resource (storage, observability,
 * memory, MCP, providers, gateways, agent, modes) and the {@link AgentController}, but
 * does NOT call `init()` or create a session. The controller is returned inert so
 * the composition layer can decide its Mastra ownership and session model.
 *
 * See {@link bootLocalAgentController} (Case 3) and `mountAgentControllerOnMastra` (Cases 1 & 2).
 */
/**
 * `instanceof` checks against Mastra classes are unreliable here: published
 * packages pin exact `@mastra/core` versions, so a user's dependency graph can
 * contain multiple copies of core (and peer-keyed copies of `@mastra/libsql` /
 * `@mastra/pg`). A store built against one copy fails `instanceof` against
 * another — the injected instance then silently fell through to the
 * StorageConfig path and crashed on `config.url`. These structural checks work
 * across duplicated copies.
 */
function isInjectedStorageInstance(storage: MastraCodeConfig['storage']): storage is MastraCompositeStore {
  if (!storage) return false;
  if (storage instanceof MastraCompositeStore) return true;
  // A StorageConfig is a plain data object with a string `backend`
  // discriminant; a store instance carries the MastraCompositeStore method
  // surface.
  const candidate = storage as Partial<MastraCompositeStore>;
  return typeof candidate.init === 'function' && typeof candidate.__registerMastra === 'function';
}

/** Cross-copy-safe class check: walks the prototype chain by constructor name. */
function hasAncestorClassNamed(value: object, className: string): boolean {
  for (let proto = Object.getPrototypeOf(value); proto; proto = Object.getPrototypeOf(proto)) {
    if (proto.constructor?.name === className) return true;
  }
  return false;
}

function resolveInjectedStorageBackend(
  storage: MastraCompositeStore,
  configuredBackend?: 'libsql' | 'pg',
): 'libsql' | 'pg' {
  if (configuredBackend) return configuredBackend;
  if (storage instanceof LibSQLStore || hasAncestorClassNamed(storage, 'LibSQLStore')) return 'libsql';
  if (storage instanceof PostgresStore || hasAncestorClassNamed(storage, 'PostgresStore')) return 'pg';
  throw new Error('storageBackend is required when injecting a custom storage instance.');
}

export async function createMastraCodeAgentController(config?: MastraCodeConfig) {
  const cwd = config?.cwd ?? process.cwd();
  const homeDir = config?.homeDir ?? config?.initialState?.homeDir;
  const configDir = config?.configDir ?? DEFAULT_CONFIG_DIR;
  // The single session for this process, assigned once `createSession()` runs
  // below. Config callbacks defined before then (e.g. notification stream
  // options) read it lazily through this holder.
  let activeSession: Session<MastraCodeState> | undefined;
  // Same trick for the controller, which plugins reach through a lazy accessor.
  // Plugins load well before the controller is constructed, and a closure over
  // the `controller` binding itself would throw on early access rather than
  // reporting "not ready yet", so the accessor reads this holder instead.
  let pluginRuntimeController: AgentController<MastraCodeState> | undefined;
  if (configDir !== DEFAULT_CONFIG_DIR) {
    validateConfigDirName(configDir);
  }

  // Load .env file from cwd if present (for observability API keys, etc.)
  try {
    process.loadEnvFile(path.join(cwd, '.env'));
  } catch {
    // No .env file — that's fine, keys may be in shell environment
  }

  // Auth storage (shared with Claude Max / OpenAI providers and AgentController)
  const authStorage = createAuthStorage();
  const globalSettings = loadSettings(config?.settingsPath);
  const storedGatewayKey = authStorage.getStoredApiKey(MASTRA_GATEWAY_PROVIDER);
  const storedGatewayUrl = globalSettings.memoryGateway?.baseUrl;

  if (storedGatewayKey) {
    process.env['MASTRA_GATEWAY_API_KEY'] ??= storedGatewayKey;
  }

  if (storedGatewayUrl) {
    process.env['MASTRA_GATEWAY_URL'] ??= storedGatewayUrl;
  }

  // Load user-entered API keys from auth.json into process.env
  // (only sets env vars that aren't already present — env vars take precedence).
  // Skipped in deployed multi-tenant mode: when a per-tenant credential store
  // provider is registered, provider keys are resolved per request and must
  // never leak into process-global env vars.
  if (!hasCredentialStoreProvider()) {
    try {
      const registry = PROVIDER_REGISTRY as Record<string, ProviderConfig>;
      const providerEnvVars: Record<string, string | undefined> = {};
      for (const [provider, cfg] of Object.entries(registry)) {
        const envVars = cfg?.apiKeyEnvVar;
        providerEnvVars[provider] = Array.isArray(envVars) ? envVars[0] : envVars;
      }
      providerEnvVars[MASTRA_GATEWAY_PROVIDER] ??= 'MASTRA_GATEWAY_API_KEY';
      authStorage.loadStoredApiKeysIntoEnv(providerEnvVars);
    } catch {
      // Registry unavailable — load well-known provider keys so non-gateway flows still work
      authStorage.loadStoredApiKeysIntoEnv({
        [MASTRA_GATEWAY_PROVIDER]: 'MASTRA_GATEWAY_API_KEY',
        anthropic: 'ANTHROPIC_API_KEY',
        openai: 'OPENAI_API_KEY',
        google: 'GOOGLE_GENERATIVE_AI_API_KEY',
        cerebras: 'CEREBRAS_API_KEY',
        deepseek: 'DEEPSEEK_API_KEY',
      });
    }
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
  const amazonBedrockGateway = createAmazonBedrockGateway();

  // Project detection
  const project = detectProject(cwd);

  const resourceIdOverride = getResourceIdOverride(project.rootPath, configDir);
  if (resourceIdOverride) {
    project.resourceId = resourceIdOverride;
    project.resourceIdOverride = true;
  }

  // Stable session id unique to this project/resource, and a machine-bound owner
  // id. resourceId encodes root path + git identity and honors overrides, so it
  // is the right input for scoping the session to the cwd/project.
  const sessionId = `mastracode-session-${shortHash(project.resourceId)}`;
  const ownerId = `mastracode-${shortHash(`${hostname()}\0${project.rootPath}`)}`;

  const configuredPubSub = config?.pubsub;
  const useUnixSocketPubSub =
    (config?.unixSocketPubSub ?? globalSettings.signals?.unixSocketPubSub ?? false) && process.platform !== 'win32';
  const signalsPubSub = configuredPubSub ?? (useUnixSocketPubSub ? createSignalsPubSub(project.resourceId) : undefined);
  const crossProcessPubSub = config?.crossProcessPubSub ?? (!configuredPubSub && useUnixSocketPubSub);
  if (crossProcessPubSub && !signalsPubSub) {
    throw new Error('crossProcessPubSub requires a pubsub instance');
  }

  // Storage. An injected instance is used as-is — no connection test, no
  // LibSQL fallback: if the injected store fails, that's a hard error.
  const injectedStorage = isInjectedStorageInstance(config?.storage) ? config.storage : undefined;
  const storageConfig = injectedStorage
    ? undefined
    : ((config?.storage as StorageConfig | undefined) ??
      getStorageConfig(project.rootPath, globalSettings.storage, configDir));
  const storageResult: StorageResult = injectedStorage
    ? { storage: injectedStorage, backend: resolveInjectedStorageBackend(injectedStorage, config?.storageBackend) }
    : await createStorage(storageConfig!);
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
      // When local tracing is off, disable the observability domain entirely so
      // trace/score/feedback writes never fall through to the default libsql store.
      observability: observabilityDomain ?? false,
      harness: harnessStorage,
    },
  });

  // Observability (tracing, scoring, feedback)
  const observability = new Observability({
    configs: {
      default: {
        serviceName: 'mastracode',
        // Only these requestContext keys are stored on spans — prevents leaking
        // large objects (controller state, workspace, env vars) into trace data.
        // Use dot-notation because these are nested inside the 'controller' key.
        //
        // Session identifiers:
        //   threadId, resourceId, session.modeId, agentControllerId
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
          'controller.threadId',
          'controller.resourceId',
          'controller.session.modeId',
          'controller.controllerId',
          // Environment & project
          'controller.state.projectName',
          'controller.state.gitBranch',
          // Model configuration
          'controller.session.modelId',
          'controller.state.subagentModelId',
          // Agent settings
          'controller.state.yolo',
          'controller.state.thinkingLevel',
          'controller.state.smartEditing',
          // Observational memory settings
          'controller.state.omScope',
          'controller.state.observerModelId',
          'controller.state.reflectorModelId',
          'controller.state.observationThreshold',
          'controller.state.reflectionThreshold',
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

  // Vector store for recall search (separate DB file to avoid bloating main
  // storage). An injected instance is used as-is; with an injected storage
  // instance and no injected vector, recall search stays vector-less.
  const vector =
    config?.vector ?? (storageConfig ? await createVectorStore(storageConfig, storageResult.backend) : undefined);

  // Maintenance handle for /prune: prunes via the inner store (whose retention
  // config covers every domain, including legacy libsql observability spans)
  // and can compact local libsql files to reclaim disk. The vector store's
  // connection must close alongside storage — the compaction's file swap
  // refuses to run while any connection is open.
  const storageMaintenance: StorageMaintenance = createStorageMaintenance({
    storage: storageResult.storage,
    backend: storageResult.backend,
    retention: DEFAULT_RETENTION,
    localDbFiles: storageConfig ? resolveLocalDbFiles(storageConfig, storageResult.backend) : [],
    closeVector: vector instanceof LibSQLVector ? () => vector.close() : undefined,
  });

  const memory = config?.memory === false ? undefined : (config?.memory ?? getDynamicMemory(storage, vector));

  // MCP
  const mcpManager = config?.disableMcp
    ? undefined
    : createMcpManager(project.rootPath, configDir, config?.mcpServers, globalSettings.mcp);

  // Hooks
  const hookManager = config?.disableHooks
    ? undefined
    : new HookManager(
        project.rootPath,
        'session-init',
        configDir,
        homeDir,
        project.isWorktree
          ? { path: project.rootPath, branch: project.gitBranch, mainRepoPath: project.mainRepoPath }
          : undefined,
      );

  const pluginManager = config?.disablePlugins
    ? undefined
    : (config?.pluginManager ??
      new PluginManager({
        projectRoot: project.rootPath,
        configDir,
        homeDir,
      }));
  // Publish the runtime accessors to whichever manager is in play — including an
  // injected one, which would otherwise hand plugins `undefined` for
  // `getController`/`getActiveSession`. Lazy closures: both locals are assigned
  // after the controller is constructed below.
  pluginManager?.setRuntime({
    getController: () => pluginRuntimeController,
    getActiveSession: () => activeSession,
  });
  const loadedPlugins = pluginManager ? await pluginManager.reload() : [];
  const pluginTools = pluginManager?.getPluginTools() ?? {};

  // Scorers (live evaluation with sampling)
  const outcomeScorer = createOutcomeScorer();
  const efficiencyScorer = createEfficiencyScorer();

  // Agent — githubSignals is created before `controller` but the closure below
  // captures `controller` by reference; it is only invoked at notification time,
  // well after controller is constructed (line ~692). Explicit type annotations
  // on githubSignals, codeAgent, modes, and controller break the circular
  // inference chain this forward reference would otherwise create.
  // Shared by GithubSignals (immediate sends) and the code agent's
  // notification config (deferred sends re-dispatched by the core notification
  // dispatch workflow) — both need the target session's request context, or a
  // woken idle thread has no model to run with ("No model selected").
  const getNotificationStreamOptions = async ({ resourceId, threadId }: { resourceId: string; threadId: string }) => {
    // Run the woken notification as the session that owns the target
    // resource so it uses that session's model/mode/state. Fall back to
    // the current session only when no session owns the resource yet.
    const session = (await controller.getSessionByResource(resourceId)) ?? activeSession;
    // No session owns the resource and none is active yet (e.g. a deferred
    // notification comes due before any session boots). Nothing to resolve a
    // model from; return undefined so the dispatcher sends a bare wake
    // instead of throwing mid-delivery.
    if (!session) return undefined;
    // A long-running system must be able to drive work unattended, so a
    // target session without an explicit model selection falls back to a
    // real model rather than failing the run: the current session's live
    // selection (what the user actually picked), then the mode's default.
    const modeId = session.mode.get();
    const defaultModeModelId = controller.listModes().find(mode => mode.id === modeId)?.defaultModelId;
    const modelId = session.model.get() || activeSession?.model.get() || defaultModeModelId || '';
    const requestContext = new RequestContext();
    const agentControllerContext: AgentControllerRequestContext = {
      controllerId: controller.id,
      state: session.state.get(),
      getState: () => session.state.get(),
      setState: updates => session.state.set(updates),
      threadId,
      resourceId,
      session: {
        id: session.identity.getId(),
        ownerId: session.identity.getOwnerId(),
        modeId,
        modelId,
        state: {
          get: () => session.state.get(),
          set: updates => session.state.set(updates),
          update: updater => session.state.update(updater),
        },
      },
      workspace: session.getWorkspace(),
      getSubagentModelId: params => session.subagents.model.get(params ?? {}),
    };
    requestContext.set('controller', agentControllerContext);

    return {
      memory: { thread: threadId, resource: resourceId },
      requestContext,
      maxSteps: 1000,
      savePerStep: false,
      requireToolApproval: (session.state.get() as Record<string, unknown>).yolo !== true,
      modelSettings: { temperature: 1 },
    };
  };

  const githubSignals: GithubSignals | undefined =
    globalSettings.signals?.experimentalGithubSignals && !config?.disableGithubSignals
      ? new GithubSignals({
          cwd: project.rootPath,
          pollIntervalMs: globalSettings.signals.githubPollIntervalMs,
          gitcrawlCommand:
            process.env.MASTRACODE_GITCRAWL_BIN ??
            process.env.GITCRAWL_BIN ??
            process.env.MASTRACODE_GITCRAWL_COMMAND ??
            process.env.GITCRAWL_COMMAND,
          getNotificationStreamOptions,
        })
      : undefined;
  // Mastra Code's own processors are constructed once, here, rather than inside
  // the resolver below: the resolver runs before every LLM call, and rebuilding
  // stateful processors per request would reset them.
  const mastraCodeInputProcessors: InputProcessor[] = [
    ...(config?.inputProcessors ?? []),
    new PlanRejectionAbortProcessor(),
    createBackgroundWorkSignalProcessor(),
    new AgentsMDInjector({
      // Untrusted checkouts (review sessions on PR branches) must not have
      // the working tree's instruction files injected as system reminders —
      // those files are attacker-writable content, not configuration. When
      // the session carries a trusted base ref, reminders are served from
      // that ref instead (see getReader); without one they are disabled.
      isEnabled: ({ requestContext }) => {
        const state = getInjectorSessionState(requestContext);
        return state?.untrustedCheckout !== true || typeof state?.baseRef === 'string';
      },
      getReader: ({ requestContext }) => {
        const state = getInjectorSessionState(requestContext);
        if (state?.untrustedCheckout !== true || typeof state?.baseRef !== 'string') return undefined;
        return createGitRefReminderReader(state?.projectPath ?? project.rootPath, state.baseRef);
      },
      getIgnoredInstructionPaths: ({ requestContext }) => {
        const state = getInjectorSessionState(requestContext);
        const projectPath = state?.projectPath ?? project.rootPath;
        // On untrusted checkouts the static prompt loads from the base ref,
        // so compute the statically-loaded paths through the same reader to
        // keep the dedup consistent.
        const projectReader =
          state?.untrustedCheckout === true && typeof state?.baseRef === 'string'
            ? createGitRefInstructionReader(projectPath, state.baseRef)
            : undefined;
        return getStaticallyLoadedInstructionPaths(projectPath, undefined, projectReader);
      },
    }),
    new ProviderHistoryCompat(),
  ];

  // TaskSignalProvider bundles the task tools + TaskStateProcessor (see the
  // `signals` array below); named here so the plugin lane can reserve its id.
  const taskSignalProvider = new TaskSignalProvider();

  const NO_PLUGIN_PROCESSORS: PluginProcessorEntries = { input: [], output: [] };
  let pluginProcessorReadWarned = false;

  // Providers contributed by plugins are driven from here rather than through
  // the agent's `signals` array: the Agent constructor harvests a provider's
  // processors into a closure it can never undo, so a provider wired there
  // could not be removed when its plugin is disabled, updated or uninstalled.
  // The built-in providers are seeded as reserved ids because they are wired
  // through the constructor and are therefore invisible to the lane.
  const pluginSignalLane = pluginManager
    ? new PluginSignalLane({
        reservedProviderIds: [taskSignalProvider.id, ...(githubSignals ? [githubSignals.id] : [])],
      })
    : undefined;
  let unsubscribePluginReload: (() => void) | undefined;

  /**
   * Plugin processors are read through a function so that enabling, disabling or
   * updating a plugin takes effect on the next request rather than requiring a
   * new agent. This runs before every LLM call, and also outside the request
   * path when the Agent catalogues its configured processors — where a throw is
   * swallowed into a debug log. So it only reads already-resolved state: no
   * filesystem, no network, no construction, and it never throws.
   */
  const readPluginProcessors = (): PluginProcessorEntries => {
    try {
      return pluginManager?.getPluginProcessors() ?? NO_PLUGIN_PROCESSORS;
    } catch (error) {
      // Warn once: this is on the hot path, and a broken read repeats.
      if (!pluginProcessorReadWarned) {
        pluginProcessorReadWarned = true;
        console.warn('Failed to read plugin processors:', error);
      }
      return NO_PLUGIN_PROCESSORS;
    }
  };

  const codeAgent: Agent = createCodingAgent({
    id: CODE_AGENT_ID,
    name: 'Code Agent',
    // Workspace is wired per-request at the AgentController level (see
    // `config.workspace` below), so opt out of the factory's default local
    // workspace. An explicit `undefined` is required: the factory only builds a
    // default when the `workspace` key is absent.
    workspace: undefined,
    instructions: async ({ requestContext }) => {
      const configured = config?.hostInstructions;
      const hostInstructions = typeof configured === 'function' ? await configured({ requestContext }) : configured;
      return getDynamicInstructions({ requestContext, hostInstructions });
    },
    // `settingsPath` matches the source `createMastraCode()` reads from so the
    // per-mode thinking defaults resolve against the same config file.
    model: ctx => getDynamicModel(ctx, config?.settingsPath),
    // Deferred notifications are re-dispatched by the core notification
    // dispatch workflow long after the originating send; the delivery policy
    // rebuilds the request context (model selection included) at delivery time
    // so waking an idle thread does not fail with "No model selected". The
    // default decision logic is kept as-is — the policy only attaches
    // streamOptions on top of it.
    notifications: {
      deliveryPolicy: {
        decide: async input => {
          const decision = defaultNotificationDeliveryDecision(input);
          // Without a resourceId there is no session to resolve options from —
          // don't fall through to the active session and wake it under an
          // empty resource binding.
          if (!input.record.resourceId) return decision;
          const streamOptions = await getNotificationStreamOptions({
            resourceId: input.record.resourceId,
            threadId: input.record.threadId,
          });
          return streamOptions ? { ...decision, streamOptions } : decision;
        },
      },
    },
    tools: createDynamicTools(
      mcpManager,
      config?.extraTools,
      config?.disabledTools,
      storage,
      pluginTools,
      globalSettings.backgroundTools?.enabled ?? false,
    ),
    hooks: createToolHooks(hookManager, config?.postToolObserver),
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
    signals: [taskSignalProvider, ...(githubSignals ? [githubSignals] : [])],
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
      maxSteps: 1000,
      prompt: DEFAULT_GOAL_JUDGE_PROMPT,
      // Read-only workspace tools the default goal judge may call to verify the
      // agent's work against the actual filesystem (view, search_content,
      // find_files, file_stat, lsp_inspect) rather than grading prose alone —
      // restoring the original MastraCode judge's verification ability. Resolved
      // per-request from the active workspace (mirrors `judge`).
      tools: getGoalJudgeTools,
    },
    inputProcessors: () => [
      ...mastraCodeInputProcessors,
      ...readPluginProcessors().input.map(entry => entry.value),
      ...(pluginSignalLane?.getInputProcessors() ?? []),
    ],
    // Mastra Code contributes no output processors of its own; the lane exists
    // so plugins can. Like the input lane, plugin processors sit last — after
    // the layers they customize, before the channel and memory layers the
    // Agent appends.
    outputProcessors: () => [
      ...readPluginProcessors().output.map(entry => entry.value),
      ...(pluginSignalLane?.getOutputProcessors() ?? []),
    ],
    errorProcessors: [
      // ProviderHistoryCompat must run before StreamErrorRetryProcessor: both react to
      // HTTP 400s, but ProviderHistoryCompat repairs the incompatible history (e.g.
      // sanitizing tool-call IDs) before retrying, while StreamErrorRetryProcessor's
      // isBadRequestError matcher retries the identical request. Error processors
      // short-circuit on the first `retry: true`, so a blind retry first would resend
      // the broken history and fail again.
      new ProviderHistoryCompat(),
      new StreamErrorRetryProcessor({
        matchers: [
          { match: isBadRequestError, maxRetries: 1, delayMs: 2000 },
          {
            match: isTransientConnectionError,
            maxRetries: MASTRACODE_TRANSIENT_CONNECTION_MAX_RETRIES,
            delayMs: ({ retryCount }) => getTransientRetryDelay(retryCount),
            onRetry: ({ error, retryCount, delayMs, requestContext }) =>
              emitTransientRetry(error, retryCount, delayMs, requestContext),
          },
          {
            match: isTransientServerError,
            maxRetries: MASTRACODE_TRANSIENT_CONNECTION_MAX_RETRIES,
            delayMs: ({ retryCount }) => getTransientRetryDelay(retryCount),
            onRetry: ({ error, retryCount, delayMs, requestContext }) =>
              emitTransientRetry(error, retryCount, delayMs, requestContext),
          },
        ],
      }),
      new PrefillErrorHandler(),
    ],
  });

  // const defaultSubAgents: Array<AgentControllerSubagent> = [];
  // const defaultSubagents = [exploreSubagent, planSubagent, executeSubagent];

  const defaultModes: AgentControllerMode[] = [
    {
      ...buildMode,
      metadata: {
        ...buildMode.metadata,
        color: mastraBrand.green,
      },
    },
    {
      ...planMode,
      metadata: {
        ...planMode.metadata,
        color: mastraBrand.purple,
      },
    },
    {
      ...fastMode,
      metadata: {
        ...fastMode.metadata,
        color: mastraBrand.orange,
      },
    },
  ];

  const defaultIntervalHandlers: IntervalHandler[] = [
    {
      id: 'gateway-sync',
      intervalMs: 5 * 60 * 1000,
      immediate: false,
      handler: () => syncGateways(),
    },
  ];
  const intervalHandlers = config?.intervalHandlers ?? defaultIntervalHandlers;

  // Build lightweight provider access for resolving built-in packs at startup.
  // Anthropic/OpenAI use AuthStorage; other providers use env API keys.
  // Also scan the full provider registry so configured API keys satisfy access checks.
  const anthropicCred = authStorage.get('anthropic');
  const openaiCred = authStorage.get('openai-codex');
  const githubCopilotCred = authStorage.get('github-copilot');
  const kimiCodingCred = authStorage.get('kimi-for-coding');
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
    'kimi-for-coding':
      kimiCodingCred?.type === 'oauth' && isKimiCodingDeviceId(kimiCodingCred.deviceId)
        ? 'oauth'
        : (kimiCodingCred?.type === 'api_key' && kimiCodingCred.key.trim().length > 0) ||
            Boolean(process.env.KIMI_API_KEY?.trim())
          ? 'apikey'
          : false,
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
  const activeProviderId = effectiveDefaults.build?.split('/')[0];
  const preferredOmModel = hasExplicitOMConfiguration(globalSettings)
    ? undefined
    : selectPreferredOMPack(startupAccess, activeProviderId)?.modelId;
  const effectiveObserverModel = resolveOmRoleModel(globalSettings, 'observer', builtinOmPacks) || preferredOmModel;
  const effectiveReflectorModel = resolveOmRoleModel(globalSettings, 'reflector', builtinOmPacks) || preferredOmModel;
  const effectiveObservationThreshold = globalSettings.models.omObservationThreshold ?? undefined;
  const effectiveReflectionThreshold = globalSettings.models.omReflectionThreshold ?? undefined;
  const effectiveCavemanObservations = globalSettings.models.omCavemanObservations ?? undefined;
  const effectiveObserveAttachments = globalSettings.models.omObserveAttachments ?? 'auto';

  const modes = addPluginToolsToModeAllowlists(
    applyEffectiveDefaultsToModes(config?.modes ? config.modes : defaultModes, effectiveDefaults),
    Object.keys(pluginTools),
  );
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

  // Build initial state with global preferences. OM knobs are skipped when the
  // host persists memory settings elsewhere (`disableSettingsOmSeed`) so the
  // machine-local settings.json never leaks into server sessions.
  const globalInitialState: Partial<MastraCodeState> = {};
  if (!config?.disableSettingsOmSeed) {
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
  }
  if (globalSettings.preferences.yolo !== null) {
    globalInitialState.yolo = globalSettings.preferences.yolo;
  }
  // Note: `thinkingLevel` is intentionally NOT seeded into session state. The
  // state slot is a session-level override; the effective level is resolved at
  // request time (per-mode defaults → global preference) in getDynamicModel so
  // settings changes apply to the next request of every session.
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

  const typedStateSchema = stateSchema as PublicSchema<MastraCodeState>;
  const backgroundCompletionEvents = createBackgroundCompletionEvents();
  let controller: AgentController<MastraCodeState>;
  controller = new AgentController<MastraCodeState>({
    id: 'mastra-code',
    resourceId: project.resourceId,
    storage,
    backgroundTasks: {
      enabled: true,
      recoverStaleTasksOnStart: false,
      ...createBackgroundCompletionCallbacks(() => controller, backgroundCompletionEvents),
    },
    observability,
    memory,
    pubsub: signalsPubSub,
    stateSchema: typedStateSchema,
    agent: codeAgent,
    subagents: config?.subagents ?? [],
    gateways: [amazonBedrockGateway, mastraCodeGateway],
    workspace:
      config?.workspace ??
      (args =>
        getDynamicWorkspace({ ...args, backgroundToolsEnabled: globalSettings.backgroundTools?.enabled ?? false })),
    browser: config?.browser,
    idGenerator: config?.idGenerator,
    toolCategoryResolver: getToolCategory,
    initialState: {
      projectPath: project.rootPath,
      projectName: project.name,
      gitBranch: project.gitBranch,
      pluginSkillPaths: loadedPlugins.flatMap(plugin => (plugin.status === 'active' ? (plugin.skillPaths ?? []) : [])),
      pluginCommandPaths: loadedPlugins.flatMap(plugin =>
        plugin.status === 'active' ? (plugin.commandPaths ?? []) : [],
      ),
      pluginInstructions: loadedPlugins.flatMap(plugin =>
        plugin.status === 'active' && plugin.instructions ? [plugin.instructions] : [],
      ),
      yolo: true,
      ...globalInitialState,
      ...config?.initialState,
      // configDir must always win over initialState spreads to stay in sync
      // with MCP/hooks/storage which were already initialized with this value.
      configDir,
    },
    modes,
    intervalHandlers,
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
  });

  // Publish the controller to the plugin runtime accessors now that it exists.
  pluginRuntimeController = controller;

  if (pluginSignalLane && pluginManager) {
    // Register the plugins loaded at startup, and re-reconcile on every reload.
    // Providers are not started here: they need a Mastra instance for storage,
    // and Mastra does not exist until the composition layer boots the controller
    // (see `startPluginSignalProviders` on the returned object).
    pluginSignalLane.sync(pluginManager.getPluginSignalProviders());
    unsubscribePluginReload = pluginManager.onReload(() =>
      pluginSignalLane.sync(pluginManager.getPluginSignalProviders()),
    );
  }

  // The AgentController is fully constructed but intentionally NOT inited here. Init and
  // session creation are deferred to the composition layer (see below) so the
  // controller can be wired in three ways:
  //
  //   1. Server + Web   — registered on a server Mastra, then inited; sessions
  //                       minted per browser client over HTTP.
  //   2. Server + TUI   — same server composition; the TUI drives a session
  //                       (in-process today; remote transport is future work).
  //   3. Local  + TUI   — controller builds its own internal Mastra on init() and
  //                       mints one eager session for the whole process.
  //
  // Cases 1 & 2 use `mountAgentControllerOnMastra` (register-before-init, no eager
  // session). Case 3 uses `bootLocalAgentController` (init + one wired session).
  return {
    controller: controller,
    storage,
    storageMaintenance,
    createKnowledgeInspector: (session: Session<MastraCodeState>) =>
      createScopedKnowledgeInspector({ storage, session }),
    observability,
    memory,
    mcpManager,
    hookManager,
    pluginManager,
    loadedPlugins,
    pluginTools,
    signalsPubSub,
    authStorage,
    resolveModel,
    storageWarning,
    observabilityWarning,
    builtinPacks,
    builtinOmPacks,
    effectiveDefaults,
    githubSignals,
    backgroundCompletionEvents,
    // Identity for the single local session (Case 3). Servers ignore these and
    // mint per-request sessions with client-supplied resourceIds instead.
    sessionId,
    ownerId,
    // Surface the project root so boot/mount paths can wire workflow tools
    // against a workspace anchored at it without re-running detectProject().
    projectPath: project.rootPath,
    // Surface the Agent instance so registerWorkflowBuilderPrimitives can add
    // it as a plain agent on the Mastra registry. Workflows then compose it
    // as an agent step (agentId: 'code-agent') and delegate open-ended tool
    // orchestration to it — code-agent already has full workspace / MCP / web
    // access via its dynamic tool factory.
    codeAgent,
    // Lets the composition layer publish the created session back into the
    // config closures (e.g. notification stream options read it lazily).
    setActiveSession: (session: Session<MastraCodeState>) => {
      activeSession = session;
    },
    /**
     * Starts the signal providers contributed by plugins. Called by the
     * composition layer once the controller is inited, because that is when a
     * Mastra instance exists — a provider without one has no storage, and
     * nothing else will hand it one: the Agent propagates Mastra only to the
     * providers in its own `signals` array, which these deliberately are not in.
     */
    startPluginSignalProviders: () => {
      const mastra = controller.getMastra();
      if (!pluginSignalLane || !mastra) return;
      pluginSignalLane.setMastra(mastra, codeAgent);
    },
    /**
     * Stops every plugin-contributed signal provider and stops listening for
     * plugin reloads. The inverse of `startPluginSignalProviders`, for an
     * embedder that is done with this controller: a `pluginManager` shared
     * across controllers (`MastraCodeConfig.pluginManager`) outlives any one of
     * them, so without this its providers keep polling and its reload listener
     * keeps firing for a controller that is gone.
     */
    stopPluginSignalProviders: () => {
      unsubscribePluginReload?.();
      unsubscribePluginReload = undefined;
      pluginSignalLane?.stopAll();
    },
    /**
     * Hands Mastra to the statically configured input processors.
     *
     * The Agent does this itself, but only for processors configured as a
     * plain array (`Array.isArray` in `__registerMastra`). This lane is a
     * function so plugins can contribute to it, which takes those processors
     * out of that branch — including any an embedder passed as
     * `config.inputProcessors`, some of which need Mastra to work at all
     * (`CostGuardProcessor` reads observability storage there). Doing it here
     * keeps that unchanged.
     *
     * Plugin processors are deliberately not included: they come and go with
     * their plugin, and the registry keeps the first instance registered under
     * an id forever, which would leave a retired instance behind. Plugins
     * reach Mastra through `getController()` on the plugin context instead.
     */
    registerConfiguredProcessorsWithMastra: () => {
      const mastra = controller.getMastra();
      if (!mastra) return;
      for (const processor of mastraCodeInputProcessors) {
        mastra.addProcessor(processor as Processor);
        mastra.addProcessorConfiguration(processor as Processor, CODE_AGENT_ID, 'input');
      }
    },
  };
}

/**
 * Result of {@link createMastraCodeAgentController}: every shared resource plus the
 * inert AgentController, ready to be either booted locally or mounted on a server
 * Mastra.
 */
export type MastraCodeAgentController = Awaited<ReturnType<typeof createMastraCodeAgentController>>;

/**
 * Wires the session-scoped concerns MastraCode layers on top of a Session:
 * hookManager thread-id sync, GitHub PR polling for the current thread, and
 * per-thread persistence of the mastracode-only `/om` settings.
 *
 * Used by {@link bootLocalAgentController} for the single local session. A server can
 * call this for any session it mints if it wants the same background wiring.
 */
export async function wireSessionConcerns(
  base: Pick<MastraCodeAgentController, 'hookManager' | 'githubSignals' | 'setActiveSession'>,
  session: Session<MastraCodeState>,
): Promise<void> {
  const { hookManager, githubSignals } = base;
  base.setActiveSession(session);

  // Sync hookManager session ID on thread changes
  if (hookManager) {
    session.subscribe((event: AgentControllerEvent) => {
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
        const threads = await session.thread.list({ allResources: true });
        const thread = threads.find((item: { id: string }) => item.id === threadId);
        await githubSignals.startPollingForThread(
          {
            threadId,
            resourceId: thread?.resourceId ?? session.identity.getResourceId(),
          },
          { pollImmediately: true },
        );
      } catch (error) {
        console.warn('Failed to start GitHub PR polling:', error);
      }
    };

    session.subscribe((event: AgentControllerEvent) => {
      if (event.type === 'thread_changed') void startGithubPollingForCurrentThread(event.threadId);
      else if (event.type === 'thread_created') void startGithubPollingForCurrentThread(event.thread.id);
    });
    void startGithubPollingForCurrentThread(session.thread.getId());
  }

  // Persist MastraCode-owned /om settings per-thread (mastracode-only concern;
  // intentionally not in core's controller loadThreadMetadata).
  const omThreadStateSession = session as unknown as Session<Record<string, unknown>>;
  attachOMThreadStatePersistence(omThreadStateSession);
  await restoreOMThreadStateForCurrentThread(omThreadStateSession).catch(() => {
    // Persistence is best-effort; don't crash startup if storage hiccups.
  });
}

/**
 * Case 3 (AgentController local + TUI/headless): build the controller, let it stand up its
 * own internal Mastra via `init()`, and mint the single eager session that all
 * work in this process runs through. The AgentController owns no session of its own.
 */
export async function bootLocalAgentController(config?: MastraCodeConfig) {
  const base = await createMastraCodeAgentController(config);
  const { controller, sessionId, ownerId, projectPath, codeAgent, mcpManager } = base;

  await controller.init();
  // Register workflow primitives (sub-agent + workspace tools + code-agent
  // + web + notification_inbox + snapshot of MCP tools) on the controller's
  // Mastra so the dynamic-workflow loading in startWorkers() can rehydrate
  // saved workflows against the right tool/agent registry.
  const mastra = controller.getMastra();
  if (mastra) await registerWorkflowBuilderPrimitives(mastra, { projectPath, codeAgent, mcpManager });
  await mastra?.startWorkers();
  base.registerConfiguredProcessorsWithMastra();
  base.startPluginSignalProviders();
  const session = await controller.createSession({ id: sessionId, ownerId });
  await wireSessionConcerns(base, session);
  const knowledgeInspector = await base.createKnowledgeInspector(session);

  return {
    ...base,
    session,
    knowledgeInspector,
    knowledgeInspectorUnavailableReason: knowledgeInspector
      ? undefined
      : 'Knowledge inspection requires a configured knowledge storage domain.',
  };
}

/** Result of {@link mountAgentControllerOnMastra}: shared handles plus the owning Mastra. */
export type MountedMastraCode = MastraCodeAgentController & { mastra: Mastra };

/**
 * Cases 1 & 2 (AgentController in Server + Web/TUI): build the controller, register it on a
 * server-owned Mastra, THEN init it. Registering before `init()` is what makes
 * the controller inherit the server's Mastra (storage, agents, gateways) instead of
 * spinning up its own internal one — there is a single shared Mastra.
 *
 * No eager session is minted: each client (browser or terminal) creates/resumes
 * its own isolated session via `controller.createSession({ resourceId })`, so one
 * server can drive many concurrent users.
 *
 * Pass an existing `mastra` to mount onto a Mastra that already hosts other
 * primitives; otherwise a Mastra is created that owns the controller's storage so
 * durability is configured in one place.
 */
export async function mountAgentControllerOnMastra(
  config?: MastraCodeConfig & {
    mastra?: Mastra;
    controllerId?: string;
    buildApiRoutes?: (deps: { controller: MountedMastraCode['controller']; authStorage: AuthStorage }) => ApiRoute[];
    /**
     * Additional `server` config to fold onto the constructed Mastra alongside
     * the assembled `apiRoutes` (e.g. `middleware`, `cors`). Used by the
     * platform entry (`src/mastra/index.ts`) to own the WorkOS gate + tenant
     * dispatcher + CORS on the instance the deployer generates its server from.
     * Ignored when `mastra` is provided (mounting onto a caller-owned instance).
     */
    buildServerConfig?: (deps: {
      controller: MountedMastraCode['controller'];
      authStorage: AuthStorage;
    }) => Omit<NonNullable<ConstructorParameters<typeof Mastra>[0]>['server'], 'apiRoutes'>;
  },
): Promise<MountedMastraCode> {
  const prepared = await prepareAgentControllerMount(config);
  if (config?.mastra) {
    // Mounting onto a Mastra the caller already built. Ensure the controller's
    // back-reference points at it (idempotent — only sets #externalMastra).
    prepared.base.controller.__registerMastra(config.mastra);
    await prepared.finalize();
    return { ...prepared.base, mastra: config.mastra };
  }
  const mastra = new Mastra(prepared.mastraArgs);
  await prepared.finalize();
  return { ...prepared.base, mastra };
}

/**
 * Assemble everything needed to construct the server-owned Mastra WITHOUT
 * constructing it, so a caller (the platform entry `src/mastra/index.ts`) can
 * run the `new Mastra(...)` literal in its own module. The deployer's
 * `checkConfigExport` Babel plugin only marks the config valid when it finds a
 * top-level `new Mastra(...)` exported as `mastra` in the ENTRY file; hiding the
 * construction inside this helper would trip the "Invalid Mastra config" warning.
 *
 * Returns the constructor args plus a `finalize()` that runs the post-construct
 * boot (`controller.init()` + `startWorkers()`). The controller is registered on
 * the Mastra via the `agentControllers` arg at construction time.
 */
export async function prepareAgentControllerMount(
  config?: MastraCodeConfig & {
    mastra?: Mastra;
    controllerId?: string;
    buildApiRoutes?: (deps: { controller: MountedMastraCode['controller']; authStorage: AuthStorage }) => ApiRoute[];
    buildServerConfig?: (deps: {
      controller: MountedMastraCode['controller'];
      authStorage: AuthStorage;
    }) => Omit<NonNullable<ConstructorParameters<typeof Mastra>[0]>['server'], 'apiRoutes'>;
  },
): Promise<{
  base: Awaited<ReturnType<typeof createMastraCodeAgentController>>;
  mastraArgs: NonNullable<ConstructorParameters<typeof Mastra>[0]>;
  finalize: () => Promise<void>;
}> {
  const base = await createMastraCodeAgentController(config);
  const { controller, storage, authStorage, projectPath, codeAgent, mcpManager } = base;
  const controllerId = config?.controllerId ?? controller.id;
  const apiRoutes = config?.buildApiRoutes?.({ controller, authStorage });
  const extraServerConfig = config?.buildServerConfig?.({ controller, authStorage });
  // Only register workflow primitives when we own the Mastra. If the caller
  // brought their own, they're responsible for what's registered on it.
  const weOwnTheMastra = !config?.mastra;

  const serverConfig = {
    ...extraServerConfig,
    ...(apiRoutes?.length ? { apiRoutes } : {}),
  };
  const mastraArgs = {
    agentControllers: { [controllerId]: controller },
    storage,
    backgroundTasks: { enabled: true, recoverStaleTasksOnStart: false },
    // Mirror the controller's internal-Mastra construction (which passes
    // `config.pubsub` through): the server-owned Mastra must run its event
    // bus on the same transport so streams/workflows/signals stay
    // cross-process when a distributed PubSub (e.g. Redis Streams) is
    // configured.
    ...(base.signalsPubSub ? { pubsub: base.signalsPubSub } : {}),
    ...(Object.keys(serverConfig).length ? { server: serverConfig } : {}),
  };

  const finalize = async () => {
    await controller.init();
    if (weOwnTheMastra) {
      const mastra = controller.getMastra();
      if (mastra) await registerWorkflowBuilderPrimitives(mastra, { projectPath, codeAgent, mcpManager });
    }
    await controller.getMastra()?.startWorkers();
    // Anchored here rather than at a `new Mastra(...)` call site: finalize runs
    // in every mount path (caller-supplied Mastra, SDK-constructed Mastra, and
    // the platform entry that constructs its own), so plugin providers start
    // exactly once regardless of how Mastra Code was mounted.
    base.registerConfiguredProcessorsWithMastra();
    base.startPluginSignalProviders();
  };

  return { base, mastraArgs, finalize };
}

/**
 * Back-compat alias. Historically `createMastraCode` built and booted a local
 * controller with a single session; that behavior now lives in
 * {@link bootLocalAgentController}. New code should call the explicit factory for its
 * case: `bootLocalAgentController` (local) or {@link mountAgentControllerOnMastra} (server).
 */
export const createMastraCode = bootLocalAgentController;
export * from './knowledge-inspector.js';
export { LOCAL_KNOWLEDGE_ORG_ID } from './knowledge-scope.js';

/**
 * Programmatic headless API. `runMC` runs an already-built controller/session
 * (from {@link createMastraCode}) as an async-iterable run that also resolves to
 * a typed result. Also available via the `mastracode/headless` subpath.
 */
export {
  runMC,
  runMCCli,
  hasHeadlessFlag,
  autoApprovePolicy,
  denyPolicy,
  permissionModeToPolicy,
  formatHuman,
  formatJsonl,
  renderTextResult,
  renderJsonResult,
} from './headless/index.js';
export type {
  RunMCOptions,
  RunMCResult,
  RunMCStatus,
  RunMCUsage,
  RunMCToolCall,
  RunMCToolResult,
  RunMCError,
  RunMCThreadOptions,
  MCRun,
  ResolutionPolicy,
  PermissionMode,
} from './headless/index.js';
