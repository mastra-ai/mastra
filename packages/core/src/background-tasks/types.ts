import type {
  BackgroundTaskFailedPayload,
  BackgroundTaskResultPayload,
  BackgroundTaskStartedPayload,
  BackgroundTaskProgressPayload,
  AgentChunkType,
} from '../stream/types';

export type BackgroundTaskStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled' | 'timed_out';

export interface BackgroundTask {
  id: string;
  status: BackgroundTaskStatus;

  // What to execute
  toolName: string;
  toolCallId: string;
  args: Record<string, unknown>;

  // Context
  agentId: string;
  threadId?: string;
  resourceId?: string;
  runId: string;

  // Result
  result?: unknown;
  error?: { message: string; stack?: string };

  // Timing
  createdAt: Date;
  startedAt?: Date;
  completedAt?: Date;

  // Retry
  retryCount: number;
  maxRetries: number;

  // Timeout
  timeoutMs: number;
}

export type BackgroundTaskOutputChunk = Extract<AgentChunkType, { type: 'tool-output' }>;

export interface BackgroundTaskEvent extends BackgroundTask {
  chunk?: BackgroundTaskOutputChunk;
}

export type UpdateBackgroundTask = Partial<
  Omit<
    BackgroundTask,
    'id' | 'createdAt' | 'threadId' | 'resourceId' | 'runId' | 'agentId' | 'toolCallId' | 'toolName' | 'args'
  >
>;

/**
 * Payload accepted by `BackgroundTaskManager.enqueue()`.
 */
export interface TaskPayload {
  runId: string;
  toolName: string;
  toolCallId: string;
  args: Record<string, unknown>;
  agentId: string;
  threadId?: string;
  resourceId?: string;
  timeoutMs?: number;
  maxRetries?: number;
}

/**
 * Filter for querying and managing tasks.
 */
export type TaskDateColumn = 'createdAt' | 'startedAt' | 'completedAt';

export interface TaskFilter {
  status?: BackgroundTaskStatus | BackgroundTaskStatus[];
  agentId?: string;
  threadId?: string;
  resourceId?: string;
  toolName?: string;
  runId?: string;
  /** Start of the date range (inclusive). Filtered on `dateFilterBy` column. */
  fromDate?: Date;
  /** End of the date range (exclusive). Filtered on `dateFilterBy` column. */
  toDate?: Date;
  /** Which date column to use for fromDate/toDate filtering. Default: 'createdAt' */
  dateFilterBy?: TaskDateColumn;
  /** Column to sort by. Default: 'createdAt' */
  orderBy?: TaskDateColumn;
  orderDirection?: 'asc' | 'desc';
  /** Page number (0-indexed). Used with perPage for pagination. */
  page?: number;
  /** Number of results per page. */
  perPage?: number;
}

export interface TaskListResult {
  tasks: BackgroundTask[];
  total: number;
}

// --- Configuration ---

export interface RetryConfig {
  /** Maximum retry attempts. Default: 0 (no retries) */
  maxRetries?: number;
  /** Delay between retries in ms. Default: 1000 */
  retryDelayMs?: number;
  /** Backoff multiplier applied to retryDelayMs on each attempt. Default: 2 */
  backoffMultiplier?: number;
  /** Maximum delay between retries regardless of backoff. Default: 30_000 */
  maxRetryDelayMs?: number;
  /** Which errors should be retried. Default: all errors */
  retryableErrors?: (error: Error) => boolean;
}

export interface CleanupConfig {
  /** How long to keep completed task records in ms. Default: 3_600_000 (1 hour) */
  completedTtlMs?: number;
  /** How long to keep failed task records in ms. Default: 86_400_000 (24 hours) */
  failedTtlMs?: number;
  /** How often the cleanup process runs in ms. Default: 60_000 (1 minute) */
  cleanupIntervalMs?: number;
}

export interface BackgroundTaskManagerConfig {
  /** Whether background tasks are enabled. Default: false */
  enabled: boolean;
  /** Global concurrency limit across all agents. Default: 10 */
  globalConcurrency?: number;
  /** Per-agent concurrency limit. Default: 5 */
  perAgentConcurrency?: number;
  /**
   * What happens when concurrency limit is reached.
   * - 'queue': task waits in pending state until a slot opens (default)
   * - 'reject': enqueue() throws an error
   * - 'fallback-sync': returns a signal to run the tool synchronously in the agentic loop
   */
  backpressure?: 'queue' | 'reject' | 'fallback-sync';
  /** Default timeout for tasks in ms. Default: 300_000 (5 minutes) */
  defaultTimeoutMs?: number;
  /** Default retry configuration */
  defaultRetries?: RetryConfig;
  /** Cleanup configuration for old task records */
  cleanup?: CleanupConfig;
  /**
   * Minimum delay between chunk-based progress output events for each task, in ms.
   * Default: undefined (publish every progress chunk).
   */
  progressThrottleMs?: number;
  /**
   * How long the agentic loop waits for a background task to complete before
   * moving on (in ms). If a task hasn't finished within this time, the loop
   * proceeds without setting isContinued — allowing it to end naturally.
   * Can be overridden per-agent or per-tool. Default: undefined (wait indefinitely).
   */
  waitTimeoutMs?: number;
  /** Optional callback invoked when a task completes (in addition to stream + message list injection) */
  onTaskComplete?: (task: BackgroundTask) => void | Promise<void>;
  /** Optional callback invoked when a task fails (in addition to stream + message list injection) */
  onTaskFailed?: (task: BackgroundTask) => void | Promise<void>;
}

// --- Tool-level and agent-level config ---

export interface ToolBackgroundConfig {
  /** Whether this tool is eligible for background execution. Default: false */
  enabled?: boolean;
  /** Override the manager's default timeout for this tool */
  timeoutMs?: number;
  /** Override retry config for this tool */
  maxRetries?: number;
  /** Override how long the loop waits for this tool's background task to complete (in ms) */
  waitTimeoutMs?: number;
  /** Per-tool callback on completion */
  onComplete?: (task: BackgroundTask) => void | Promise<void>;
  /** Per-tool callback on failure */
  onFailed?: (task: BackgroundTask) => void | Promise<void>;
}

export type AgentBackgroundToolConfig = boolean | { enabled: boolean; timeoutMs?: number };

export interface AgentBackgroundConfig {
  /**
   * When true, background task dispatch is disabled for this agent — every tool
   * call runs synchronously in the loop. Useful when this agent is invoked as a
   * sub-agent and the parent has wrapped the entire sub-agent invocation as the
   * background task; you don't want the sub-agent's own tools to also dispatch
   * separate background tasks.
   */
  disabled?: boolean;
  /**
   * Which tools should run in the background.
   * - `true`: use the tool's own background config
   * - `false`: always foreground, even if tool says background
   * - `{ enabled, timeoutMs }`: override specific settings
   * - `'all'`: run all background-eligible tools in background
   */
  tools?: Record<string, AgentBackgroundToolConfig> | 'all';
  /** Per-agent concurrency override */
  concurrency?: number;
  /** Override how long the loop waits for background tasks from this agent (in ms) */
  waitTimeoutMs?: number;
  /** Per-agent callback on completion */
  onTaskComplete?: (task: BackgroundTask) => void | Promise<void>;
  /** Per-agent callback on failure */
  onTaskFailed?: (task: BackgroundTask) => void | Promise<void>;
}

/**
 * The `_background` field shape that the LLM can include in tool call args
 * to override background behavior per-call.
 */
export interface LLMBackgroundOverride {
  /** Force background (true) or foreground (false). Undefined = use default config. */
  enabled?: boolean;
  /** Override timeout for this specific call */
  timeoutMs?: number;
  /** Override max retries for this specific call */
  maxRetries?: number;
}

// --- Stream chunk types ---

export interface BackgroundTaskStartedChunk {
  type: 'background-task-started';
  payload: BackgroundTaskStartedPayload;
}

export interface BackgroundTaskCompletedChunk {
  type: 'background-task-completed';
  payload: BackgroundTaskResultPayload;
}

export interface BackgroundTaskFailedChunk {
  type: 'background-task-failed';
  payload: BackgroundTaskFailedPayload;
}

export interface BackgroundTaskProgressChunk {
  type: 'background-task-progress';
  payload: BackgroundTaskProgressPayload;
}

export type BackgroundTaskResultChunk = BackgroundTaskCompletedChunk | BackgroundTaskFailedChunk;

// --- Tool executor ---

/**
 * Interface for executing a tool. Passed per-task so each background task
 * carries its own execution context.
 */
export interface ToolExecutor {
  execute(
    args: Record<string, unknown>,
    options?: {
      abortSignal?: AbortSignal;
      /**
       * Emit intermediate progress during execution.
       * Called by tools that support streaming progress from background execution.
       * Each call produces a `background-task-progress` chunk on the SSE stream.
       */
      onProgress?: (chunk: BackgroundTaskProgressChunk) => Promise<void>;
    },
  ): Promise<unknown>;
}

// --- Result injection ---

/**
 * Callback for injecting background task results into the agent's message history.
 * Called when a task completes or fails.
 */
export type ResultInjector = (params: {
  runId: string;
  taskId: string;
  toolCallId: string;
  toolName: string;
  agentId: string;
  threadId?: string;
  resourceId?: string;
  result?: unknown;
  error?: { message: string };
  status: 'completed' | 'failed';
  completedAt: Date;
  startedAt: Date;
}) => void | Promise<void>;

export type ToolExecutionInjector = (params: {
  runId: string;
  taskId: string;
  toolCallId: string;
  toolName: string;
  agentId: string;
  threadId?: string;
  resourceId?: string;
  startedAt: Date;
}) => void | Promise<void>;

// --- Per-task context ---

/**
 * Per-task hooks that are scoped to a specific stream/session.
 * Stored in-memory on the manager, keyed by task ID.
 * These capture closures from the caller (controller, messageList, etc.)
 * and are never serialized.
 */
export interface TaskContext {
  /** The tool executor for this specific task */
  executor: ToolExecutor;
  /** Emits stream chunks (background-task-completed/failed) to the caller's stream */
  onChunk?: (chunk: BackgroundTaskResultChunk) => void;
  /** Injects tool results into the caller's message list */
  onResult?: ResultInjector;
  /** Injects tool execution into the caller's message list */
  onExecution?: ToolExecutionInjector;
  /** Per-task callback on completion */
  onComplete?: (task: BackgroundTask) => void | Promise<void>;
  /** Per-task callback on failure */
  onFailed?: (task: BackgroundTask) => void | Promise<void>;
}

// --- createBackgroundTask options ---

export interface CreateBackgroundTaskOptions extends TaskPayload {
  /** Per-task execution and delivery hooks */
  context: TaskContext;
}

// --- Enqueue result ---

export interface EnqueueResult {
  task: BackgroundTask;
  /**
   * When backpressure is 'fallback-sync' and concurrency is at limit,
   * this is set to true to signal the caller should run the tool synchronously.
   */
  fallbackToSync?: boolean;
}

// --- Background task handle ---

/**
 * A handle returned by `createBackgroundTask()`.
 * Encapsulates a single background task with its per-stream hooks.
 */
export interface BackgroundTaskHandle {
  /** The task record (available after dispatch) */
  readonly task: BackgroundTask;
  /** Dispatch the task for background execution. Returns the enqueue result. */
  dispatch(): Promise<EnqueueResult>;
  /** Cancel this task */
  cancel(): Promise<void>;
  /** Wait for this task to complete */
  waitForCompletion(options?: {
    timeoutMs?: number;
    onProgress?: (elapsedMs: number) => void;
  }): Promise<BackgroundTask>;
}
