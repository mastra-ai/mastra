import type { Agent } from '../agent';
import type { MastraDBMessage } from '../agent/message-list/state/types';
import type { AgentInstructions, ToolsInput } from '../agent/types';
import type { MastraBrowser } from '../browser/browser';
import type { PubSub } from '../events/pubsub';
import type { MastraModelGatewayInterface } from '../llm/model/gateways';
import type { LoopOptions } from '../loop/types';
import type { MastraMemory } from '../memory/memory';
import type { ObservabilityEntrypoint } from '../observability/types/core';
import type { PublicSchema } from '../schema';
import type { MastraCompositeStore } from '../storage/base';
import type { GoalEvaluationPayload } from '../stream/types';
import type { DynamicArgument } from '../types';
import type { Workspace, WorkspaceStatus } from '../workspace';
import type { TaskItemSnapshot } from './tools';

// =============================================================================
// Interval Handlers
// =============================================================================

/**
 * A periodic task that the AgentController runs on a timer.
 * Interval handlers start during `init()` and are cleaned up on `stopIntervals()`.
 */
export interface IntervalHandler {
  /** Unique identifier for this handler (used for dedup and logging) */
  id: string;
  /** Interval in milliseconds between invocations */
  intervalMs: number;
  /** The function to run on each tick */
  handler: () => void | Promise<void>;
  /** Whether to run the handler immediately on start (default: true) */
  immediate?: boolean;
  /** Called when the handler is removed or all intervals are stopped */
  shutdown?: () => void | Promise<void>;
}

// =============================================================================
// AgentController Configuration
// ===================

/**
 * Configuration for a single agent mode within the controller.
 * Each mode represents a different "personality" or capability set.
 */
interface AgentControllerModeBase {
  /** Unique within `AgentControllerConfig.modes`. Validated at construction. */
  id: string;

  name?: string;

  /** bootstrap model default when a session enters this mode. */
  defaultModelId?: string;

  /** Surfaced in mode pickers / Studio UI. Free text. */
  description?: string;

  /**
   * Layered above the backing agent's own instructions for the duration
   * of this mode. Plain text by design — modes carve operating profile,
   * not full system-message overrides.
   */
  instructions?: string;

  /** @deprecated Use AgentControllerConfig.agent as the shared backing agent. */
  agent?: Agent<any, any, any, any>;

  /** @deprecated Prefer metadata.default. */
  default?: boolean;

  /**
   * Optional plan→build target. When `submit_plan` runs in this mode, the
   * registered `PendingResume` freezes this value as `transitionModeId`.
   * On approval, the session flips to this mode
   * idempotently (§5.1, §5.7). If unset, plan approval resumes with no
   * mode change. Must reference another mode's `id`.
   */
  transitionsTo?: string;

  /**
   * Unified per-mode tool visibility allowlist. When set, only tools whose
   * final exposed names appear in this list are visible to the model and
   * executable during this mode's runs. Workspace tools use the same list
   * as all other tools — configure them by exposed tool names such as
   * `view`, `write_file`, `find_files`, etc. (after workspace tool renaming
   * via `TOOL_NAME_OVERRIDES`).
   *
   * - `undefined` (default): no mode-level restriction; all tools are visible.
   * - `[]`: no tools are available for this mode.
   * - Per-tool permission `deny` and category `deny` still win — a denied
   *   tool is hidden even if it appears in this list.
   * - `tools` / `additionalTools` remain toolset composition inputs (which
   *   tools are added to the run), not visibility gates.
   *
   * Enforced at LLM-call time via `activeTools`, matching the existing
   * execution-time enforcement in the durable tool-call step.
   */
  availableTools?: string[];

  /**
   * Arbitrary user-defined metadata. `metadata.default === true` is a
   * reserved controller hint for choosing the default mode when `defaultModeId`
   * is unset; all other metadata is pass-through and unvalidated. Use for UI
   * affordances like display color, icon, display name overrides, or any
   * per-mode configuration that isn't part of the controller's own contract.
   *
   * Surfaced verbatim on `getCurrentMode()` and `listModes()`.
   */
  metadata?: Record<string, unknown>;
}

type AgentControllerModeToolOverrides =
  | {
      /**
       * Mode-level tools added as a separate toolset alongside the backing
       * agent's own tools. With a shared backing agent (`AgentControllerConfig.agent`),
       * these are layered as an augment — the agent's own tools are **not**
       * masked. To restrict which tools are visible, use `availableTools`
       * instead. Mutually exclusive with `additionalTools`.
       */
      tools?: ToolsInput;
      additionalTools?: never;
    }
  | {
      tools?: never;
      /**
       * Tools layered on top of the backing agent's tools. The agent's tools
       * stay; these are added. Mutually exclusive with `tools`.
       */
      additionalTools?: ToolsInput;
    };

export type AgentControllerMode = AgentControllerModeBase & AgentControllerModeToolOverrides;

// =============================================================================
// Subagents
// =============================================================================

/**
 * Definition of a subagent that the AgentController can spawn via the built-in `subagent` tool.
 * Each subagent runs as a fresh Agent with constrained tools and its own instructions.
 */
export interface AgentControllerSubagent {
  /** Unique identifier for this subagent type (e.g., "explore", "plan", "execute") */
  id: string;

  /** Human-readable name shown in tool output (e.g., "Explore") */
  name: string;

  /** Description of what this subagent does (used in auto-generated tool description) */
  description: string;

  /**
   * Instructions that guide the agent's behavior. Can be a string, array of strings, system message object,
   * array of system messages, or a function that returns any of these types dynamically.
   */
  instructions: DynamicArgument<AgentInstructions>;

  /** Tools this subagent has direct access to */
  tools?: ToolsInput;

  /**
   * Tool IDs to pull from the controller's shared `tools` config.
   * Merged with `tools` above — allows subagents to use a subset of controller tools.
   */
  allowedControllerTools?: string[];

  /** Default model ID for this subagent type (e.g., "anthropic/claude-sonnet-4-20250514") */
  defaultModelId?: string;

  /** Optional maximum number of steps for this subagent's execution loop */
  maxSteps?: number;

  /** Optional stop condition for this subagent's execution loop */
  stopWhen?: LoopOptions['stopWhen'];

  /**
   * Workspace tool keys (after any renames) the model is allowed to call.
   * When set, workspace tools not in this list are hidden via `prepareStep`.
   * Non-workspace tools are never affected. When omitted, all workspace
   * tools are visible.
   */
  allowedWorkspaceTools?: string[];

  /**
   * Default "forked" mode for this subagent type. When `true`, invocations
   * inherit the parent agent's conversation context: the parent thread is
   * cloned and the subagent runs on the fork with the parent agent's
   * instructions and tools, preserving prompt-cache prefix.
   *
   * The parent's `instructions`, `tools`, `allowedControllerTools`,
   * `allowedWorkspaceTools`, and `defaultModelId` fields on the definition
   * are ignored when a run is forked — the parent agent is used as-is.
   *
   * Callers can override per-invocation by passing `forked` in the tool
   * input. Forked subagents require memory to be configured on the AgentController.
   *
   * @default false
   */
  forked?: boolean;
}

/**
 * State data type for the AgentController generic parameter.
 */
export type AgentControllerStateSchema<T> = T;

/**
 * Configuration for creating a AgentController instance.
 */
/**
 * Identifiers for the built-in controller tools that can be selectively disabled.
 */
export type BuiltinToolId =
  'ask_user' | 'submit_plan' | 'task_write' | 'task_update' | 'task_complete' | 'task_check' | 'subagent';

export interface AgentControllerConfig<TState = {}> {
  /** Unique identifier for this controller instance */
  id: string;

  /**
   * Resource ID for grouping threads (e.g., project identifier).
   * Threads are scoped to this resource ID.
   */
  resourceId?: string;

  /** Storage backend for persistence (threads, messages, state) */
  storage?: MastraCompositeStore;

  /** Schema defining the shape of controller state (Zod, JSON Schema, Standard Schema, etc.) */
  stateSchema?: PublicSchema<TState, any>;

  /** Initial state values (must conform to schema) */
  initialState?: Partial<TState>;

  /** Memory configuration (shared across all modes) */
  memory?: DynamicArgument<MastraMemory>;

  /** Available agent modes */
  modes: AgentControllerMode[];

  /** Shared backing agent that each mode forks and decorates on the controller. */
  agent?: Agent<any, any, any, any>;

  /** Default mode to enter when a thread has no persisted mode. */
  defaultModeId?: string;

  instructions?: string;

  /**
   * Tools available to all agents across all modes.
   * Can be a static tools object or a dynamic function that receives
   * the request context and returns tools per-request.
   */
  tools?: DynamicArgument<ToolsInput | undefined>;

  /**
   * Workspace configuration.
   * Accepts a pre-constructed Workspace instance or a dynamic factory
   * function that receives the request context and returns a Workspace
   * per-request.
   */
  workspace?: DynamicArgument<Workspace | undefined>;

  /**
   * Browser automation configuration.
   * Accepts a pre-constructed MastraBrowser instance or a dynamic factory
   * function that receives the request context and returns a browser per-request.
   * Propagated to mode agents that don't have their own browser configured.
   */
  browser?: DynamicArgument<MastraBrowser | undefined>;

  /**
   * Periodic interval handlers started during `init()`.
   * Use for background tasks like gateway sync, cache refresh, etc.
   */
  intervalHandlers?: IntervalHandler[];

  /**
   * Custom ID generator for AgentController-managed IDs such as threads and mode-run identifiers.
   * Defaults to a timestamp + random string generator.
   */
  idGenerator?: () => string;

  /**
   * Provides per-model use counts for `listAvailableModels()` sorting/display.
   * Lets the app layer track and report how often each model has been used.
   */
  modelUseCountProvider?: ModelUseCountProvider;

  /**
   * Callback invoked when a model is selected via switchModel().
   * Lets the app layer track and persist model usage for ranking.
   */
  modelUseCountTracker?: ModelUseCountTracker;

  /**
   * Subagent definitions. The AgentController auto-creates a `subagent` built-in tool
   * that parent agents can call to spawn focused subagents.
   */
  subagents?: AgentControllerSubagent[];

  /**
   * Model gateways registered on AgentController' internal Mastra instance.
   * The AgentController resolves every model — mode agents, Observational Memory,
   * subagents — and builds the `listAvailableModels()` catalog through these
   * gateways. Provider auth (API keys, OAuth, stored credentials) is resolved
   * via each gateway's `resolveAuth()` / env-var configuration.
   */
  gateways?: MastraModelGatewayInterface[];

  /**
   * Observational Memory configuration defaults.
   * The AgentController auto-manages OM state (model IDs, thresholds) internally
   * and provides accessors that Memory's dynamic model functions can close over.
   */
  omConfig?: AgentControllerOMConfig;

  /**
   * Built-in tool IDs to disable.
   * Any tool listed here will be excluded from the `controllerBuiltIn` toolset.
   * Valid values: 'ask_user', 'submit_plan', 'task_write', 'task_update',
   * 'task_complete', 'task_check', 'subagent'.
   */
  disableBuiltinTools?: BuiltinToolId[];

  /**
   * Maps tool names to permission categories.
   * Used by the permission system to resolve category-level policies.
   * If not provided, all tools default to the "other" category.
   */
  toolCategoryResolver?: (toolName: string) => ToolCategory | null;

  /**
   * PubSub instance used by the internal Mastra instance and mode agents.
   */
  pubsub?: PubSub;

  /**
   * Optional thread locking callbacks.
   * Called during selectOrCreateThread, createThread, and switchThread
   * to prevent concurrent access to the same thread from multiple processes.
   * `acquire` should throw if the lock is held by another process.
   */
  threadLock?: {
    acquire: (threadId: string) => void | Promise<void>;
    release: (threadId: string) => void | Promise<void>;
  };

  /**
   * Observability entrypoint for tracing, scoring, and feedback.
   * When provided, the internal Mastra instance is configured with this
   * observability backend so that agent runs produce trace spans.
   */
  observability?: ObservabilityEntrypoint;
}

/**
 * Default configuration for Observational Memory.
 * These values are used when controller state doesn't have explicit OM values
 * (e.g., fresh thread with no persisted OM settings).
 */
export interface AgentControllerOMConfig {
  /** Default model ID for the observer agent */
  defaultObserverModelId?: string;
  /** Default model ID for the reflector agent */
  defaultReflectorModelId?: string;
  /** Default observation threshold in tokens */
  defaultObservationThreshold?: number;
  /** Default reflection threshold in tokens */
  defaultReflectionThreshold?: number;
}

// =============================================================================
// Permissions
// =============================================================================

/**
 * Tool category for permission grouping.
 * Consumers define how tool names map to categories via `toolCategoryResolver`.
 */
export type ToolCategory = 'read' | 'edit' | 'execute' | 'mcp' | 'other';

/**
 * Permission policy for a tool or category.
 */
export type PermissionPolicy = 'allow' | 'ask' | 'deny';

/**
 * Permission rules for controlling tool approval behavior.
 * Per-tool overrides take precedence over category policies.
 */
export interface PermissionRules {
  categories: Partial<Record<ToolCategory, PermissionPolicy>>;
  tools: Partial<Record<string, PermissionPolicy>>;
}

// =============================================================================
// Model Discovery
// =============================================================================

/**
 * Auth status for a model's provider.
 */
export interface ModelAuthStatus {
  hasAuth: boolean;
  apiKeyEnvVar?: string;
}

/**
 * Info about an available model from the provider registry.
 */
export interface AvailableModel {
  /** Full model ID (e.g., "anthropic/claude-sonnet-4-20250514") */
  id: string;
  /** Provider prefix (e.g., "anthropic") */
  provider: string;
  /** Model name without provider prefix */
  modelName: string;
  /** Whether the provider has valid authentication */
  hasApiKey: boolean;
  /** Environment variable for the provider's API key */
  apiKeyEnvVar?: string;
  /** Number of times this model has been used (from external tracking) */
  useCount: number;
}

/**
 * Same as {@link AvailableModel} but without the runtime `useCount` field.
 * Used by providers that supply catalog entries before use-count tracking.
 */
export type CustomAvailableModel = Omit<AvailableModel, 'useCount'>;

/**
 * Function that returns a list of custom available models (without use counts).
 */
export type CustomModelCatalogProvider = () => Promise<CustomAvailableModel[]>;

/**
 * Provides per-model use counts for sorting in `listAvailableModels()`.
 * Return a map of model ID → use count.
 */
export type ModelUseCountProvider = () => Record<string, number>;

/**
 * Callback invoked when a model is selected via switchModel().
 * Lets the app layer track and persist model usage for ranking.
 */
export type ModelUseCountTracker = (modelId: string) => void;

// =============================================================================
// AgentController State
// =============================================================================

/**
 * Thread metadata stored in the controller.
 */
export interface AgentControllerThread {
  id: string;
  resourceId: string;
  title?: string;
  createdAt: Date;
  updatedAt: Date;
  tokenUsage?: TokenUsage;
  metadata?: Record<string, unknown>;
}

// =============================================================================
// Events
// =============================================================================

/**
 * Token usage statistics from the model.
 */
export interface TokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  reasoningTokens?: number;
  cachedInputTokens?: number;
  cacheCreationInputTokens?: number;
  raw?: unknown;
}

/** Creates a zero-initialized TokenUsage object. */
export function createEmptyTokenUsage(): TokenUsage {
  return {
    promptTokens: 0,
    completionTokens: 0,
    totalTokens: 0,
    cachedInputTokens: 0,
    cacheCreationInputTokens: 0,
  };
}

// =============================================================================
// Observational Memory Progress
// =============================================================================

/**
 * Status of the Observational Memory system.
 */
export type OMStatus = 'idle' | 'observing' | 'reflecting';

/**
 * Status of a buffered OM operation (observation or reflection).
 */
export type OMBufferedStatus = 'idle' | 'running' | 'complete';

/**
 * Full progress state for Observational Memory.
 * Maintained by the AgentController and exposed via `AgentControllerDisplayState`.
 */
export interface OMProgressState {
  status: OMStatus;
  // Active window tokens/thresholds (from om_status events)
  pendingTokens: number;
  threshold: number;
  thresholdPercent: number;
  observationTokens: number;
  reflectionThreshold: number;
  reflectionThresholdPercent: number;
  // Buffered state (from om_status events)
  buffered: {
    observations: {
      status: OMBufferedStatus;
      chunks: number;
      messageTokens: number;
      projectedMessageRemoval: number;
      observationTokens: number;
    };
    reflection: {
      status: OMBufferedStatus;
      inputObservationTokens: number;
      observationTokens: number;
    };
  };
  generationCount: number;
  stepNumber: number;
  cycleId?: string;
  startTime?: number;
  /** Observation tokens before reflection compression (set on om_reflection_start) */
  preReflectionTokens: number;
}

// =============================================================================
// Display State
// =============================================================================

/**
 * State of an active tool execution, tracked by the AgentController for UI consumption.
 */
export interface ActiveToolState {
  name: string;
  args: unknown;
  status: 'streaming_input' | 'running' | 'completed' | 'error';
  partialResult?: string;
  result?: unknown;
  isError?: boolean;
  shellOutput?: string;
}

/**
 * State of an active subagent execution, tracked by the AgentController for UI consumption.
 */
export interface ActiveSubagentState {
  agentType: string;
  displayName?: string;
  task: string;
  modelId?: string;
  forked?: boolean;
  toolCalls: Array<{ name: string; isError: boolean }>;
  textDelta: string;
  status: 'running' | 'completed' | 'error';
  durationMs?: number;
  result?: string;
}

export type AgentControllerSubagentHistoryEntry = Omit<ActiveSubagentState, 'status'>;

/**
 * Canonical display state maintained by the AgentController.
 *
 * This is the single source of truth for *what to display*.
 * Any UI (TUI, web, desktop) can subscribe to snapshots of this state
 * instead of interpreting 35+ raw event types.
 *
 * The AgentController updates this state alongside every event emission,
 * then emits a `display_state_changed` event so UIs can react.
 */
export interface AgentControllerDisplayState {
  // ── Agent lifecycle ──────────────────────────────────────────────────
  /** Whether an agent operation is currently in progress */
  isRunning: boolean;

  // ── Current streaming message ────────────────────────────────────────
  /** The message currently being streamed (null when idle) */
  currentMessage: MastraDBMessage | null;

  // ── Follow-up queue ──────────────────────────────────────────────────
  /** Number of follow-up messages queued locally by the AgentController */
  queuedFollowUps: number;

  // ── Token usage ──────────────────────────────────────────────────────
  /** Cumulative token usage for the current thread */
  tokenUsage: TokenUsage;

  // ── Tool execution tracking ──────────────────────────────────────────
  /** Active tool executions keyed by toolCallId */
  activeTools: Map<string, ActiveToolState>;

  // ── Streaming tool input ─────────────────────────────────────────────
  /** Partial JSON buffers for tools whose arguments are being streamed */
  toolInputBuffers: Map<string, { text: string; toolName: string }>;

  // ── Tool approval ────────────────────────────────────────────────────
  /** A tool awaiting user approval (null when no approval pending) */
  pendingApproval: {
    toolCallId: string;
    toolName: string;
    args: unknown;
  } | null;

  // ── Tool suspension ─────────────────────────────────────────────────
  /**
   * Tools awaiting resume data after calling suspend(), keyed by toolCallId.
   * Multiple tools can be parked at once (e.g. parallel `ask_user` prompts), so
   * resuming one leaves the others intact for the UI to keep rendering.
   */
  pendingSuspensions: Map<
    string,
    {
      toolCallId: string;
      toolName: string;
      args: unknown;
      suspendPayload: unknown;
      resumeSchema?: string;
    }
  >;

  // ── Subagent tracking ────────────────────────────────────────────────
  /** Active subagent executions keyed by parent toolCallId */
  activeSubagents: Map<string, ActiveSubagentState>;

  // ── Observational Memory ─────────────────────────────────────────────
  /** Full OM progress state (status, tokens, thresholds, buffered) */
  omProgress: OMProgressState;

  /** Whether message buffering is currently running */
  bufferingMessages: boolean;

  /** Whether observation buffering is currently running */
  bufferingObservations: boolean;

  // ── File modifications ───────────────────────────────────────────────
  /** Files modified by tool executions (for /diff and similar features) */
  modifiedFiles: Map<string, { operations: string[]; firstModified: Date }>;

  // ── Tasks ────────────────────────────────────────────────────────────
  /** Current task list (from task tools) */
  tasks: TaskItemSnapshot[];

  /** Previous task list snapshot (for diff detection) */
  previousTasks: TaskItemSnapshot[];
}

/**
 * Creates the default/initial `AgentControllerDisplayState`.
 */
export function defaultDisplayState(): AgentControllerDisplayState {
  return {
    isRunning: false,
    currentMessage: null,
    queuedFollowUps: 0,
    tokenUsage: createEmptyTokenUsage(),
    activeTools: new Map(),
    toolInputBuffers: new Map(),
    pendingApproval: null,
    pendingSuspensions: new Map(),
    activeSubagents: new Map(),
    omProgress: defaultOMProgressState(),
    bufferingMessages: false,
    bufferingObservations: false,
    modifiedFiles: new Map(),
    tasks: [],
    previousTasks: [],
  };
}

/**
 * Creates the default OM progress state.
 */
export function defaultOMProgressState(): OMProgressState {
  return {
    status: 'idle',
    pendingTokens: 0,
    threshold: 30000,
    thresholdPercent: 0,
    observationTokens: 0,
    reflectionThreshold: 40000,
    reflectionThresholdPercent: 0,
    buffered: {
      observations: {
        status: 'idle',
        chunks: 0,
        messageTokens: 0,
        projectedMessageRemoval: 0,
        observationTokens: 0,
      },
      reflection: {
        status: 'idle',
        inputObservationTokens: 0,
        observationTokens: 0,
      },
    },
    generationCount: 0,
    stepNumber: 0,
    preReflectionTokens: 0,
  };
}

// =============================================================================
// Events
// =============================================================================

/**
 * Events emitted by the controller that UIs can subscribe to.
 */
export type AgentControllerEvent =
  | { type: 'mode_changed'; modeId: string; previousModeId: string }
  | { type: 'model_changed'; modelId: string; scope?: 'global' | 'thread' | 'mode'; modeId?: string }
  | { type: 'thread_changed'; threadId: string; previousThreadId: string | null }
  | { type: 'thread_created'; thread: AgentControllerThread }
  | { type: 'thread_deleted'; threadId: string }
  | { type: 'state_changed'; state: Record<string, unknown>; changedKeys: string[] }
  | { type: 'agent_start' }
  | { type: 'agent_end'; reason?: 'complete' | 'aborted' | 'error' | 'suspended' }
  | { type: 'message_start'; message: MastraDBMessage }
  | { type: 'message_update'; message: MastraDBMessage }
  | { type: 'message_end'; message: MastraDBMessage }
  | { type: 'tool_start'; toolCallId: string; toolName: string; args: unknown }
  | { type: 'tool_approval_required'; toolCallId: string; toolName: string; args: unknown }
  | {
      type: 'tool_suspended';
      toolCallId: string;
      toolName: string;
      args: unknown;
      suspendPayload: unknown;
      resumeSchema?: string;
    }
  | { type: 'tool_suspension_cancelled'; toolCallId: string; toolName: string; reason: string }
  | { type: 'tool_update'; toolCallId: string; partialResult: unknown }
  | {
      type: 'tool_end';
      toolCallId: string;
      result: unknown;
      isError: boolean;
      providerMetadata?: Record<string, unknown>;
    }
  | { type: 'tool_input_start'; toolCallId: string; toolName: string }
  | { type: 'tool_input_delta'; toolCallId: string; argsTextDelta: unknown; toolName?: string }
  | { type: 'tool_input_end'; toolCallId: string }
  | { type: 'shell_output'; toolCallId: string; output: string; stream: 'stdout' | 'stderr' }
  | { type: 'usage_update'; usage: TokenUsage }
  | { type: 'info'; message: string }
  | { type: 'error'; error: Error; errorType?: string; retryable?: boolean; retryDelay?: number }
  | { type: 'follow_up_queued'; count: number; runId?: string }
  | { type: 'workspace_status_changed'; status: WorkspaceStatus; error?: Error }
  | { type: 'workspace_ready'; workspaceId: string; workspaceName: string }
  | { type: 'workspace_error'; error: Error }
  | {
      type: 'om_status';
      windows: {
        active: {
          messages: { tokens: number; threshold: number };
          observations: { tokens: number; threshold: number };
        };
        buffered: {
          observations: {
            status: 'idle' | 'running' | 'complete';
            chunks: number;
            messageTokens: number;
            projectedMessageRemoval: number;
            observationTokens: number;
          };
          reflection: {
            status: 'idle' | 'running' | 'complete';
            inputObservationTokens: number;
            observationTokens: number;
          };
        };
      };
      recordId: string;
      threadId: string;
      stepNumber: number;
      generationCount: number;
    }
  | {
      type: 'om_observation_start';
      cycleId: string;
      operationType: 'observation' | 'reflection';
      tokensToObserve: number;
    }
  | {
      type: 'om_observation_end';
      cycleId: string;
      durationMs: number;
      tokensObserved: number;
      observationTokens: number;
      observations?: string;
      currentTask?: string;
      suggestedResponse?: string;
    }
  | { type: 'om_observation_failed'; cycleId: string; error: string; durationMs: number }
  | { type: 'om_reflection_start'; cycleId: string; tokensToReflect: number }
  | {
      type: 'om_reflection_end';
      cycleId: string;
      durationMs: number;
      compressedTokens: number;
      observations?: string;
    }
  | { type: 'om_reflection_failed'; cycleId: string; error: string; durationMs: number }
  | { type: 'om_model_changed'; role: 'observer' | 'reflector'; modelId: string }
  | {
      type: 'om_buffering_start';
      cycleId: string;
      operationType: 'observation' | 'reflection';
      tokensToBuffer: number;
    }
  | {
      type: 'om_buffering_end';
      cycleId: string;
      operationType: 'observation' | 'reflection';
      tokensBuffered: number;
      bufferedTokens: number;
      observations?: string;
    }
  | {
      type: 'om_buffering_failed';
      cycleId: string;
      operationType: 'observation' | 'reflection';
      error: string;
    }
  | {
      type: 'om_activation';
      cycleId: string;
      operationType: 'observation' | 'reflection';
      chunksActivated: number;
      tokensActivated: number;
      observationTokens: number;
      messagesActivated: number;
      generationCount: number;
      triggeredBy?: 'threshold' | 'ttl' | 'provider_change';
      lastActivityAt?: number;
      ttlExpiredMs?: number;
      activateAfterIdle?: number;
      previousModel?: string;
      currentModel?: string;
    }
  | { type: 'om_thread_title_updated'; cycleId: string; threadId: string; oldTitle?: string; newTitle: string }
  | { type: 'subagent_start'; toolCallId: string; agentType: string; task: string; modelId: string; forked?: boolean }
  | { type: 'subagent_text_delta'; toolCallId: string; agentType: string; textDelta: string }
  | {
      type: 'subagent_tool_start';
      toolCallId: string;
      agentType: string;
      subToolName: string;
      subToolArgs: unknown;
    }
  | {
      type: 'subagent_tool_end';
      toolCallId: string;
      agentType: string;
      subToolName: string;
      subToolResult: unknown;
      isError: boolean;
    }
  | {
      type: 'subagent_end';
      toolCallId: string;
      agentType: string;
      result: string;
      isError: boolean;
      durationMs: number;
    }
  | { type: 'subagent_model_changed'; modelId: string; scope: 'global' | 'thread'; agentType?: string }
  | {
      type: 'task_updated';
      tasks: TaskItemSnapshot[];
    }
  | {
      type: 'goal_evaluation';
      payload: GoalEvaluationPayload;
    }
  | { type: 'display_state_changed'; displayState: AgentControllerDisplayState };

/**
 * Listener function for controller events.
 */
export type AgentControllerEventListener = (event: AgentControllerEvent) => void | Promise<void>;

// =============================================================================
// Request Context
// =============================================================================

/**
 * Controller-specific context set on the RequestContext under the 'controller' key.
 * Tools can access controller state and methods through requestContext.get('controller').
 */
/**
 * Snapshot of the session-owned values exposed to request-context consumers.
 * Plain data captured per request; mutating it does not affect the Session.
 */
export type AgentControllerRequestStateUpdateResult<TState, TResult> = {
  updates?: Partial<TState>;
  events?: AgentControllerEvent[];
  result: TResult;
};

export type AgentControllerRequestStateUpdater<TState, TResult> = (
  state: Readonly<TState>,
) =>
  | AgentControllerRequestStateUpdateResult<TState, TResult>
  | Promise<AgentControllerRequestStateUpdateResult<TState, TResult>>;

export interface AgentControllerRequestState<TState = unknown> {
  /** Get the current session-owned controller state (live, not request-context snapshot). */
  get: () => Readonly<TState>;
  /** Update session-owned controller state. */
  set: (updates: Partial<TState>) => Promise<void>;
  /** Update session-owned controller state from the latest snapshot in a serialized transaction. */
  update: <TResult>(updater: AgentControllerRequestStateUpdater<TState, TResult>) => Promise<TResult>;
}

export interface AgentControllerRequestSession<TState = unknown> {
  /** Stable session identifier (mirrors SessionRecord.id in storage). */
  id: string;
  /** Stable session owner (mirrors SessionRecord.ownerId in storage). */
  ownerId: string;
  /** Currently-selected mode ID */
  modeId: string;
  /** Currently-selected model ID ('' when none selected yet) */
  modelId: string;
  /**
   * Live session-owned controller state accessors.
   * @deprecated Prefer the top-level `getState()` / `setState()` / `updateState()`
   * on the {@link AgentControllerRequestContext} instead.
   */
  state: AgentControllerRequestState<TState>;
}

export interface AgentControllerRequestContext<TState = unknown> {
  /** The agent controller instance ID */
  controllerId: string;

  /**
   * The agent controller instance ID.
   * @deprecated Renamed to `controllerId`. Kept for backwards compatibility.
   */
  harnessId?: string;

  /**
   * Current controller state (read-only snapshot captured when the request context is built).
   * @deprecated Prefer `getState()` for live state reads.
   */
  state: Readonly<TState>;

  /** Get the current controller state (live, not snapshot). */
  getState: () => Readonly<TState>;

  /** Update controller state. */
  setState: (updates: Partial<TState>) => Promise<void>;

  /** Update controller state from the latest state snapshot in a serialized transaction. */
  updateState?: <TResult>(updater: AgentControllerRequestStateUpdater<TState, TResult>) => Promise<TResult>;

  /** Current thread ID */
  threadId: string | null;

  /** Current resource ID */
  resourceId: string;

  /** Optional isolation scope used to identify this session within its resource. */
  scope?: string;

  /**
   * Snapshot of the relevant session-owned values for this request.
   * Plain data (not the live Session); read-only at the point of use.
   */
  session: AgentControllerRequestSession<TState>;

  /** Abort signal for the current operation */
  abortSignal?: AbortSignal;

  /** Workspace instance (if configured on the AgentController) */
  workspace?: Workspace;

  /** Emit a controller event (used by tools to forward events) */
  emitEvent?: (event: AgentControllerEvent) => void;

  /** Get the configured subagent model ID for a specific agent type */
  getSubagentModelId?: (params?: { agentType?: string }) => string | null;
}
