import type {
  BackgroundTaskFailedPayload,
  BackgroundTaskResultPayload,
  BackgroundTaskStartedPayload,
  BackgroundTaskWaitingPayload,
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

/**
 * Payload accepted by `BackgroundTaskManager.enqueue()`.
 */
export interface TaskPayload {
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
export interface TaskFilter {
  status?: BackgroundTaskStatus | BackgroundTaskStatus[];
  agentId?: string;
  threadId?: string;
  resourceId?: string;
  toolName?: string;
  createdBefore?: Date;
  createdAfter?: Date;
  completedBefore?: Date;
  orderBy?: 'createdAt' | 'startedAt' | 'completedAt';
  orderDirection?: 'asc' | 'desc';
  limit?: number;
  offset?: number;
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

export type MessageHandling = 'all' | 'final-only' | 'none';

export interface BackgroundTaskManagerConfig {
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
  /** What gets persisted to the thread's message history. Default: 'final-only' */
  messageHandling?: MessageHandling;
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
  retries?: RetryConfig;
  /** Override message handling for this tool */
  messageHandling?: MessageHandling;
  /** Per-tool callback on completion */
  onComplete?: (task: BackgroundTask) => void | Promise<void>;
  /** Per-tool callback on failure */
  onFailed?: (task: BackgroundTask) => void | Promise<void>;
}

export type AgentBackgroundToolConfig = boolean | { enabled: boolean; timeoutMs?: number };

export interface AgentBackgroundConfig {
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
  /** Per-agent message handling override */
  messageHandling?: MessageHandling;
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
  payload: BackgroundTaskWaitingPayload;
}

export type BackgroundTaskResultChunk = BackgroundTaskCompletedChunk | BackgroundTaskFailedChunk;

// --- Tool resolver ---

/**
 * Function that resolves a tool name to an executable tool.
 * Used by the manager to execute tools by name.
 */
export interface ToolExecutor {
  execute(args: Record<string, unknown>, options?: { abortSignal?: AbortSignal }): Promise<unknown>;
}

export type ToolResolver = (toolName: string, agentId: string) => ToolExecutor;

// --- Result injection ---

/**
 * Callback for injecting background task results into the agent's message history.
 * Called by the manager when a task completes or fails.
 */
export type ResultInjector = (params: {
  taskId: string;
  toolCallId: string;
  toolName: string;
  agentId: string;
  threadId?: string;
  resourceId?: string;
  result?: unknown;
  error?: { message: string };
  status: 'completed' | 'failed';
}) => void | Promise<void>;

// --- Enqueue result ---

export interface EnqueueResult {
  task: BackgroundTask;
  /**
   * When backpressure is 'fallback-sync' and concurrency is at limit,
   * this is set to true to signal the caller should run the tool synchronously.
   */
  fallbackToSync?: boolean;
}
