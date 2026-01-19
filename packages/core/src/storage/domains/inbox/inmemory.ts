import {
  TaskStatus,
  TaskPriority,
  type Task,
  type CreateTaskInput,
  type ClaimFilter,
  type ListFilter,
  type InboxStats,
  type SuspendTaskInput,
  type ResumeTaskInput,
} from '../../../inbox/types';
import { DEFAULT_MAX_ATTEMPTS, DEFAULT_PRIORITY, DEFAULT_CLAIM_TIMEOUT } from '../../../inbox/constants';
import { calculateBackoff, generateTaskId } from '../../../inbox/utils';
import type { InMemoryDB } from '../inmemory-db';
import { InboxStorage, type ClaimTaskParams, type FailTaskParams, type DeleteTasksParams } from './base';

export class InMemoryInboxStorage extends InboxStorage {
  private db: InMemoryDB;

  constructor({ db }: { db: InMemoryDB }) {
    super();
    this.db = db;
  }

  async dangerouslyClearAll(): Promise<void> {
    this.db.tasks.clear();
  }

  async createTask<TPayload = unknown>(inboxId: string, input: CreateTaskInput<TPayload>): Promise<Task<TPayload>> {
    const now = new Date();
    const taskId = input.id ?? generateTaskId();

    const task: Task<TPayload> = {
      id: taskId,
      inboxId,
      type: input.type,
      status: TaskStatus.PENDING,
      priority: input.priority ?? DEFAULT_PRIORITY,
      title: input.title,
      sourceId: input.sourceId,
      sourceUrl: input.sourceUrl,
      payload: input.payload,
      targetAgentId: input.targetAgentId,
      createdAt: now,
      attempts: 0,
      maxAttempts: input.maxAttempts ?? DEFAULT_MAX_ATTEMPTS,
      metadata: input.metadata,
    };

    this.db.tasks.set(taskId, task as Task);
    this.logger.debug(`InMemoryInboxStorage: Created task ${taskId} in inbox ${inboxId}`);

    return { ...task };
  }

  async getTaskById(taskId: string): Promise<Task | null> {
    const task = this.db.tasks.get(taskId);
    return task ? { ...task } : null;
  }

  async updateTask(taskId: string, updates: Partial<Pick<Task, 'runId' | 'metadata'>>): Promise<Task> {
    const task = this.db.tasks.get(taskId);
    if (!task) {
      throw new Error(`Task ${taskId} not found`);
    }

    const updatedTask = {
      ...task,
      ...updates,
      metadata: updates.metadata ? { ...task.metadata, ...updates.metadata } : task.metadata,
    };

    this.db.tasks.set(taskId, updatedTask);
    return { ...updatedTask };
  }

  async deleteTask(taskId: string): Promise<void> {
    this.db.tasks.delete(taskId);
  }

  async claimTask(params: ClaimTaskParams): Promise<Task | null> {
    const { inboxId, agentId, filter, claimTimeout = DEFAULT_CLAIM_TIMEOUT } = params;
    const now = new Date();

    // Find claimable tasks sorted by priority (desc) then createdAt (asc)
    const claimableTasks = Array.from(this.db.tasks.values())
      .filter(task => {
        // Must be in the right inbox
        if (task.inboxId !== inboxId) return false;

        // Must be pending
        if (task.status !== TaskStatus.PENDING) return false;

        // Skip if not yet ready for retry
        if (task.nextRetryAt && task.nextRetryAt > now) return false;

        // Check targetAgentId if set
        if (task.targetAgentId && task.targetAgentId !== agentId) return false;

        // Check type filter
        if (filter?.types && !filter.types.includes(task.type)) return false;

        // Check custom filter
        if (filter?.filter && !filter.filter(task)) return false;

        return true;
      })
      .sort((a, b) => {
        // Sort by priority descending
        if (b.priority !== a.priority) {
          return b.priority - a.priority;
        }
        // Then by createdAt ascending (FIFO within same priority)
        return a.createdAt.getTime() - b.createdAt.getTime();
      });

    if (claimableTasks.length === 0) {
      return null;
    }

    const task = claimableTasks[0]!;

    // Claim the task
    task.status = TaskStatus.CLAIMED;
    task.claimedBy = agentId;
    task.claimedAt = now;
    task.claimExpiresAt = new Date(now.getTime() + claimTimeout);

    this.db.tasks.set(task.id, task);
    this.logger.debug(`InMemoryInboxStorage: Agent ${agentId} claimed task ${task.id}`);

    return { ...task };
  }

  async releaseTask(taskId: string): Promise<Task> {
    const task = this.db.tasks.get(taskId);
    if (!task) {
      throw new Error(`Task ${taskId} not found`);
    }

    task.status = TaskStatus.PENDING;
    task.claimedBy = undefined;
    task.claimedAt = undefined;
    task.claimExpiresAt = undefined;

    this.db.tasks.set(taskId, task);
    this.logger.debug(`InMemoryInboxStorage: Released task ${taskId}`);

    return { ...task };
  }

  async releaseExpiredClaims(): Promise<number> {
    const now = new Date();
    let released = 0;

    for (const task of this.db.tasks.values()) {
      if (task.status === TaskStatus.CLAIMED && task.claimExpiresAt && task.claimExpiresAt < now) {
        task.status = TaskStatus.PENDING;
        task.claimedBy = undefined;
        task.claimedAt = undefined;
        task.claimExpiresAt = undefined;
        released++;

        this.logger.debug(`InMemoryInboxStorage: Released expired claim on task ${task.id}`);
      }
    }

    if (released > 0) {
      this.logger.info(`InMemoryInboxStorage: Released ${released} expired claims`);
    }

    return released;
  }

  async startTask(taskId: string): Promise<Task> {
    const task = this.db.tasks.get(taskId);
    if (!task) {
      throw new Error(`Task ${taskId} not found`);
    }

    task.status = TaskStatus.IN_PROGRESS;
    task.startedAt = new Date();

    this.db.tasks.set(taskId, task);
    this.logger.debug(`InMemoryInboxStorage: Started task ${taskId}`);

    return { ...task };
  }

  async completeTask(taskId: string, result: unknown): Promise<Task> {
    const task = this.db.tasks.get(taskId);
    if (!task) {
      throw new Error(`Task ${taskId} not found`);
    }

    const now = new Date();
    task.status = TaskStatus.COMPLETED;
    task.result = result;
    task.completedAt = now;

    this.db.tasks.set(taskId, task);
    this.logger.debug(`InMemoryInboxStorage: Completed task ${taskId}`);

    return { ...task };
  }

  async failTask(params: FailTaskParams): Promise<Task> {
    const { taskId, error, retryConfig } = params;

    const task = this.db.tasks.get(taskId);
    if (!task) {
      throw new Error(`Task ${taskId} not found`);
    }

    const now = new Date();
    const newAttempts = task.attempts + 1;
    // Use task's maxAttempts (which may have been set when creating the task)
    const maxAttempts = task.maxAttempts;
    const shouldRetry = error.retryable !== false && newAttempts < maxAttempts;

    if (shouldRetry) {
      // Calculate next retry time with exponential backoff
      const backoffMs = calculateBackoff(newAttempts, retryConfig);
      const nextRetryAt = new Date(now.getTime() + backoffMs);

      task.status = TaskStatus.PENDING;
      task.attempts = newAttempts;
      task.nextRetryAt = nextRetryAt;
      task.error = { ...error, retryable: true };
      task.claimedBy = undefined;
      task.claimedAt = undefined;
      task.claimExpiresAt = undefined;

      this.logger.info(`InMemoryInboxStorage: Task ${taskId} scheduled for retry`, {
        attempt: newAttempts,
        nextRetryAt,
        backoffMs,
      });
    } else {
      // Max attempts reached or non-retryable error
      task.status = TaskStatus.FAILED;
      task.attempts = newAttempts;
      task.completedAt = now;
      task.error = { ...error, retryable: false };

      this.logger.info(`InMemoryInboxStorage: Task ${taskId} failed permanently`, {
        attempts: newAttempts,
        maxAttempts,
        reason: newAttempts >= maxAttempts ? 'max_attempts_reached' : 'non_retryable_error',
      });
    }

    this.db.tasks.set(taskId, task);

    return { ...task };
  }

  async cancelTask(taskId: string): Promise<Task> {
    const task = this.db.tasks.get(taskId);
    if (!task) {
      throw new Error(`Task ${taskId} not found`);
    }

    task.status = TaskStatus.CANCELLED;
    task.completedAt = new Date();

    this.db.tasks.set(taskId, task);
    this.logger.debug(`InMemoryInboxStorage: Cancelled task ${taskId}`);

    return { ...task };
  }

  async suspendTask(taskId: string, input: SuspendTaskInput): Promise<Task> {
    const task = this.db.tasks.get(taskId);
    if (!task) {
      throw new Error(`Task ${taskId} not found`);
    }

    task.status = TaskStatus.WAITING_FOR_INPUT;
    task.suspendedAt = new Date();
    task.suspendPayload = {
      reason: input.reason,
      payload: input.payload,
    };

    this.db.tasks.set(taskId, task);
    this.logger.debug(`InMemoryInboxStorage: Suspended task ${taskId} for input`);

    return { ...task };
  }

  async resumeTask(taskId: string, input: ResumeTaskInput): Promise<Task> {
    const task = this.db.tasks.get(taskId);
    if (!task) {
      throw new Error(`Task ${taskId} not found`);
    }

    if (task.status !== TaskStatus.WAITING_FOR_INPUT) {
      throw new Error(`Task ${taskId} is not waiting for input`);
    }

    task.status = TaskStatus.IN_PROGRESS;
    task.resumePayload = input.payload;

    this.db.tasks.set(taskId, task);
    this.logger.debug(`InMemoryInboxStorage: Resumed task ${taskId}`);

    return { ...task };
  }

  async listWaitingTasks(inboxId?: string): Promise<Task[]> {
    return Array.from(this.db.tasks.values())
      .filter(task => {
        if (task.status !== TaskStatus.WAITING_FOR_INPUT) return false;
        if (inboxId && task.inboxId !== inboxId) return false;
        return true;
      })
      .map(task => ({ ...task }));
  }

  async listTasks(inboxId: string, filter?: ListFilter): Promise<Task[]> {
    let tasks = Array.from(this.db.tasks.values()).filter(task => task.inboxId === inboxId);

    // Apply filters
    if (filter?.status) {
      const statuses = Array.isArray(filter.status) ? filter.status : [filter.status];
      tasks = tasks.filter(task => statuses.includes(task.status));
    }

    if (filter?.type) {
      const types = Array.isArray(filter.type) ? filter.type : [filter.type];
      tasks = tasks.filter(task => types.includes(task.type));
    }

    if (filter?.targetAgentId) {
      tasks = tasks.filter(task => task.targetAgentId === filter.targetAgentId);
    }

    if (filter?.claimedBy) {
      tasks = tasks.filter(task => task.claimedBy === filter.claimedBy);
    }

    if (filter?.priority !== undefined) {
      tasks = tasks.filter(task => task.priority === filter.priority);
    }

    // Sort by priority descending, then createdAt ascending
    tasks.sort((a, b) => {
      if (b.priority !== a.priority) {
        return b.priority - a.priority;
      }
      return a.createdAt.getTime() - b.createdAt.getTime();
    });

    // Apply pagination
    const offset = filter?.offset ?? 0;
    const limit = filter?.limit ?? tasks.length;
    tasks = tasks.slice(offset, offset + limit);

    return tasks.map(task => ({ ...task }));
  }

  async getStats(inboxId: string): Promise<InboxStats> {
    const stats: InboxStats = {
      pending: 0,
      claimed: 0,
      inProgress: 0,
      waitingForInput: 0,
      completed: 0,
      failed: 0,
    };

    for (const task of this.db.tasks.values()) {
      if (task.inboxId !== inboxId) continue;

      switch (task.status) {
        case TaskStatus.PENDING:
          stats.pending++;
          break;
        case TaskStatus.CLAIMED:
          stats.claimed++;
          break;
        case TaskStatus.IN_PROGRESS:
          stats.inProgress++;
          break;
        case TaskStatus.WAITING_FOR_INPUT:
          stats.waitingForInput++;
          break;
        case TaskStatus.COMPLETED:
          stats.completed++;
          break;
        case TaskStatus.FAILED:
        case TaskStatus.CANCELLED:
          stats.failed++;
          break;
      }
    }

    return stats;
  }

  async getStatsByInbox(): Promise<Record<string, InboxStats>> {
    const statsByInbox: Record<string, InboxStats> = {};

    for (const task of this.db.tasks.values()) {
      if (!statsByInbox[task.inboxId]) {
        statsByInbox[task.inboxId] = {
          pending: 0,
          claimed: 0,
          inProgress: 0,
          waitingForInput: 0,
          completed: 0,
          failed: 0,
        };
      }

      const stats = statsByInbox[task.inboxId]!;

      switch (task.status) {
        case TaskStatus.PENDING:
          stats.pending++;
          break;
        case TaskStatus.CLAIMED:
          stats.claimed++;
          break;
        case TaskStatus.IN_PROGRESS:
          stats.inProgress++;
          break;
        case TaskStatus.WAITING_FOR_INPUT:
          stats.waitingForInput++;
          break;
        case TaskStatus.COMPLETED:
          stats.completed++;
          break;
        case TaskStatus.FAILED:
        case TaskStatus.CANCELLED:
          stats.failed++;
          break;
      }
    }

    return statsByInbox;
  }

  async createTasks<TPayload = unknown>(
    inboxId: string,
    inputs: CreateTaskInput<TPayload>[],
  ): Promise<Task<TPayload>[]> {
    const tasks: Task<TPayload>[] = [];

    for (const input of inputs) {
      const task = await this.createTask(inboxId, input);
      tasks.push(task);
    }

    return tasks;
  }

  async deleteTasks(params: DeleteTasksParams): Promise<number> {
    const { inboxId, status, olderThan } = params;
    let deleted = 0;

    for (const [taskId, task] of this.db.tasks.entries()) {
      let shouldDelete = true;

      if (inboxId && task.inboxId !== inboxId) {
        shouldDelete = false;
      }

      if (status && !status.includes(task.status)) {
        shouldDelete = false;
      }

      if (olderThan && task.createdAt >= olderThan) {
        shouldDelete = false;
      }

      if (shouldDelete) {
        this.db.tasks.delete(taskId);
        deleted++;
      }
    }

    this.logger.info(`InMemoryInboxStorage: Deleted ${deleted} tasks`);
    return deleted;
  }

  async upsertTask<TPayload = unknown>(
    inboxId: string,
    sourceId: string,
    input: CreateTaskInput<TPayload>,
  ): Promise<Task<TPayload>> {
    // Find existing task by sourceId
    for (const task of this.db.tasks.values()) {
      if (task.inboxId === inboxId && task.sourceId === sourceId) {
        // Only update if not completed or cancelled
        if (task.status !== TaskStatus.COMPLETED && task.status !== TaskStatus.CANCELLED) {
          // Update fields
          const updatedTask = {
            ...task,
            type: input.type,
            payload: input.payload as unknown,
            title: input.title ?? task.title,
            sourceUrl: input.sourceUrl ?? task.sourceUrl,
            priority: input.priority ?? task.priority,
            metadata: input.metadata ? { ...task.metadata, ...input.metadata } : task.metadata,
          };

          this.db.tasks.set(task.id, updatedTask);
          this.logger.debug(`InMemoryInboxStorage: Updated task ${task.id} for sourceId ${sourceId}`);

          return { ...updatedTask } as Task<TPayload>;
        }

        // Return existing completed/cancelled task without update
        return { ...task } as Task<TPayload>;
      }
    }

    // Create new task
    return this.createTask(inboxId, {
      ...input,
      sourceId,
    });
  }
}
