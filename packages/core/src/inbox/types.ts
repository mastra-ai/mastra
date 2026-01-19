/**
 * Task status enum for inbox tasks.
 */
export const TaskStatus = {
  PENDING: 'pending',
  CLAIMED: 'claimed',
  IN_PROGRESS: 'in_progress',
  WAITING_FOR_INPUT: 'waiting_for_input',
  COMPLETED: 'completed',
  FAILED: 'failed',
  CANCELLED: 'cancelled',
} as const;

export type TaskStatus = (typeof TaskStatus)[keyof typeof TaskStatus];

/**
 * Task priority levels. Higher values = higher priority.
 */
export const TaskPriority = {
  LOW: 0,
  NORMAL: 1,
  HIGH: 2,
  URGENT: 3,
} as const;

export type TaskPriority = (typeof TaskPriority)[keyof typeof TaskPriority];

/**
 * Represents a task in the inbox system.
 */
export interface Task<TPayload = unknown, TResult = unknown> {
  id: string;
  inboxId: string;
  type: string;
  status: TaskStatus;
  priority: TaskPriority;

  // Display
  title?: string;
  sourceId?: string;
  sourceUrl?: string;

  // Data
  payload: TPayload;
  result?: TResult;
  error?: { message: string; stack?: string; retryable?: boolean };

  // Assignment
  targetAgentId?: string;
  claimedBy?: string;

  // Run association
  runId?: string;

  // Timing
  createdAt: Date;
  claimedAt?: Date;
  claimExpiresAt?: Date;
  startedAt?: Date;
  completedAt?: Date;

  // Retries
  attempts: number;
  maxAttempts: number;
  nextRetryAt?: Date;

  // Human-in-the-loop
  suspendedAt?: Date;
  suspendPayload?: unknown;
  resumePayload?: unknown;

  // Metadata
  metadata?: Record<string, unknown>;
}

/**
 * Input for creating a new task.
 */
export interface CreateTaskInput<TPayload = unknown> {
  id?: string;
  type: string;
  payload: TPayload;
  priority?: TaskPriority;
  title?: string;
  targetAgentId?: string;
  sourceId?: string;
  sourceUrl?: string;
  maxAttempts?: number;
  metadata?: Record<string, unknown>;
}

/**
 * Filter options when claiming a task.
 */
export interface ClaimFilter {
  types?: string[];
  filter?: (task: Task) => boolean;
}

/**
 * Filter options when listing tasks.
 */
export interface ListFilter {
  status?: TaskStatus | TaskStatus[];
  type?: string | string[];
  inboxId?: string;
  targetAgentId?: string;
  claimedBy?: string;
  priority?: TaskPriority;
  limit?: number;
  offset?: number;
}

/**
 * Statistics for an inbox.
 */
export interface InboxStats {
  pending: number;
  claimed: number;
  inProgress: number;
  waitingForInput: number;
  completed: number;
  failed: number;
}

/**
 * Retry configuration for tasks.
 */
export interface RetryConfig {
  /**
   * Maximum retry attempts.
   * @default 3
   */
  maxAttempts?: number;

  /**
   * Base delay in ms for exponential backoff.
   * @default 1000 (1 second)
   */
  baseDelay?: number;

  /**
   * Maximum delay in ms (cap for exponential growth).
   * @default 3600000 (1 hour)
   */
  maxDelay?: number;

  /**
   * Multiplier for exponential backoff.
   * @default 2
   */
  multiplier?: number;

  /**
   * Add random jitter to prevent thundering herd.
   * @default true
   */
  jitter?: boolean;
}

/**
 * Input for suspending a task.
 */
export interface SuspendTaskInput {
  reason: string;
  payload?: unknown;
}

/**
 * Input for resuming a task.
 */
export interface ResumeTaskInput {
  payload: unknown;
}

/**
 * Interface for Inbox implementations.
 */
export interface IInbox<TTask extends Task = Task> {
  id: string;

  // Sync (optional, for external sources)
  sync?(options?: unknown): Promise<unknown>;
  handleWebhook?(req: Request): Promise<Response>;

  // Producer API
  add(input: CreateTaskInput): Promise<TTask>;
  addBatch(inputs: CreateTaskInput[]): Promise<TTask[]>;

  // Consumer API
  claim(agentId: string, filter?: ClaimFilter): Promise<TTask | null>;
  startTask(taskId: string): Promise<void>;
  complete(taskId: string, result: unknown): Promise<void>;
  fail(taskId: string, error: Error): Promise<void>;
  release(taskId: string): Promise<void>;
  cancel(taskId: string): Promise<void>;

  // Human-in-the-loop
  suspend(taskId: string, input: SuspendTaskInput): Promise<void>;
  resume(taskId: string, input: ResumeTaskInput): Promise<void>;
  listWaiting(): Promise<TTask[]>;

  // Query API
  get(taskId: string): Promise<TTask | null>;
  list(filter?: ListFilter): Promise<TTask[]>;
  stats(): Promise<InboxStats>;

  // Update API
  updateTask(taskId: string, updates: Partial<Pick<Task, 'runId' | 'metadata'>>): Promise<Task>;

  // Hooks
  onComplete?: (task: TTask, result: unknown) => Promise<void>;
  onError?: (task: TTask, error: Error) => Promise<void>;
}

/**
 * Configuration for creating an Inbox.
 */
export interface InboxConfig {
  id: string;

  /**
   * How long a task can be claimed before it's released.
   * @default 1800000 (30 minutes)
   */
  claimTimeout?: number;

  /**
   * Retry configuration for failed tasks.
   */
  retry?: RetryConfig;

  /**
   * Called when a task completes successfully.
   */
  onComplete?: (task: Task, result: unknown) => Promise<void>;

  /**
   * Called when a task fails.
   */
  onError?: (task: Task, error: Error) => Promise<void>;
}
