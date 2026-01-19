import { MastraBase } from '../base';
import { RegisteredLogger } from '../logger/constants';
import type { InboxStorage } from '../storage/domains/inbox';
import type { Mastra } from '../mastra';
import { DEFAULT_CLAIM_TIMEOUT, DEFAULT_RETRY_CONFIG } from './constants';
import { isRetryableError } from './utils';
import type {
  IInbox,
  Task,
  CreateTaskInput,
  ClaimFilter,
  ListFilter,
  InboxStats,
  InboxConfig,
  RetryConfig,
  SuspendTaskInput,
  ResumeTaskInput,
} from './types';

/**
 * Inbox is a task queue that receives tasks from various sources
 * and allows agents to claim and process them.
 */
export class Inbox<TTask extends Task = Task> extends MastraBase implements IInbox<TTask> {
  readonly id: string;

  #storage?: InboxStorage;
  #mastra?: Mastra;
  #claimTimeout: number;
  #retryConfig: Required<RetryConfig>;

  onComplete?: (task: TTask, result: unknown) => Promise<void>;
  onError?: (task: TTask, error: Error) => Promise<void>;

  constructor(config: InboxConfig) {
    super({
      component: RegisteredLogger.INBOX,
      name: config.id,
    });

    this.id = config.id;
    this.#claimTimeout = config.claimTimeout ?? DEFAULT_CLAIM_TIMEOUT;
    this.#retryConfig = {
      ...DEFAULT_RETRY_CONFIG,
      ...config.retry,
    };
    this.onComplete = config.onComplete as (task: TTask, result: unknown) => Promise<void>;
    this.onError = config.onError as (task: TTask, error: Error) => Promise<void>;
  }

  /**
   * Called by Mastra to inject dependencies.
   * @internal
   */
  __registerMastra(mastra: Mastra): void {
    this.#mastra = mastra;
  }

  /**
   * Get storage from Mastra.
   * @internal
   */
  private getStorage(): InboxStorage {
    if (this.#storage) return this.#storage;

    const storage = this.#mastra?.getStorage();
    const inboxStorage = storage?.stores?.inbox;

    if (!inboxStorage) {
      throw new Error(
        `Inbox storage not configured. Make sure your storage adapter provides inbox storage ` +
          `or configure it in your Mastra instance.`,
      );
    }

    this.#storage = inboxStorage;
    return inboxStorage;
  }

  // Producer API

  /**
   * Add a task to the inbox.
   */
  async add(input: CreateTaskInput): Promise<TTask> {
    const storage = this.getStorage();
    const task = await storage.createTask(this.id, input);
    this.logger.debug(`Added task ${task.id} to inbox ${this.id}`);
    return task as TTask;
  }

  /**
   * Add multiple tasks to the inbox.
   */
  async addBatch(inputs: CreateTaskInput[]): Promise<TTask[]> {
    const storage = this.getStorage();
    const tasks = await storage.createTasks(this.id, inputs);
    this.logger.debug(`Added ${tasks.length} tasks to inbox ${this.id}`);
    return tasks as TTask[];
  }

  // Consumer API

  /**
   * Claim the next available task for processing.
   */
  async claim(agentId: string, filter?: ClaimFilter): Promise<TTask | null> {
    const storage = this.getStorage();
    const task = await storage.claimTask({
      inboxId: this.id,
      agentId,
      filter,
      claimTimeout: this.#claimTimeout,
    });

    if (task) {
      this.logger.debug(`Agent ${agentId} claimed task ${task.id}`);
    }

    return task as TTask | null;
  }

  /**
   * Mark a task as in progress (start processing).
   */
  async startTask(taskId: string): Promise<void> {
    const storage = this.getStorage();
    await storage.startTask(taskId);
    this.logger.debug(`Started task ${taskId}`);
  }

  /**
   * Mark a task as completed with result.
   */
  async complete(taskId: string, result: unknown): Promise<void> {
    const storage = this.getStorage();
    await storage.completeTask(taskId, result);
    this.logger.debug(`Completed task ${taskId}`);
  }

  /**
   * Mark a task as failed with error.
   * If the error is retryable and attempts remain, the task will be rescheduled.
   */
  async fail(taskId: string, error: Error): Promise<void> {
    const storage = this.getStorage();
    const retryable = isRetryableError(error);

    await storage.failTask({
      taskId,
      error: {
        message: error.message,
        stack: error.stack,
        retryable,
      },
      retryConfig: this.#retryConfig,
    });

    this.logger.debug(`Failed task ${taskId}`, { retryable });
  }

  /**
   * Release a claimed task back to the pending queue.
   */
  async release(taskId: string): Promise<void> {
    const storage = this.getStorage();
    await storage.releaseTask(taskId);
    this.logger.debug(`Released task ${taskId}`);
  }

  /**
   * Cancel a task.
   */
  async cancel(taskId: string): Promise<void> {
    const storage = this.getStorage();
    await storage.cancelTask(taskId);
    this.logger.debug(`Cancelled task ${taskId}`);
  }

  // Human-in-the-loop

  /**
   * Suspend a task to wait for human input.
   */
  async suspend(taskId: string, input: SuspendTaskInput): Promise<void> {
    const storage = this.getStorage();
    await storage.suspendTask(taskId, input);
    this.logger.debug(`Suspended task ${taskId} for input: ${input.reason}`);
  }

  /**
   * Resume a suspended task with human input.
   */
  async resume(taskId: string, input: ResumeTaskInput): Promise<void> {
    const storage = this.getStorage();
    await storage.resumeTask(taskId, input);
    this.logger.debug(`Resumed task ${taskId}`);
  }

  /**
   * List all tasks waiting for human input.
   */
  async listWaiting(): Promise<TTask[]> {
    const storage = this.getStorage();
    const tasks = await storage.listWaitingTasks(this.id);
    return tasks as TTask[];
  }

  // Query API

  /**
   * Get a task by ID.
   */
  async get(taskId: string): Promise<TTask | null> {
    const storage = this.getStorage();
    const task = await storage.getTaskById(taskId);
    return task as TTask | null;
  }

  /**
   * List tasks in the inbox with optional filtering.
   */
  async list(filter?: ListFilter): Promise<TTask[]> {
    const storage = this.getStorage();
    const tasks = await storage.listTasks(this.id, filter);
    return tasks as TTask[];
  }

  /**
   * Get statistics for the inbox.
   */
  async stats(): Promise<InboxStats> {
    const storage = this.getStorage();
    return storage.getStats(this.id);
  }

  /**
   * Update a task (for runId and metadata updates).
   */
  async updateTask(taskId: string, updates: Partial<Pick<Task, 'runId' | 'metadata'>>): Promise<Task> {
    const storage = this.getStorage();
    return storage.updateTask(taskId, updates);
  }

  // Sync API (optional, for external sources - overridden by subclasses)

  /**
   * Sync tasks from an external source.
   * Override in subclasses like GitHubInbox.
   */
  async sync(_options?: unknown): Promise<unknown> {
    // Default no-op - subclasses override
    return;
  }

  /**
   * Handle incoming webhook from external source.
   * Override in subclasses like GitHubInbox.
   */
  async handleWebhook?(req: Request): Promise<Response> {
    // Default - return 404
    return new Response('Not implemented', { status: 404 });
  }
}
