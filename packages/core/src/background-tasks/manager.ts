import { randomUUID } from 'node:crypto';
import type { PubSub } from '../events/pubsub';
import type { Event } from '../events/types';
import type {
  BackgroundTask,
  BackgroundTaskManagerConfig,
  BackgroundTaskStatus,
  EnqueueResult,
  ResultInjector,
  TaskFilter,
  TaskPayload,
  ToolResolver,
} from './types';

const TOPIC_DISPATCH = 'background-tasks';
const TOPIC_RESULT = 'background-tasks-result';
const WORKER_GROUP = 'background-task-workers';

export class BackgroundTaskManager {
  private pubsub!: PubSub;
  private config: Required<
    Pick<BackgroundTaskManagerConfig, 'globalConcurrency' | 'perAgentConcurrency' | 'backpressure' | 'defaultTimeoutMs'>
  > &
    BackgroundTaskManagerConfig;

  // In-memory task state (replaced by storage in Sprint 2)
  private tasks: Map<string, BackgroundTask> = new Map();

  // Tool resolver — set via setToolResolver()
  private toolResolver?: ToolResolver;

  // Track active AbortControllers for running tasks (for cancellation + timeout)
  private activeAbortControllers: Map<string, AbortController> = new Map();

  // Pubsub callbacks (kept for unsubscribe)
  private workerCallback?: (event: Event, ack?: () => Promise<void>) => void;
  private resultCallback?: (event: Event, ack?: () => Promise<void>) => void;

  private shuttingDown = false;

  // Stream chunk emitter — set externally
  private streamChunkEmitter?: (agentId: string, chunk: unknown) => void;

  // Result injector — injects completed/failed results into the agent's message list
  private resultInjector?: ResultInjector;

  constructor(config: BackgroundTaskManagerConfig = {}) {
    this.config = {
      globalConcurrency: config.globalConcurrency ?? 10,
      perAgentConcurrency: config.perAgentConcurrency ?? 5,
      backpressure: config.backpressure ?? 'queue',
      defaultTimeoutMs: config.defaultTimeoutMs ?? 300_000,
      ...config,
    };
  }

  async init(pubsub: PubSub): Promise<void> {
    this.pubsub = pubsub;

    // Worker: subscribes with group so only one worker processes each task.
    // Handles both dispatch and cancel events in a single subscription to avoid
    // round-robin issues where a cancel event could be sent to the wrong handler.
    this.workerCallback = async (event: Event, ack?: () => Promise<void>) => {
      if (event.type === 'task.dispatch') {
        await this.handleDispatch(event);
      } else if (event.type === 'task.cancel') {
        this.handleCancel(event);
      }
      await ack?.();
    };

    // Result listener: fan-out so all processes receive results
    this.resultCallback = async (event: Event, ack?: () => Promise<void>) => {
      if (event.type === 'task.completed' || event.type === 'task.failed') {
        await this.handleResult(event);
      }
      await ack?.();
    };

    await this.pubsub.subscribe(TOPIC_DISPATCH, this.workerCallback, { group: WORKER_GROUP });
    await this.pubsub.subscribe(TOPIC_RESULT, this.resultCallback);
  }

  setToolResolver(resolver: ToolResolver): void {
    this.toolResolver = resolver;
  }

  setStreamChunkEmitter(emitter: (agentId: string, chunk: unknown) => void): void {
    this.streamChunkEmitter = emitter;
  }

  setResultInjector(injector: ResultInjector): void {
    this.resultInjector = injector;
  }

  // --- Core operations ---

  async enqueue(payload: TaskPayload): Promise<EnqueueResult> {
    if (this.shuttingDown) {
      throw new Error('BackgroundTaskManager is shutting down, cannot enqueue new tasks');
    }

    const task: BackgroundTask = {
      id: randomUUID(),
      status: 'pending',
      toolName: payload.toolName,
      toolCallId: payload.toolCallId,
      args: payload.args,
      agentId: payload.agentId,
      threadId: payload.threadId,
      resourceId: payload.resourceId,
      retryCount: 0,
      maxRetries: payload.maxRetries ?? this.config.defaultRetries?.maxRetries ?? 0,
      timeoutMs: payload.timeoutMs ?? this.config.defaultTimeoutMs,
      createdAt: new Date(),
    };

    this.tasks.set(task.id, task);

    const canRun = this.checkConcurrency(task.agentId);

    if (canRun) {
      await this.dispatch(task);
      return { task };
    }

    // Backpressure
    switch (this.config.backpressure) {
      case 'reject':
        this.tasks.delete(task.id);
        throw new Error(`Concurrency limit reached, cannot enqueue task for tool "${task.toolName}"`);

      case 'fallback-sync':
        this.tasks.delete(task.id);
        return { task, fallbackToSync: true };

      case 'queue':
      default:
        // Task stays pending in the map, will be dispatched when a slot opens
        return { task };
    }
  }

  async cancel(taskId: string): Promise<void> {
    const task = this.tasks.get(taskId);
    if (!task) {
      throw new Error(`Task not found: ${taskId}`);
    }

    if (
      task.status === 'completed' ||
      task.status === 'failed' ||
      task.status === 'cancelled' ||
      task.status === 'timed_out'
    ) {
      return; // no-op for terminal states
    }

    if (task.status === 'pending') {
      task.status = 'cancelled';
      task.completedAt = new Date();
      return;
    }

    if (task.status === 'running') {
      task.status = 'cancelled';
      task.completedAt = new Date();

      // Abort the running tool
      const controller = this.activeAbortControllers.get(taskId);
      if (controller) {
        controller.abort(new Error('Task cancelled'));
        this.activeAbortControllers.delete(taskId);
      }

      // Publish cancel event for distributed scenarios
      await this.pubsub.publish(TOPIC_DISPATCH, {
        type: 'task.cancel',
        data: { taskId },
        runId: taskId,
      });
    }
  }

  getTask(taskId: string): BackgroundTask | undefined {
    return this.tasks.get(taskId);
  }

  listTasks(filter: TaskFilter = {}): BackgroundTask[] {
    let tasks = Array.from(this.tasks.values());

    if (filter.status) {
      const statuses = Array.isArray(filter.status) ? filter.status : [filter.status];
      tasks = tasks.filter(t => statuses.includes(t.status));
    }
    if (filter.agentId) {
      tasks = tasks.filter(t => t.agentId === filter.agentId);
    }
    if (filter.threadId) {
      tasks = tasks.filter(t => t.threadId === filter.threadId);
    }
    if (filter.resourceId) {
      tasks = tasks.filter(t => t.resourceId === filter.resourceId);
    }
    if (filter.toolName) {
      tasks = tasks.filter(t => t.toolName === filter.toolName);
    }
    if (filter.createdBefore) {
      tasks = tasks.filter(t => t.createdAt < filter.createdBefore!);
    }
    if (filter.createdAfter) {
      tasks = tasks.filter(t => t.createdAt > filter.createdAfter!);
    }
    if (filter.completedBefore) {
      tasks = tasks.filter(t => t.completedAt && t.completedAt < filter.completedBefore!);
    }

    // Sort
    const orderBy = filter.orderBy ?? 'createdAt';
    const direction = filter.orderDirection ?? 'asc';
    tasks.sort((a, b) => {
      const aVal = a[orderBy]?.getTime() ?? 0;
      const bVal = b[orderBy]?.getTime() ?? 0;
      return direction === 'asc' ? aVal - bVal : bVal - aVal;
    });

    // Pagination
    if (filter.offset) {
      tasks = tasks.slice(filter.offset);
    }
    if (filter.limit) {
      tasks = tasks.slice(0, filter.limit);
    }

    return tasks;
  }

  async shutdown(): Promise<void> {
    this.shuttingDown = true;

    if (this.workerCallback) {
      await this.pubsub.unsubscribe(TOPIC_DISPATCH, this.workerCallback);
    }
    if (this.resultCallback) {
      await this.pubsub.unsubscribe(TOPIC_RESULT, this.resultCallback);
    }

    await this.pubsub.flush();
  }

  // --- Internal ---

  private async dispatch(task: BackgroundTask): Promise<void> {
    await this.pubsub.publish(TOPIC_DISPATCH, {
      type: 'task.dispatch',
      data: {
        taskId: task.id,
        toolName: task.toolName,
        toolCallId: task.toolCallId,
        args: task.args,
        agentId: task.agentId,
        threadId: task.threadId,
        resourceId: task.resourceId,
        timeoutMs: task.timeoutMs,
        maxRetries: task.maxRetries,
      },
      runId: task.id,
    });
  }

  private async handleDispatch(event: Event): Promise<void> {
    const { taskId, toolName, args, agentId, timeoutMs } = event.data;

    const task = this.tasks.get(taskId);
    if (!task || task.status === 'cancelled') {
      return; // Task was cancelled before worker picked it up
    }

    task.status = 'running';
    task.startedAt = new Date();

    if (!this.toolResolver) {
      task.status = 'failed';
      task.error = { message: 'No tool resolver configured' };
      task.completedAt = new Date();
      await this.publishResult('task.failed', task);
      return;
    }

    const tool = this.toolResolver(toolName, agentId);

    try {
      const result = await this.executeWithTimeout(taskId, tool, args, timeoutMs);

      // Re-check — task could have been cancelled during execution (status mutated by cancel())
      const statusAfterExec = task.status as BackgroundTaskStatus;
      if (statusAfterExec === 'cancelled') {
        return;
      }

      task.status = 'completed';
      task.result = result;
      task.completedAt = new Date();

      await this.publishResult('task.completed', task);
    } catch (error: any) {
      // Task could have been cancelled during execution (status mutated by cancel())
      const statusOnError = task.status as BackgroundTaskStatus;
      if (statusOnError === 'cancelled') {
        return;
      }

      if (error?.name === 'AbortError' || error?.message === 'Task cancelled') {
        if ((statusOnError as string) !== 'timed_out' && (statusOnError as string) !== 'cancelled') {
          task.status = 'timed_out';
          task.error = { message: `Task timed out after ${timeoutMs}ms` };
          task.completedAt = new Date();
          await this.publishResult('task.failed', task);
        }
        return;
      }

      task.error = { message: error?.message ?? 'Unknown error', stack: error?.stack };
      task.completedAt = new Date();

      // Check retry policy
      if (task.retryCount < task.maxRetries) {
        const shouldRetry = this.config.defaultRetries?.retryableErrors
          ? this.config.defaultRetries.retryableErrors(error)
          : true;

        if (shouldRetry) {
          task.retryCount++;
          task.status = 'pending';
          task.error = undefined;
          task.completedAt = undefined;
          task.startedAt = undefined;

          // Delay before retry
          const delay = this.getRetryDelay(task.retryCount);
          if (delay > 0) {
            await new Promise(resolve => setTimeout(resolve, delay));
          }

          await this.dispatch(task);
          return;
        }
      }

      task.status = 'failed';
      await this.publishResult('task.failed', task);
    } finally {
      this.activeAbortControllers.delete(taskId);
      await this.drainPending();
    }
  }

  private async handleResult(event: Event): Promise<void> {
    const { taskId, toolName, agentId, toolCallId, threadId, resourceId } = event.data;
    const task = this.tasks.get(taskId);
    const messageHandling = this.config.messageHandling ?? 'final-only';

    if (event.type === 'task.completed') {
      // Always stream the chunk
      this.streamChunkEmitter?.(agentId, {
        type: 'background-task-completed',
        payload: { taskId, toolName, toolCallId, result: event.data.result },
      });

      // Inject into message list (unless messageHandling is 'none')
      if (messageHandling !== 'none') {
        await this.resultInjector?.({
          taskId,
          toolCallId,
          toolName,
          agentId,
          threadId,
          resourceId,
          result: event.data.result,
          status: 'completed',
        });
      }

      if (task) {
        await this.config.onTaskComplete?.(task);
      }
    }

    if (event.type === 'task.failed') {
      // Always stream the chunk
      this.streamChunkEmitter?.(agentId, {
        type: 'background-task-failed',
        payload: { taskId, toolName, toolCallId, error: event.data.error },
      });

      // Inject into message list (unless messageHandling is 'none')
      if (messageHandling !== 'none') {
        await this.resultInjector?.({
          taskId,
          toolCallId,
          toolName,
          agentId,
          threadId,
          resourceId,
          error: event.data.error,
          status: 'failed',
        });
      }

      if (task) {
        await this.config.onTaskFailed?.(task);
      }
    }
  }

  private handleCancel(event: Event): void {
    const { taskId } = event.data;
    const controller = this.activeAbortControllers.get(taskId);
    if (controller) {
      controller.abort(new Error('Task cancelled'));
      this.activeAbortControllers.delete(taskId);
    }
  }

  private async executeWithTimeout(
    taskId: string,
    tool: { execute(args: Record<string, unknown>, options?: { abortSignal?: AbortSignal }): Promise<unknown> },
    args: Record<string, unknown>,
    timeoutMs: number,
  ): Promise<unknown> {
    const abortController = new AbortController();
    this.activeAbortControllers.set(taskId, abortController);

    const timeoutHandle = setTimeout(() => {
      abortController.abort(new Error(`Task timed out after ${timeoutMs}ms`));
    }, timeoutMs);

    try {
      return await tool.execute(args, { abortSignal: abortController.signal });
    } finally {
      clearTimeout(timeoutHandle);
    }
  }

  private async publishResult(type: 'task.completed' | 'task.failed', task: BackgroundTask): Promise<void> {
    await this.pubsub.publish(TOPIC_RESULT, {
      type,
      data: {
        taskId: task.id,
        toolName: task.toolName,
        toolCallId: task.toolCallId,
        agentId: task.agentId,
        threadId: task.threadId,
        resourceId: task.resourceId,
        result: task.result,
        error: task.error,
      },
      runId: task.id,
    });
  }

  private checkConcurrency(agentId: string): boolean {
    const running = Array.from(this.tasks.values()).filter(t => t.status === 'running');

    if (running.length >= this.config.globalConcurrency) {
      return false;
    }

    const agentRunning = running.filter(t => t.agentId === agentId);
    if (agentRunning.length >= this.config.perAgentConcurrency) {
      return false;
    }

    return true;
  }

  private async drainPending(): Promise<void> {
    const pending = Array.from(this.tasks.values())
      .filter(t => t.status === 'pending')
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());

    for (const task of pending) {
      if (this.checkConcurrency(task.agentId)) {
        await this.dispatch(task);
      }
    }
  }

  private getRetryDelay(attempt: number): number {
    const base = this.config.defaultRetries?.retryDelayMs ?? 1000;
    const multiplier = this.config.defaultRetries?.backoffMultiplier ?? 2;
    const maxDelay = this.config.defaultRetries?.maxRetryDelayMs ?? 30_000;
    const delay = base * Math.pow(multiplier, attempt - 1);
    return Math.min(delay, maxDelay);
  }
}
