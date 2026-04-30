import type { Agent } from '../agent';
import type { AgentInstructions, ToolsInput } from '../agent/types';
import type { MastraBrowser } from '../browser/browser';
import type { MastraLanguageModel } from '../llm/model/shared.types';
import type { LoopOptions } from '../loop/types';
import type { MastraMemory } from '../memory/memory';
import type { ObservabilityEntrypoint } from '../observability/types/core';
import type { PublicSchema } from '../schema';
import type { MastraCompositeStore } from '../storage/base';
import type { DynamicArgument } from '../types';
import type { Workspace, WorkspaceConfig, WorkspaceStatus } from '../workspace';

// =============================================================================
// Heartbeat Handlers
// =============================================================================

/**
 * A periodic task that the Harness runs on a timer.
 * Heartbeat handlers start during `init()` and are cleaned up on `stopHeartbeats()`.
 */
export interface HeartbeatHandler {
  /** Unique identifier for this handler (used for dedup and logging) */
  id: string;
  /** Interval in milliseconds between invocations */
  intervalMs: number;
  /** The function to run on each tick */
  handler: () => void | Promise<void>;
  /** Whether to run the handler immediately on start (default: true) */
  immediate?: boolean;
  /** Called when the handler is removed or all heartbeats are stopped */
  shutdown?: () => void | Promise<void>;
}

// =============================================================================
// Harness Configuration
// ===================

/**
 * Configuration for a single agent mode within the harness.
 * Each mode represents a different "personality" or capability set.
 */
export interface HarnessMode<TState> {
  /** Unique identifier for this mode (e.g., "plan", "build", "review") */
  id: string;

  /** Human-readable name for display */
  name?: string;

  /** Whether this is the default mode when harness starts */
  default?: boolean;

  /**
   * Default model ID for this mode (e.g., "anthropic/claude-sonnet-4-20250514").
   * Used when no per-mode model has been explicitly selected.
   */
  defaultModelId?: string;

  /** Hex color for the mode indicator (e.g., "#7c3aed") */
  color?: string;

  /**
   * The agent for this mode.
   * Can be a static Agent or a function that receives harness state.
   */
  agent: Agent | ((state: TState) => Agent);
}

// =============================================================================
// Subagents
// =============================================================================

/**
 * Definition of a subagent that the Harness can spawn via the built-in `subagent` tool.
 * Each subagent runs as a fresh Agent with constrained tools and its own instructions.
 */
export interface HarnessSubagent {
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
   * Tool IDs to pull from the harness's shared `tools` config.
   * Merged with `tools` above — allows subagents to use a subset of harness tools.
   */
  allowedHarnessTools?: string[];

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
   * The parent's `instructions`, `tools`, `allowedHarnessTools`,
   * `allowedWorkspaceTools`, and `defaultModelId` fields on the definition
   * are ignored when a run is forked — the parent agent is used as-is.
   *
   * Callers can override per-invocation by passing `forked` in the tool
   * input. Forked subagents require memory to be configured on the Harness.
   *
   * @default false
   */
  forked?: boolean;
}

/**
 * State data type for the Harness generic parameter.
 */
export type HarnessStateSchema<T> = T;

/**
 * Configuration for creating a Harness instance.
 */
/**
 * Identifiers for the built-in harness tools that can be selectively disabled.
 */
export type BuiltinToolId = 'ask_user' | 'submit_plan' | 'task_write' | 'task_check' | 'subagent';

export interface HarnessConfig<TState = {}> {
  /** Unique identifier for this harness instance */
  id: string;

  /**
   * Resource ID for grouping threads (e.g., project identifier).
   * Threads are scoped to this resource ID.
   */
  resourceId?: string;

  /** Storage backend for persistence (threads, messages, state) */
  storage?: MastraCompositeStore;

  /** Schema defining the shape of harness state (Zod, JSON Schema, Standard Schema, etc.) */
  stateSchema?: PublicSchema<TState, any>;

  /** Initial state values (must conform to schema) */
  initialState?: Partial<TState>;

  /** Memory configuration (shared across all modes) */
  memory?: DynamicArgument<MastraMemory>;

  /** Available agent modes */
  modes: HarnessMode<TState>[];

  /**
   * Tools available to all agents across all modes.
   * Can be a static tools object or a dynamic function that receives
   * the request context and returns tools per-request.
   */
  tools?: DynamicArgument<ToolsInput | undefined>;

  /**
   * Workspace configuration.
   * Accepts a pre-constructed Workspace instance, a WorkspaceConfig for
   * Harness to construct internally, or a dynamic factory function that
   * receives the request context and returns a Workspace per-request.
   */
  workspace?: DynamicArgument<Workspace | undefined> | WorkspaceConfig;

  /**
   * Browser automation configuration.
   * Accepts a pre-constructed MastraBrowser instance or a dynamic factory
   * function that receives the request context and returns a browser per-request.
   * Propagated to mode agents that don't have their own browser configured.
   */
  browser?: DynamicArgument<MastraBrowser | undefined>;

  /**
   * Periodic heartbeat handlers started during `init()`.
   * Use for background tasks like gateway sync, cache refresh, etc.
   */
  heartbeatHandlers?: HeartbeatHandler[];

  /**
   * Custom ID generator for Harness-managed IDs such as threads and mode-run identifiers.
   * Defaults to a timestamp + random string generator.
   */
  idGenerator?: () => string;

  /**
   * Custom auth checker for model providers.
   * Lets the app layer provide additional auth sources (e.g., OAuth tokens)
   * beyond the default env var check from the provider registry.
   */
  modelAuthChecker?: ModelAuthChecker;

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
   * Optional catalog hook for additional models (e.g., user-defined custom providers).
   * Returned entries are merged into `listAvailableModels()`.
   */
  customModelCatalogProvider?: CustomModelCatalogProvider;

  /**
   * Subagent definitions. The Harness auto-creates a `subagent` built-in tool
   * that parent agents can call to spawn focused subagents.
   */
  subagents?: HarnessSubagent[];

  /**
   * Converts a model ID string (e.g., "anthropic/claude-sonnet-4-20250514") to a
   * language model instance. Used by subagents and OM model resolution.
   */
  resolveModel?: (modelId: string) => MastraLanguageModel;

  /**
   * Observational Memory configuration defaults.
   * The Harness auto-manages OM state (model IDs, thresholds) internally
   * and provides accessors that Memory's dynamic model functions can close over.
   */
  omConfig?: HarnessOMConfig;

  /**
   * Built-in tool IDs to disable.
   * Any tool listed here will be excluded from the `harnessBuiltIn` toolset.
   * Valid values: 'ask_user', 'submit_plan', 'task_write', 'task_check', 'subagent'.
   */
  disableBuiltinTools?: BuiltinToolId[];

  /**
   * Maps tool names to permission categories.
   * Used by the permission system to resolve category-level policies.
   * If not provided, all tools default to the "other" category.
   */
  toolCategoryResolver?: (toolName: string) => ToolCategory | null;

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
 * These values are used when harness state doesn't have explicit OM values
 * (e.g., fresh thread with no persisted OM settings).
 */
export interface HarnessOMConfig {
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
 * Additional model entries supplied by the app layer.
 */
export type CustomAvailableModel = Omit<AvailableModel, 'useCount'>;

/**
 * Provides additional model catalog entries for `listAvailableModels()`.
 */
export type CustomModelCatalogProvider = () => CustomAvailableModel[] | Promise<CustomAvailableModel[]>;

/**
 * Custom auth checker for model providers.
 * Called by `getCurrentModelAuthStatus()` and `listAvailableModels()` to determine
 * whether a provider has valid authentication beyond just env var checks
 * (e.g., OAuth tokens, stored credentials).
 *
 * Return `true` if the provider is authenticated, `false` if not,
 * or `undefined` to fall back to the default env var check.
 */
export type ModelAuthChecker = (provider: string) => boolean | undefined;

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
// Harness State
// =============================================================================

/**
 * Thread metadata stored in the harness.
 */
export interface HarnessThread {
  id: string;
  resourceId: string;
  title?: string;
  createdAt: Date;
  updatedAt: Date;
  tokenUsage?: TokenUsage;
  metadata?: Record<string, unknown>;
}

/**
 * Session info for the current harness instance.
 */
export interface HarnessSession {
  currentThreadId: string | null;
  currentModeId: string;
  threads: HarnessThread[];
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
 * Maintained by the Harness and exposed via `HarnessDisplayState`.
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
 * State of an active tool execution, tracked by the Harness for UI consumption.
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
 * State of an active subagent execution, tracked by the Harness for UI consumption.
 */
export interface ActiveSubagentState {
  agentType: string;
  task: string;
  modelId?: string;
  forked?: boolean;
  toolCalls: Array<{ name: string; isError: boolean }>;
  textDelta: string;
  status: 'running' | 'completed' | 'error';
  durationMs?: number;
  result?: string;
}

/**
 * Controls whether an `ask_user` prompt accepts one choice or multiple choices.
 *
 * `single_select` is the default for prompts that provide options, preserving the
 * original one-answer behavior. `multi_select` tells the UI that the user may choose
 * more than one option and return those selections as an array.
 */
export type HarnessQuestionSelectionMode = 'single_select' | 'multi_select';

/**
 * A structured choice rendered by the UI for an `ask_user` prompt.
 *
 * The label is the value returned to the model when the option is selected. The
 * optional description gives the UI more context without changing the answer value.
 */
export interface HarnessQuestionOption {
  label: string;
  description?: string;
}

/**
 * Answer shape accepted by `respondToQuestion()` for pending `ask_user` prompts.
 *
 * Free-text and single-select prompts resolve with a string. Multi-select prompts
 * resolve with a string array containing each selected option label.
 */
export type HarnessQuestionAnswer = string | string[];

/**
 * Canonical display state maintained by the Harness.
 *
 * This is the single source of truth for *what to display*.
 * Any UI (TUI, web, desktop) can subscribe to snapshots of this state
 * instead of interpreting 35+ raw event types.
 *
 * The Harness updates this state alongside every event emission,
 * then emits a `display_state_changed` event so UIs can react.
 */
export interface HarnessDisplayState {
  // ── Agent lifecycle ──────────────────────────────────────────────────
  /** Whether an agent operation is currently in progress */
  isRunning: boolean;

  // ── Current streaming message ────────────────────────────────────────
  /** The message currently being streamed (null when idle) */
  currentMessage: HarnessMessage | null;

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
  /** A tool awaiting resume data after calling suspend() (null when none) */
  pendingSuspension: {
    toolCallId: string;
    toolName: string;
    args: unknown;
    suspendPayload: unknown;
    resumeSchema?: string;
  } | null;

  // ── Interactive prompts ──────────────────────────────────────────────
  /** A question from the agent awaiting user answer (null when none) */
  pendingQuestion: {
    questionId: string;
    question: string;
    options?: HarnessQuestionOption[];
    selectionMode?: HarnessQuestionSelectionMode;
  } | null;

  /** A plan awaiting user approval (null when none) */
  pendingPlanApproval: {
    planId: string;
    title?: string;
    plan: string;
  } | null;

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
  /** Current task list (from task_write tool) */
  tasks: Array<{
    content: string;
    status: 'pending' | 'in_progress' | 'completed';
    activeForm: string;
  }>;

  /** Previous task list snapshot (for diff detection) */
  previousTasks: Array<{
    content: string;
    status: 'pending' | 'in_progress' | 'completed';
    activeForm: string;
  }>;
}

/**
 * Creates the default/initial `HarnessDisplayState`.
 */
export function defaultDisplayState(): HarnessDisplayState {
  return {
    isRunning: false,
    currentMessage: null,
    tokenUsage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
    activeTools: new Map(),
    toolInputBuffers: new Map(),
    pendingApproval: null,
    pendingSuspension: null,
    pendingQuestion: null,
    pendingPlanApproval: null,
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
 * Events emitted by the harness that UIs can subscribe to.
 */
export type HarnessEvent =
  | { type: 'mode_changed'; modeId: string; previousModeId: string }
  | { type: 'model_changed'; modelId: string; scope?: 'global' | 'thread' | 'mode'; modeId?: string }
  | { type: 'thread_changed'; threadId: string; previousThreadId: string | null }
  | { type: 'thread_created'; thread: HarnessThread }
  | { type: 'thread_deleted'; threadId: string }
  | { type: 'state_changed'; state: Record<string, unknown>; changedKeys: string[] }
  | { type: 'agent_start' }
  | { type: 'agent_end'; reason?: 'complete' | 'aborted' | 'error' | 'suspended' }
  | { type: 'message_start'; message: HarnessMessage }
  | { type: 'message_update'; message: HarnessMessage }
  | { type: 'message_end'; message: HarnessMessage }
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
  | { type: 'tool_update'; toolCallId: string; partialResult: unknown }
  | { type: 'tool_end'; toolCallId: string; result: unknown; isError: boolean }
  | { type: 'tool_input_start'; toolCallId: string; toolName: string }
  | { type: 'tool_input_delta'; toolCallId: string; argsTextDelta: string; toolName?: string }
  | { type: 'tool_input_end'; toolCallId: string }
  | { type: 'shell_output'; toolCallId: string; output: string; stream: 'stdout' | 'stderr' }
  | { type: 'usage_update'; usage: TokenUsage }
  | { type: 'info'; message: string }
  | { type: 'error'; error: Error; errorType?: string; retryable?: boolean; retryDelay?: number }
  | { type: 'follow_up_queued'; count: number }
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
  | { type: 'sandbox_access_request'; questionId: string; path: string; reason: string }
  | {
      type: 'ask_question';
      questionId: string;
      question: string;
      options?: HarnessQuestionOption[];
      selectionMode?: HarnessQuestionSelectionMode;
    }
  | {
      type: 'plan_approval_required';
      planId: string;
      title: string;
      plan: string;
    }
  | { type: 'plan_approved' }
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
      tasks: Array<{
        content: string;
        status: 'pending' | 'in_progress' | 'completed';
        activeForm: string;
      }>;
    }
  | { type: 'display_state_changed'; displayState: HarnessDisplayState };

/**
 * Listener function for harness events.
 */
export type HarnessEventListener = (event: HarnessEvent) => void | Promise<void>;

// =============================================================================
// Messages
// =============================================================================

/**
 * Simplified message type for UI consumption.
 * Maps from Mastra's internal message format.
 */
export interface HarnessMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: HarnessMessageContent[];
  createdAt: Date;
  stopReason?: 'complete' | 'tool_use' | 'aborted' | 'error';
  errorMessage?: string;
}

export type HarnessMessageContent =
  | { type: 'text'; text: string }
  | { type: 'thinking'; thinking: string }
  | { type: 'tool_call'; id: string; name: string; args: unknown }
  | { type: 'tool_result'; id: string; name: string; result: unknown; isError: boolean }
  | {
      type: 'system_reminder';
      message: string;
      reminderType?: string;
      path?: string;
      precedesMessageId?: string;
      gapText?: string;
      gapMs?: number;
      timestamp?: string;
    }
  | { type: 'image'; data: string; mimeType: string }
  | { type: 'file'; data: string; mediaType: string; filename?: string }
  | {
      type: 'om_observation_start';
      tokensToObserve: number;
      operationType?: 'observation' | 'reflection';
    }
  | {
      type: 'om_observation_end';
      tokensObserved: number;
      observationTokens: number;
      durationMs: number;
      operationType?: 'observation' | 'reflection';
      observations?: string;
      currentTask?: string;
      suggestedResponse?: string;
    }
  | {
      type: 'om_observation_failed';
      error: string;
      tokensAttempted?: number;
      operationType?: 'observation' | 'reflection';
    }
  | { type: 'om_thread_title_updated'; threadId: string; oldTitle?: string; newTitle: string };

// =============================================================================
// Request Context
// =============================================================================

/**
 * Harness-specific context set on the RequestContext under the 'harness' key.
 * Tools can access harness state and methods through requestContext.get('harness').
 */
export interface HarnessRequestContext<TState = unknown> {
  /** The harness instance ID */
  harnessId: string;

  /** Current harness state (read-only snapshot) */
  state: TState;

  /** Get the current harness state (live, not snapshot) */
  getState: () => TState;

  /** Update harness state */
  setState: (updates: Partial<TState>) => Promise<void>;

  /** Current thread ID */
  threadId: string | null;

  /** Current resource ID */
  resourceId: string;

  /** Current mode ID */
  modeId: string;

  /** Abort signal for the current operation */
  abortSignal?: AbortSignal;

  /** Workspace instance (if configured on the Harness) */
  workspace?: Workspace;

  /** Emit a harness event (used by tools to forward events) */
  emitEvent?: (event: HarnessEvent) => void;

  /** Register a pending question resolver (used by ask_user tools) */
  registerQuestion?: (params: { questionId: string; resolve: (answer: HarnessQuestionAnswer) => void }) => void;

  /** Register a pending plan approval resolver (used by submit_plan tools) */
  registerPlanApproval?: (params: {
    planId: string;
    resolve: (result: { action: 'approved' | 'rejected'; feedback?: string }) => void;
  }) => void;

  /** Get the configured subagent model ID for a specific agent type */
  getSubagentModelId?: (params?: { agentType?: string }) => string | null;
}
