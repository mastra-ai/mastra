import type {
  Task,
  CreateTaskInput,
  ClaimFilter,
  ListFilter,
  InboxStats,
  TaskStatus,
  SuspendTaskInput,
  ResumeTaskInput,
  RetryConfig,
} from '../../../inbox/types';
import { StorageDomain } from '../base';

/**
 * Parameters for claiming a task.
 */
export interface ClaimTaskParams {
  inboxId: string;
  agentId: string;
  filter?: ClaimFilter;
  claimTimeout?: number;
}

/**
 * Parameters for failing a task.
 */
export interface FailTaskParams {
  taskId: string;
  error: { message: string; stack?: string; retryable?: boolean };
  retryConfig: Required<RetryConfig>;
}

/**
 * Parameters for batch deleting tasks.
 */
export interface DeleteTasksParams {
  inboxId?: string;
  status?: TaskStatus[];
  olderThan?: Date;
}

/**
 * Abstract base class for inbox storage implementations.
 * Handles persistence of tasks to storage.
 */
export abstract class InboxStorage extends StorageDomain {
  constructor() {
    super({
      component: 'STORAGE',
      name: 'INBOX',
    });
  }

  // Task CRUD
  abstract createTask<TPayload = unknown>(inboxId: string, input: CreateTaskInput<TPayload>): Promise<Task<TPayload>>;

  abstract getTaskById(taskId: string): Promise<Task | null>;

  abstract updateTask(taskId: string, updates: Partial<Pick<Task, 'runId' | 'metadata'>>): Promise<Task>;

  abstract deleteTask(taskId: string): Promise<void>;

  // Claiming
  abstract claimTask(params: ClaimTaskParams): Promise<Task | null>;

  abstract releaseTask(taskId: string): Promise<Task>;

  abstract releaseExpiredClaims(): Promise<number>;

  // Status updates
  abstract startTask(taskId: string): Promise<Task>;

  abstract completeTask(taskId: string, result: unknown): Promise<Task>;

  abstract failTask(params: FailTaskParams): Promise<Task>;

  abstract cancelTask(taskId: string): Promise<Task>;

  // Human-in-the-loop
  abstract suspendTask(taskId: string, input: SuspendTaskInput): Promise<Task>;

  abstract resumeTask(taskId: string, input: ResumeTaskInput): Promise<Task>;

  abstract listWaitingTasks(inboxId?: string): Promise<Task[]>;

  // Query
  abstract listTasks(inboxId: string, filter?: ListFilter): Promise<Task[]>;

  abstract getStats(inboxId: string): Promise<InboxStats>;

  abstract getStatsByInbox(): Promise<Record<string, InboxStats>>;

  // Batch operations
  abstract createTasks<TPayload = unknown>(
    inboxId: string,
    inputs: CreateTaskInput<TPayload>[],
  ): Promise<Task<TPayload>[]>;

  abstract deleteTasks(params: DeleteTasksParams): Promise<number>;

  // Upsert (for sync)
  abstract upsertTask<TPayload = unknown>(
    inboxId: string,
    sourceId: string,
    input: CreateTaskInput<TPayload>,
  ): Promise<Task<TPayload>>;
}
