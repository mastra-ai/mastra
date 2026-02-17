import type { Agent } from '../agent';
import type { MastraMemory } from '../memory';
import type { StorageDomains } from '../storage';
import type { Workspace, WorkspaceConfig, WorkspaceStatus } from '../workspace';

// =============================================================================
// Foundational Types
// =============================================================================

/**
 * Structural interface for storage backends accepted by the Harness.
 *
 * Uses structural typing instead of the concrete MastraCompositeStore class
 * so that any store implementation (LibSQLStore, PgStore, etc.) is assignable
 * without `as any` casts — avoiding the #private field incompatibility
 * that TypeScript imposes on classes with ES private fields.
 */
export interface HarnessStorage {
  init(): Promise<void>;
  getStore<K extends keyof StorageDomains>(storeName: K): Promise<StorageDomains[K] | undefined>;
}

/**
 * Schema type for harness state.
 *
 * Defined structurally so both zod v3 and v4 object schemas satisfy it.
 * The harness uses .safeParse() for validation and .shape for extracting defaults.
 */
export interface HarnessStateSchema {
  safeParse(data: unknown): { success: boolean; data?: any; error?: any };
  shape: Record<string, unknown>;
  /** Phantom brand — carries the inferred output type for z.infer compatibility. */
  _output: any;
}

/** Infer the state type from a HarnessStateSchema (replaces StateOf<TState>). */
export type StateOf<T extends HarnessStateSchema> = T['_output'];

/**
 * Token usage statistics from the model.
 */
export interface TokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

// =============================================================================
// Pending Interactions
// =============================================================================

/**
 * A pending interaction represents any point where the agent is blocked
 * waiting for human input. This unifies tool approvals, questions,
 * plan approvals, and any future interaction types into a single mechanism.
 *
 * @typeParam T - The shape of the response the interaction expects.
 */
export interface PendingInteraction<T = unknown> {
  /** Unique identifier for this interaction */
  id: string;

  /** Discriminator for the interaction type (e.g., "tool_approval", "question", "plan_approval") */
  kind: string;

  /** Timestamp when the interaction was registered */
  createdAt: Date;

  /** Resolve the interaction with a response */
  resolve: (response: T) => void;

  /** Reject the interaction (e.g., on abort) */
  reject: (reason?: Error) => void;
}

// =============================================================================
// Stream Chunk Handler
// =============================================================================

/**
 * Context passed to stream chunk handlers during processStream.
 * Provides access to harness capabilities without coupling handlers
 * to the Harness class.
 */
export interface StreamHandlerContext {
  /** Emit an event to all harness listeners */
  emit: (event: HarnessEvent) => void;

  /** Get the current in-progress message (may be null) */
  getMessage: () => HarnessMessage | null;

  /** Set or replace the in-progress message */
  setMessage: (message: HarnessMessage) => void;

  /** Generate a unique ID */
  generateId: () => string;

  /** Access harness hooks */
  hooks: HarnessHooks;

  /** Register a pending interaction (for approval flows, etc.) */
  registerInteraction: <T>(kind: string, id?: string) => Promise<T>;

  /** Mark that a tool approval was declined (affects stop reason) */
  setApprovalDeclined: () => void;
}

/**
 * A handler for a specific stream chunk type.
 *
 * Stream processing is decomposed into handlers keyed by chunk type.
 * This allows the core harness to handle standard chunk types while
 * consumers register handlers for domain-specific chunks (e.g., OM events).
 *
 * @returns Optional partial result to accumulate (text, stop reason, etc.)
 */
export type StreamChunkHandler = (chunk: any, context: StreamHandlerContext) => void | Promise<void>;

// =============================================================================
// Tool Policy
// =============================================================================

/**
 * Tool execution policy for a mode.
 *
 * Controls which tools the agent can use when in this mode.
 * Evaluated by the harness before tool execution (in the approval flow).
 */
export interface ToolPolicy {
  /**
   * If true, all tool calls in this mode are automatically denied
   * unless explicitly listed in `allowedTools`.
   * Useful for "plan" or "ask" modes that should be read-only.
   */
  readOnly?: boolean;

  /**
   * Explicit allowlist of tool IDs that may execute in this mode.
   * When set, tools not in this list are automatically denied.
   * Takes precedence over `readOnly` — tools in this list are allowed
   * even when `readOnly` is true.
   */
  allowedTools?: string[];

  /**
   * Explicit denylist of tool IDs that may NOT execute in this mode.
   * Evaluated after `allowedTools`. A tool in both lists is denied.
   */
  deniedTools?: string[];
}

// =============================================================================
// Configuration
// =============================================================================

/**
 * Configuration for a single agent mode within the harness.
 * Each mode represents a different "personality" or capability set.
 */
export interface HarnessMode<TState extends HarnessStateSchema = HarnessStateSchema> {
  /** Unique identifier for this mode (e.g., "plan", "build", "review") */
  id: string;

  /** Human-readable name for display in TUI */
  name?: string;

  /** Whether this is the default mode when harness starts */
  default?: boolean;

  /**
   * Default model ID for this mode (e.g., "anthropic/claude-sonnet-4-20250514").
   * Used when no per-mode model has been explicitly selected.
   * If not set, falls back to the global last model.
   */
  defaultModelId?: string;

  /** Hex color for the mode badge in the status line (e.g., "#7c3aed") */
  color?: string;

  /**
   * The agent for this mode.
   * Can be a static Agent or a function that receives harness state.
   */
  agent: Agent | ((state: StateOf<TState>) => Agent);

  /**
   * Tool execution policy for this mode.
   *
   * Controls which tools the agent is allowed to invoke. Evaluated in
   * the tool approval flow before `resolveToolApproval` and `onBeforeToolUse`.
   *
   * @example Read-only mode (plan/review)
   * ```ts
   * { readOnly: true, allowedTools: ['read_file', 'grep', 'list_files'] }
   * ```
   *
   * @example Unrestricted mode (build)
   * ```ts
   * // Omit toolPolicy — all tools are allowed by default.
   * ```
   */
  toolPolicy?: ToolPolicy;
}

/**
 * Configuration for creating a Harness instance.
 *
 * @typeParam TState - Zod schema for harness state.
 */
export interface HarnessConfig<TState extends HarnessStateSchema = HarnessStateSchema> {
  /** Unique identifier for this harness instance */
  id: string;

  /**
   * Resource ID for grouping threads (e.g., project identifier).
   * Threads are scoped to this resource ID.
   * Typically derived from git URL or project path.
   */
  resourceId: string;

  /**
   * The auto-detected resource ID before any overrides.
   * Used by `/resource reset` to restore the default.
   * If not provided, defaults to `resourceId`.
   */
  defaultResourceId?: string;

  /**
   * User ID for thread attribution (e.g., git user.email).
   * Stored as `createdBy` in thread metadata for multi-user visibility.
   */
  userId?: string;

  /**
   * Whether the storage backend is remote (e.g., Turso).
   * Affects default behavior for thread visibility filtering.
   */
  isRemoteStorage?: boolean;

  /** Storage backend for persistence (threads, messages, state) */
  storage: HarnessStorage;

  /** Zod schema defining the shape of harness state */
  stateSchema: TState;

  /** Initial state values (must conform to schema) */
  initialState?: Partial<StateOf<TState>>;

  /** Memory configuration (shared across all modes) */
  memory?: MastraMemory;

  /** Available agent modes */
  modes: HarnessMode<TState>[];

  /**
   * Callback when observational memory emits debug events.
   * Used by TUI to show progress indicators.
   */
  onObservationalMemoryEvent?: (event: ObservationalMemoryDebugEvent) => void;

  /**
   * Optional callback to provide additional toolsets at stream time.
   * Receives the current model ID and should return a toolsets object
   * (or undefined) to pass to agent.stream().
   *
   * Use this to conditionally add provider-specific tools
   * (e.g., Anthropic web search when using Claude models).
   */
  getToolsets?: (modelId: string) => Record<string, Record<string, unknown>> | undefined;

  /**
   * Workspace configuration.
   * Accepts either a pre-constructed Workspace instance or a WorkspaceConfig
   * to have the Harness construct one internally.
   *
   * When provided, the Harness manages the workspace lifecycle (init/destroy)
   * and exposes it to agents via HarnessRuntimeContext.
   *
   * @example Pre-built workspace
   * ```typescript
   * const workspace = new Workspace({ skills: ['/skills'] });
   * const harness = new Harness({ workspace, ... });
   * ```
   *
   * @example Workspace config (Harness constructs it)
   * ```typescript
   * const harness = new Harness({
   *   workspace: {
   *     filesystem: new LocalFilesystem({ basePath: './data' }),
   *     skills: ['/skills'],
   *   },
   *   ...
   * });
   * ```
   */
  workspace?: Workspace | WorkspaceConfig;

  /**
   * Extension hooks for customizing harness behavior.
   * All hooks are optional with sensible defaults.
   *
   * @see HarnessHooks for detailed documentation of each hook.
   */
  hooks?: HarnessHooks<TState>;

  /**
   * Custom stream chunk handlers, keyed by chunk type string.
   *
   * Use this to handle domain-specific stream chunks (e.g., observational
   * memory events) without modifying the core harness. Handlers are called
   * during `processStream` when a chunk matches the key.
   *
   * Built-in handlers for standard chunk types (text-delta, tool-call, etc.)
   * cannot be overridden — custom handlers are called for unrecognized types.
   *
   * @example
   * ```ts
   * streamHandlers: {
   *   'data-my-custom-event': (chunk, ctx) => {
   *     ctx.emit({ type: 'my_custom_event', ...chunk.data });
   *   },
   * }
   * ```
   */
  streamHandlers?: Record<string, StreamChunkHandler>;
}

// =============================================================================
// Threads
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
  /** Token usage for this thread (persisted for status line) */
  tokenUsage?: TokenUsage;
  /** Optional metadata (gitBranch, etc.) — may be absent on older threads */
  metadata?: Record<string, unknown>;
}

// =============================================================================
// Messages
// =============================================================================

/**
 * Simplified message type for TUI consumption.
 * Maps from Mastra's internal message format.
 */
export interface HarnessMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: HarnessMessageContent[];
  createdAt: Date;
  /** For assistant messages */
  stopReason?: 'complete' | 'tool_use' | 'aborted' | 'error';
  errorMessage?: string;
}

export type HarnessMessageContent =
  | { type: 'text'; text: string }
  | { type: 'thinking'; thinking: string }
  | { type: 'tool_call'; id: string; name: string; args: unknown }
  | {
      type: 'tool_result';
      id: string;
      name: string;
      result: unknown;
      isError: boolean;
    }
  | { type: 'image'; data: string; mimeType: string }
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
    };

// =============================================================================
// Events
// =============================================================================

/**
 * Debug events from observational memory.
 * Used by TUI to show progress indicators.
 */
export type ObservationalMemoryDebugEvent =
  | {
      type: 'observation_triggered';
      pendingTokens: number;
      threshold: number;
    }
  | {
      type: 'observation_complete';
      observationTokens: number;
      duration: number;
    }
  | {
      type: 'reflection_triggered';
      observationTokens: number;
      threshold: number;
    }
  | {
      type: 'reflection_complete';
      compressedTokens: number;
      duration: number;
    }
  | {
      type: 'tokens_accumulated';
      pendingTokens: number;
      threshold: number;
    };

/**
 * Events emitted by the harness that the TUI can subscribe to.
 */
export type HarnessEvent =
  // -- Core lifecycle ---------------------------------------------------
  | { type: 'mode_changed'; modeId: string; previousModeId: string }
  | {
      type: 'model_changed';
      modelId: string;
      scope?: 'global' | 'thread' | 'mode';
      modeId?: string;
    }
  | {
      type: 'thread_changed';
      threadId: string;
      previousThreadId: string | null;
    }
  | { type: 'thread_created'; thread: HarnessThread }
  | {
      type: 'state_changed';
      state: Record<string, unknown>;
      changedKeys: string[];
    }

  // -- Agent lifecycle --------------------------------------------------
  | { type: 'agent_start' }
  | { type: 'agent_end'; reason?: 'complete' | 'aborted' | 'error' }

  // -- Messages ---------------------------------------------------------
  | { type: 'message_start'; message: HarnessMessage }
  | { type: 'message_update'; message: HarnessMessage }
  | { type: 'message_end'; message: HarnessMessage }

  // -- Tool execution ---------------------------------------------------
  | { type: 'tool_start'; toolCallId: string; toolName: string; args: unknown }
  | {
      type: 'tool_approval_required';
      toolCallId: string;
      toolName: string;
      args: unknown;
    }
  | { type: 'tool_update'; toolCallId: string; partialResult: unknown }
  | { type: 'tool_end'; toolCallId: string; result: unknown; isError: boolean }
  | {
      type: 'shell_output';
      toolCallId: string;
      output: string;
      stream: 'stdout' | 'stderr';
    }

  // -- Usage & diagnostics ----------------------------------------------
  | { type: 'usage_update'; usage: TokenUsage }
  | { type: 'info'; message: string }
  | {
      type: 'error';
      error: Error;
      errorType?: string;
      retryable?: boolean;
      retryDelay?: number;
    }

  // -- Observational Memory: status & active window ---------------------
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

  // -- Observational Memory: observation lifecycle -----------------------
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
  | {
      type: 'om_observation_failed';
      cycleId: string;
      error: string;
      durationMs: number;
    }

  // -- Observational Memory: reflection lifecycle -----------------------
  | { type: 'om_reflection_start'; cycleId: string; tokensToReflect: number }
  | {
      type: 'om_reflection_end';
      cycleId: string;
      durationMs: number;
      compressedTokens: number;
      observations?: string;
    }
  | {
      type: 'om_reflection_failed';
      cycleId: string;
      error: string;
      durationMs: number;
    }
  | {
      type: 'om_model_changed';
      role: 'observer' | 'reflector';
      modelId: string;
    }

  // -- Observational Memory: buffering lifecycle ------------------------
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
    }

  // -- Workspace --------------------------------------------------------
  | {
      type: 'workspace_status_changed';
      status: WorkspaceStatus;
      error?: Error;
    }
  | {
      type: 'workspace_ready';
      workspaceId: string;
      workspaceName: string;
    }
  | { type: 'workspace_error'; error: Error }

  // -- Misc -------------------------------------------------------------
  | { type: 'follow_up_queued'; count: number };

/**
 * Listener function for harness events.
 *
 * @typeParam TCustomEvent - Additional application-specific event types
 *   beyond the core `HarnessEvent` set. Defaults to `never` (no custom events).
 *   The listener receives `HarnessEvent | TCustomEvent`.
 */
export type HarnessEventListener<TCustomEvent extends { type: string } = never> = (
  event: HarnessEvent | TCustomEvent,
) => void | Promise<void>;

/**
 * Extract the subset of an event union whose `type` field matches the given string(s).
 * Used by `on()` to narrow the event type for typed subscriptions.
 */
export type EventOfType<TEvent extends { type: string }, TType extends string> = Extract<TEvent, { type: TType }>;

/**
 * Typed listener for a specific event type.
 */
export type TypedEventListener<TEvent extends { type: string }, TType extends string> = (
  event: EventOfType<TEvent, TType>,
) => void | Promise<void>;

// =============================================================================
// Session
// =============================================================================

/**
 * Snapshot of the current harness session state.
 * Used by UIs to render thread lists, mode indicators, etc.
 */
export interface HarnessSession {
  currentThreadId: string | null;
  currentModeId: string;
  threads: HarnessThread[];
}

// =============================================================================
// Hooks (Extension Points)
// =============================================================================

/**
 * Callbacks that let applications customize harness behavior
 * without modifying the core implementation.
 *
 * All hooks are optional. Sensible defaults are used when omitted.
 */
export interface HarnessHooks<TState extends HarnessStateSchema = HarnessStateSchema> {
  /**
   * Decide whether a tool call should be auto-approved, prompted, or denied.
   * Called when the stream emits a `tool-call-approval` chunk.
   *
   * @returns "allow" to auto-approve, "ask" to prompt the user, "deny" to auto-decline.
   * @default Returns "ask" for all tools.
   */
  resolveToolApproval?: (toolName: string, args: unknown) => 'allow' | 'ask' | 'deny';

  /**
   * Validate or block a user message before it's sent to the agent.
   * Returning `{ allowed: false }` prevents the message from being sent.
   *
   * @default Allows all messages.
   */
  onBeforeSend?: (content: string) =>
    | {
        allowed: boolean;
        blockReason?: string;
      }
    | Promise<{
        allowed: boolean;
        blockReason?: string;
      }>;

  /**
   * Inspect the agent's response after streaming completes.
   * Returning `{ continueWorking: true }` queues a follow-up message
   * so the agent keeps going.
   *
   * @default No-op.
   */
  onAfterSend?: (result: { text?: string; stopReason: string }) =>
    | {
        continueWorking?: boolean;
        reason?: string;
      }
    | Promise<{
        continueWorking?: boolean;
        reason?: string;
      }>;

  /**
   * Called before a tool is executed (after approval).
   * Returning `{ allowed: false }` declines the tool call.
   *
   * @default Allows all tool executions.
   */
  onBeforeToolUse?: (toolName: string, args: unknown) => { allowed: boolean } | Promise<{ allowed: boolean }>;

  /**
   * Called after a tool finishes execution.
   * Fire-and-forget — errors are swallowed.
   *
   * @default No-op.
   */
  onAfterToolUse?: (toolName: string, args: unknown, result: unknown, isError: boolean) => void | Promise<void>;

  /**
   * Restore app-specific state when loading a thread's metadata.
   * Return a partial state update to merge into harness state.
   *
   * @default No-op (returns empty object).
   */
  onThreadLoad?: (metadata: Record<string, unknown>) => Partial<StateOf<TState>>;

  /**
   * Inject app-specific metadata when creating a new thread.
   * Return additional metadata key-values to persist.
   *
   * @default No-op (returns empty object).
   */
  onThreadCreate?: (thread: HarnessThread, state: StateOf<TState>) => Record<string, unknown>;

  /**
   * Parse or classify errors for better user feedback.
   * Return a structured error with type, retryability, etc.
   *
   * @default Passes through the original error.
   */
  onError?: (error: unknown) => {
    error: Error;
    errorType?: string;
    retryable?: boolean;
    retryDelay?: number;
  };
}

// =============================================================================
// Runtime Context
// =============================================================================

/**
 * The harness handle available to tools via requestContext.get("harness").
 *
 * Provides the subset of Harness functionality that tools commonly need:
 * emitting events, requesting user interactions, accessing state and abort signals.
 *
 * Note: RequestContext is a Map — it can hold anything, including functions
 * and object references. The `.toJSON()` output is what's serializable-only.
 */
export interface HarnessToolContext<TState extends HarnessStateSchema = HarnessStateSchema> {
  /** Emit an event to all harness listeners (TUI, etc.) */
  emitEvent: (event: { type: string; [key: string]: unknown }) => void;

  /** Request a user interaction and await the response (question, plan approval, etc.) */
  requestInteraction: <T>(kind: string, id?: string) => Promise<T>;

  /** Resolve a pending interaction by ID */
  resolveInteraction: <T>(id: string, response: T) => boolean;

  /** Get the current abort signal (undefined if no stream is active) */
  getAbortSignal: () => AbortSignal | undefined;

  /** The active abort signal for the current stream (convenience alias) */
  abortSignal: AbortSignal | undefined;

  /** Get current harness state */
  getState: () => StateOf<TState>;

  /** Merge updates into harness state */
  setState: (updates: Partial<StateOf<TState>>) => void;

  // Backward-compatible aliases
  /** @deprecated Use requestInteraction('question', id) instead */
  registerQuestion: (questionId: string, resolve: (answer: string) => void) => void;
  /** @deprecated Use requestInteraction('plan_approval', id) instead */
  registerPlanApproval: (planId: string, resolve: (result: any) => void) => void;
}

/**
 * Context passed to agent.stream() via RequestContext.
 *
 * Contains both data fields (harnessId, threadId, etc.) and the
 * harness tool context for tools that need to interact with the harness.
 */
export interface HarnessRequestContext<TState extends HarnessStateSchema = HarnessStateSchema> {
  /** The harness instance ID */
  harnessId: string;

  /** Current thread ID */
  threadId: string | null;

  /** Current resource ID */
  resourceId: string;

  /** Current mode ID */
  modeId: string;

  /** Snapshot of harness state at request time */
  state: StateOf<TState>;

  /** Harness handle for tool callbacks (emitEvent, requestInteraction, etc.) */
  harness: HarnessToolContext<TState>;
}

// =============================================================================
// Namespaced API Interfaces
// =============================================================================

/**
 * Thread management namespace.
 * Accessible via `harness.threads`.
 */
export interface HarnessThreads {
  /** Create a new thread and make it current. */
  create(title?: string): Promise<HarnessThread>;
  /** List threads for the current resource. */
  list(options?: { allResources?: boolean; mineOnly?: boolean }): Promise<HarnessThread[]>;
  /** Switch to an existing thread by ID. */
  switch(id: string): Promise<void>;
  /** Rename the current thread. */
  rename(title: string): Promise<void>;
  /** Select the most recent thread, or create one if none exist. */
  selectOrCreate(): Promise<HarnessThread>;
  /** Get the current thread ID (null if no thread selected). */
  current(): string | null;
  /** List messages for the current (or specified) thread. */
  messages(options?: { threadId?: string }): Promise<HarnessMessage[]>;
  /** Persist a key-value pair to the current thread's metadata. */
  persistSetting(key: string, value: unknown): Promise<void>;
}

/**
 * State management namespace.
 * Accessible via `harness.state`.
 */
export interface HarnessStateAccessor<TState extends HarnessStateSchema = HarnessStateSchema> {
  /** Get a read-only snapshot of the current state. */
  get(): Readonly<StateOf<TState>>;
  /** Update state (validated against schema). Emits state_changed event. */
  set(updates: Partial<StateOf<TState>>): Promise<void>;
}

/**
 * Mode management namespace.
 * Accessible via `harness.modes`.
 */
export interface HarnessModeAccessor<TState extends HarnessStateSchema = HarnessStateSchema> {
  /** Get all available modes. */
  list(): HarnessMode<TState>[];
  /** Switch to a different mode by ID. Aborts any in-progress generation. */
  switch(id: string): Promise<void>;
  /** Get the current mode configuration. */
  current(): HarnessMode<TState>;
  /** Get the current mode ID. */
  currentId(): string;
}

/**
 * Token usage namespace.
 * Accessible via `harness.usage`.
 */
export interface HarnessUsageAccessor {
  /** Get cumulative token usage for the current thread. */
  get(): TokenUsage;
}
