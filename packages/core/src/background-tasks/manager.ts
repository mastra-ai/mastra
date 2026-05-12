import { randomUUID } from 'node:crypto';
import type { Mastra } from '..';
import type { PubSub } from '../events/pubsub';
import type { Event, EventCallback } from '../events/types';
import type {
  BackgroundTask,
  BackgroundTaskManagerConfig,
  BackgroundTaskStatus,
  EnqueueResult,
  TaskContext,
  TaskFilter,
  TaskPayload,
  TaskListResult,
  ToolExecutor,
  BackgroundTaskEvent,
} from './types';
import { BACKGROUND_TASK_WORKFLOW_ID } from './workflow-id';

const TOPIC_DISPATCH = 'background-tasks';
const TOPIC_RESULT = 'background-tasks-result';
const WORKER_GROUP = 'background-task-workers';

export class BackgroundTaskManager {
  private pubsub!: PubSub;
  config: Required<
    Pick<BackgroundTaskManagerConfig, 'globalConcurrency' | 'perAgentConcurrency' | 'backpressure' | 'defaultTimeoutMs'>
  > &
    BackgroundTaskManagerConfig;

  #mastra?: Mastra;

  // Per-task contexts — keyed by task ID, holds closures from the caller's stream.
  /** @internal — read by the workflow-engine step bodies in workflow.ts */
  taskContexts: Map<string, TaskContext> = new Map();

  // Static executors keyed by tool name. Populated by `Mastra` for every
  // registered tool, and by `BackgroundTaskWorker.#wireStaticTools` on
  // standalone worker processes. Used as the fallback for cross-process
  // dispatch where the producer's per-task closure (taskContexts) is not
  // visible — a remote worker resolves the tool by name instead.
  private staticExecutors: Map<string, ToolExecutor> = new Map();

  // Track active AbortControllers for running tasks (for cancellation + timeout)
  /** @internal — read by the workflow-engine step bodies in workflow.ts */
  activeAbortControllers: Map<string, AbortController> = new Map();

  // Pubsub callbacks (kept for unsubscribe)
  private workerCallback?: EventCallback;
  private resultCallback?: EventCallback;

  private shuttingDown = false;

  // Cleanup interval handle
  private cleanupInterval?: ReturnType<typeof setInterval>;

  // Tracks the in-flight `init(pubsub)` so consumers can await readiness.
  // Mastra fires init as fire-and-forget in `#ensureBackgroundTaskManager`,
  // so without this any caller that hits `enqueue`/`resume`/`cancel`
  // before init completes races against worker subscription + workflow
  // registration. Public methods that depend on init await this promise
  // before doing work.
  private initPromise?: Promise<void>;

  constructor(config: BackgroundTaskManagerConfig = { enabled: false }) {
    this.config = {
      globalConcurrency: config.globalConcurrency ?? 10,
      perAgentConcurrency: config.perAgentConcurrency ?? 5,
      backpressure: config.backpressure ?? 'queue',
      defaultTimeoutMs: config.defaultTimeoutMs ?? 300_000,
      ...config,
    };
  }

  __registerMastra(mastra: Mastra) {
    this.#mastra = mastra;
  }

  async getStorage() {
    const storage = this.#mastra?.getStorage();
    if (!storage) {
      throw new Error('Storage is not initialized');
    }
    const bgStore = await storage.getStore('backgroundTasks');
    if (!bgStore) {
      throw new Error('Background tasks storage is not available');
    }
    return bgStore;
  }

  async init(pubsub: PubSub): Promise<void> {
    if (this.initPromise) return this.initPromise;
    this.initPromise = this.#doInit(pubsub);
    return this.initPromise;
  }

  async #doInit(pubsub: PubSub): Promise<void> {
    this.pubsub = pubsub;

    // Worker: subscribes with group so only one worker processes each task.
    this.workerCallback = async (event: Event, ack?: () => Promise<void>) => {
      if (event.type === 'task.dispatch') {
        await this.handleDispatch(event);
      } else if (event.type === 'task.resume') {
        await this.handleResume(event);
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

    // Register the workflow BEFORE subscribing the worker so that any
    // dispatch event the worker picks up can immediately resolve the
    // workflow on Mastra. Reversing this order races: a publish that
    // arrives between `subscribe(TOPIC_DISPATCH)` and the workflow
    // registration triggers `__getInternalWorkflow` to throw
    // `Workflow with id __background-task not found`, the task stays at
    // `running` forever, and the dispatch is silently dropped.
    if (this.#mastra) {
      // Dynamic import breaks the static cycle:
      // agent → background-tasks → manager → workflow → workflows/evented →
      // workflows/index → agent. Static import works at runtime but during
      // module evaluation in test environments the cycle leaves `Workflow`
      // undefined when `evented/workflow.ts` evaluates its `class extends`.
      const { buildBackgroundTaskWorkflow } = await import('./workflow');
      const workflow = buildBackgroundTaskWorkflow(this);
      if (!this.#mastra.__hasInternalWorkflow(BACKGROUND_TASK_WORKFLOW_ID)) {
        // The `__background-task` workflow is typed against `EventedEngineType`
        // and a concrete input/output schema, while `__registerInternalWorkflow`
        // accepts the looser default `Workflow` shape. The cast is purely a
        // type-level bridge — the runtime value is a real Workflow.
        this.#mastra.__registerInternalWorkflow(
          workflow as unknown as Parameters<Mastra['__registerInternalWorkflow']>[0],
        );
      }
    }

    await this.pubsub.subscribe(TOPIC_DISPATCH, this.workerCallback, { group: WORKER_GROUP });
    await this.pubsub.subscribe(TOPIC_RESULT, this.resultCallback);

    // Recover stale tasks from a previous process
    await this.recoverStaleTasks();

    // Start periodic cleanup if configured
    const cleanupConfig = this.config.cleanup;
    if (cleanupConfig) {
      const intervalMs = cleanupConfig.cleanupIntervalMs ?? 60_000;
      this.cleanupInterval = setInterval(() => {
        void this.cleanup();
      }, intervalMs);
    }
  }

  // --- Per-task context registration ---

  /**
   * Register per-task hooks (executor, stream emitter, result injector).
   * Called internally by createBackgroundTask or directly for advanced usage.
   */
  registerTaskContext(taskId: string, context: TaskContext): void {
    this.taskContexts.set(taskId, context);
  }

  /**
   * Remove per-task hooks. Called after task reaches terminal state.
   */
  deregisterTaskContext(taskId: string): void {
    this.taskContexts.delete(taskId);
  }

  /**
   * Register a tool executor by tool name. Used for cross-process dispatch:
   * when a worker in a different process picks up a `task.dispatch` event,
   * it has no per-task closure (`taskContexts`) for that taskId, but it can
   * resolve the executor by tool name via this registry.
   */
  registerStaticExecutor(toolName: string, executor: ToolExecutor): void {
    if (this.staticExecutors.has(toolName)) {
      this.#mastra?.getLogger?.()?.debug?.(`Overwriting existing static executor for tool "${toolName}"`);
    }
    this.staticExecutors.set(toolName, executor);
  }

  /**
   * Symmetric to `registerStaticExecutor`. Called when a tool is removed
   * from `Mastra`.
   */
  unregisterStaticExecutor(toolName: string): void {
    this.staticExecutors.delete(toolName);
  }

  /**
   * Look up an executor by tool name. Read by the workflow-step body in
   * `workflow.ts:executeStep` as a fallback when no per-task `TaskContext`
   * is registered (cross-process path).
   */
  getStaticExecutor(toolName: string): ToolExecutor | undefined {
    return this.staticExecutors.get(toolName);
  }

  // --- Core operations ---

  /**
   * Enqueue a task for background execution.
   * Prefer `createBackgroundTask()` which returns a self-contained handle.
   */
  async enqueue(payload: TaskPayload, context?: TaskContext): Promise<EnqueueResult> {
    if (this.shuttingDown) {
      throw new Error('BackgroundTaskManager is shutting down, cannot enqueue new tasks');
    }

    // Mastra fires `init` as fire-and-forget. If a caller hits enqueue
    // before init completes, the dispatch publish fires before the worker
    // subscribes and the event is dropped (or, worse, lands on a worker
    // whose Mastra hasn't yet registered the bg-task workflow → "Workflow
    // with id __background-task not found"). Await readiness up front.
    if (this.initPromise) await this.initPromise;

    const task: BackgroundTask = {
      id: this.#mastra?.generateId() ?? randomUUID(),
      status: 'pending',
      toolName: payload.toolName,
      toolCallId: payload.toolCallId,
      args: payload.args,
      agentId: payload.agentId,
      threadId: payload.threadId,
      resourceId: payload.resourceId,
      runId: payload.runId,
      retryCount: 0,
      maxRetries: payload.maxRetries ?? this.config.defaultRetries?.maxRetries ?? 0,
      timeoutMs: payload.timeoutMs ?? this.config.defaultTimeoutMs,
      createdAt: new Date(),
    };

    // Register per-task context if provided
    if (context) {
      this.registerTaskContext(task.id, context);
    }

    const storage = await this.getStorage();
    await storage.createTask(task);

    const canRun = await this.checkConcurrency(task.agentId);

    if (canRun) {
      await this.dispatch(task);
      return { task };
    }

    // Backpressure
    switch (this.config.backpressure) {
      case 'reject':
        this.deregisterTaskContext(task.id);
        await storage.deleteTask(task.id);
        throw new Error(`Concurrency limit reached, cannot enqueue task for tool "${task.toolName}"`);

      case 'fallback-sync':
        this.deregisterTaskContext(task.id);
        await storage.deleteTask(task.id);
        return { task, fallbackToSync: true };

      case 'queue':
      default:
        // Task stays pending in storage, will be dispatched when a slot opens
        return { task };
    }
  }

  async cancel(taskId: string): Promise<void> {
    if (this.initPromise) await this.initPromise;
    const storage = await this.getStorage();
    const task = await storage.getTask(taskId);
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
      await storage.updateTask(taskId, { status: 'cancelled', completedAt: new Date() });
      const cancelledTask = await storage.getTask(taskId);
      if (cancelledTask) await this.publishLifecycleEvent('task.cancelled', cancelledTask);
      this.deregisterTaskContext(taskId);
      return;
    }

    if (task.status === 'suspended') {
      // No active executor or AbortController to tear down — the task is
      // sitting on a workflow snapshot. Flip storage, publish, and tell the
      // workflow run to cancel so the snapshot is cleaned up too.
      await storage.updateTask(taskId, { status: 'cancelled', completedAt: new Date() });
      if (this.#mastra) {
        try {
          const workflow = this.#mastra.__getInternalWorkflow(BACKGROUND_TASK_WORKFLOW_ID);
          const wrapper = await workflow.createRun({ runId: taskId });
          await wrapper.cancel();
        } catch (err) {
          this.#mastra?.getLogger?.()?.warn(`background-task workflow cancel failed for ${taskId}:`, err as any);
        }
      }
      const cancelledTask = await storage.getTask(taskId);
      if (cancelledTask) await this.publishLifecycleEvent('task.cancelled', cancelledTask);
      this.deregisterTaskContext(taskId);
      return;
    }

    if (task.status === 'running') {
      await storage.updateTask(taskId, { status: 'cancelled', completedAt: new Date() });

      // Abort the running tool
      const controller = this.activeAbortControllers.get(taskId);
      if (controller) {
        controller.abort(new Error('Task cancelled'));
        this.activeAbortControllers.delete(taskId);
      }

      // Also cancel the workflow run so workflow storage reflects the
      // cancellation (run status flips to 'canceled' and the workflow's
      // abortSignal fires — redundant with the local AbortController above
      // but keeps run history clean and propagates cross-process via the
      // workflow.cancel pubsub event).
      if (this.#mastra) {
        try {
          const workflow = this.#mastra.__getInternalWorkflow(BACKGROUND_TASK_WORKFLOW_ID);
          const wrapper = await workflow.createRun({ runId: taskId });
          await wrapper.cancel();
        } catch (err) {
          this.#mastra?.getLogger?.()?.warn(`background-task workflow cancel failed for ${taskId}:`, err as any);
        }
      }

      const cancelledTask = await storage.getTask(taskId);
      if (cancelledTask) await this.publishLifecycleEvent('task.cancelled', cancelledTask);
      this.deregisterTaskContext(taskId);

      // Also publish cancel on dispatch topic for distributed worker abort
      await this.pubsub.publish(TOPIC_DISPATCH, {
        type: 'task.cancel',
        data: { taskId },
        runId: taskId,
      });
    }
  }

  /**
   * Resume a suspended task. The tool executor must be re-registered via
   * `registerTaskContext(taskId, ...)` before calling this if the original
   * registration is gone (e.g. process restart) — the manager doesn't
   * rehydrate executor closures from storage.
   *
   * `resumeData` is forwarded to the tool's `execute` options on the
   * resumed run.
   */
  async resume(taskId: string, resumeData?: unknown): Promise<BackgroundTask> {
    if (!this.#mastra) {
      throw new Error('Mastra is not registered with this manager');
    }

    if (this.initPromise) await this.initPromise;

    const storage = await this.getStorage();
    const task = await storage.getTask(taskId);
    if (!task) {
      throw new Error(`Task not found: ${taskId}`);
    }
    if (task.status !== 'suspended') {
      throw new Error(`Cannot resume task in status '${task.status}' (expected 'suspended')`);
    }

    const canRun = await this.checkConcurrency(task.agentId);
    if (!canRun) {
      // Resume sits outside the queue/fallback-sync paths — there's no
      // synchronous caller to fall back to, and silently leaving the task
      // suspended hides the failure from the caller. Throw and let the
      // caller retry once a slot frees.
      throw new Error(`Concurrency limit reached, cannot resume task "${taskId}" — retry once a slot is available`);
    }

    // Hand off to the worker subscriber. `task.resume` rides the same
    // `TOPIC_DISPATCH` + `WORKER_GROUP` exactly-once channel as
    // `task.dispatch`, so any worker (including a different process from
    // the one that suspended the task) can pick it up.
    await this.pubsub.publish(TOPIC_DISPATCH, {
      type: 'task.resume',
      data: { taskId, resumeData },
      runId: taskId,
    });

    return task;
  }

  async getTask(taskId: string): Promise<BackgroundTask | null> {
    const storage = await this.getStorage();
    return storage.getTask(taskId);
  }

  async listTasks(filter: TaskFilter = {}): Promise<TaskListResult> {
    const storage = await this.getStorage();
    return storage.listTasks(filter);
  }

  /**
   * Deletes old completed/failed/cancelled/timed_out task records from storage.
   */
  async cleanup(): Promise<void> {
    const completedTtlMs = this.config.cleanup?.completedTtlMs ?? 3_600_000;
    const failedTtlMs = this.config.cleanup?.failedTtlMs ?? 86_400_000;
    const now = Date.now();

    const storage = await this.getStorage();
    await storage.deleteTasks({
      status: ['completed'],
      toDate: new Date(now - completedTtlMs),
      dateFilterBy: 'completedAt',
    });

    await storage.deleteTasks({
      status: ['failed', 'cancelled', 'timed_out'],
      toDate: new Date(now - failedTtlMs),
      dateFilterBy: 'completedAt',
    });
  }

  /**
   * Returns a promise that resolves when the next task from the given set
   * reaches a terminal state.
   */
  async waitForNextTask(
    taskIds: string[],
    options?: {
      timeoutMs?: number;
      onProgress?: (elapsedMs: number) => void;
      progressIntervalMs?: number;
    },
  ): Promise<BackgroundTask> {
    const storage = await this.getStorage();

    const isTerminal = (status: string) =>
      status === 'completed' || status === 'failed' || status === 'cancelled' || status === 'timed_out';

    for (const id of taskIds) {
      const task = await storage.getTask(id);
      if (task && isTerminal(task.status)) {
        return task;
      }
    }

    return new Promise((resolve, reject) => {
      const startTime = Date.now();

      const timeout = options?.timeoutMs
        ? setTimeout(() => {
            clearInterval(pollInterval);
            if (progressInterval) clearInterval(progressInterval);
            reject(new Error('Timed out waiting for background task'));
          }, options.timeoutMs)
        : undefined;

      const progressInterval = options?.onProgress
        ? setInterval(() => {
            options.onProgress!(Date.now() - startTime);
          }, options.progressIntervalMs ?? 3000)
        : undefined;

      const pollInterval = setInterval(async () => {
        for (const id of taskIds) {
          const task = await storage.getTask(id);
          if (task && isTerminal(task.status)) {
            clearInterval(pollInterval);
            if (timeout) clearTimeout(timeout);
            if (progressInterval) clearInterval(progressInterval);
            resolve(task);
            return;
          }
        }
      }, 50);
    });
  }

  /**
   * Returns a ReadableStream of all background task lifecycle events,
   * filtered by optional criteria. Intended to be piped directly to an SSE response.
   *
   * On connection, emits the current state of all non-terminal tasks as a snapshot,
   * then subscribes to live pubsub events for subsequent updates.
   *
   * Events include:
   * - `task.running` (status: 'running') — task picked up by a worker
   * - `task.completed` (status: 'completed') — task finished successfully
   * - `task.failed` (status: 'failed' or 'timed_out') — task errored or timed out
   * - `task.cancelled` (status: 'cancelled') — task was cancelled
   * - `task.suspended` (status: 'suspended') — task paused via `suspend()` from
   *   inside its tool executor; resume with `manager.resume(taskId, data)`
   * - `task.resumed` (status: 'running') — suspended task resumed
   *
   * The stream stays open until the caller's AbortSignal fires (client disconnect).
   */
  stream(options?: {
    agentId?: string;
    runId?: string;
    threadId?: string;
    resourceId?: string;
    taskId?: string;
    abortSignal?: AbortSignal;
  }): ReadableStream<Record<string, unknown>> {
    const manager = this;
    const pubsub = this.pubsub;
    const { agentId, runId, threadId, resourceId, abortSignal, taskId } = options ?? {};

    const EVENT_STATUS_MAP: Record<string, BackgroundTaskStatus> = {
      'task.running': 'running',
      'task.output': 'running',
      'task.completed': 'completed',
      'task.failed': 'failed',
      'task.cancelled': 'cancelled',
      'task.suspended': 'suspended',
      'task.resumed': 'running',
    };

    const CHUNK_EVENT_MAP: Record<string, string> = {
      'task.running': 'background-task-running',
      'task.output': 'background-task-output',
      'task.completed': 'background-task-completed',
      'task.failed': 'background-task-failed',
      'task.cancelled': 'background-task-cancelled',
      'task.suspended': 'background-task-suspended',
      'task.resumed': 'background-task-resumed',
    };

    return new ReadableStream({
      async start(controller) {
        // 1. Subscribe to live events first (so we don't miss anything between snapshot and subscribe)
        const handler = async (event: Event) => {
          const status = EVENT_STATUS_MAP[event.type];
          if (!status) return;

          const data = event.data;
          if (agentId && data.agentId !== agentId) return;
          if (runId && data.runId !== runId) return;
          if (threadId && data.threadId !== threadId) return;
          if (resourceId && data.resourceId !== resourceId) return;
          if (taskId && data.taskId !== taskId) return;

          const payload: Record<string, unknown> = {
            taskId: data.taskId,
            toolName: data.toolName,
            toolCallId: data.toolCallId,
            agentId: data.agentId,
            runId: data.runId,
          };

          switch (event.type) {
            case 'task.running':
              payload.startedAt = data.startedAt;
              payload.args = data.args;
              break;
            case 'task.completed':
              payload.completedAt = data.completedAt;
              payload.result = data.result;
              break;
            case 'task.failed':
              payload.completedAt = data.completedAt;
              payload.error = data.error;
              break;
            case 'task.cancelled':
              payload.completedAt = data.completedAt;
              break;
            case 'task.output':
              payload.payload = data.chunk;
              break;
            case 'task.suspended':
              payload.suspendPayload = data.suspendPayload;
              payload.suspendedAt = data.suspendedAt;
              payload.args = data.args;
              break;
            case 'task.resumed':
              payload.startedAt = data.startedAt;
              payload.args = data.args;
              break;
          }

          try {
            controller.enqueue({
              type: CHUNK_EVENT_MAP[event.type],
              payload,
            });
          } catch {
            // Controller closed
          }
        };

        void pubsub.subscribe(TOPIC_RESULT, handler);

        abortSignal?.addEventListener('abort', () => {
          void pubsub.unsubscribe(TOPIC_RESULT, handler);
          try {
            controller.close();
          } catch {
            // Already closed
          }
        });

        // 2. Emit snapshot of existing in-flight tasks (running + suspended).
        try {
          const storage = await manager.getStorage();
          if (taskId) {
            const task = await storage.getTask(taskId);
            if (task && task.status === 'running') {
              controller.enqueue({
                type: 'background-task-running',
                payload: {
                  taskId: task.id,
                  toolName: task.toolName,
                  toolCallId: task.toolCallId,
                  agentId: task.agentId,
                  runId: task.runId,
                  startedAt: task.startedAt,
                  args: task.args,
                },
              });
            }
          } else {
            const { tasks: existing } = await storage.listTasks({
              agentId,
              runId,
              threadId,
              resourceId,
              status: ['running'],
            });

            for (const task of existing) {
              if (abortSignal?.aborted) break;
              try {
                controller.enqueue({
                  type: 'background-task-running',
                  payload: {
                    taskId: task.id,
                    toolName: task.toolName,
                    toolCallId: task.toolCallId,
                    agentId: task.agentId,
                    runId: task.runId,
                    startedAt: task.startedAt,
                    args: task.args,
                  },
                });
              } catch {
                break;
              }
            }
          }
        } catch {
          // Storage not available — continue with live events only
        }
      },
    });
  }

  async shutdown(): Promise<void> {
    this.shuttingDown = true;

    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = undefined;
    }

    if (this.workerCallback) {
      await this.pubsub.unsubscribe(TOPIC_DISPATCH, this.workerCallback);
    }
    if (this.resultCallback) {
      await this.pubsub.unsubscribe(TOPIC_RESULT, this.resultCallback);
    }

    this.taskContexts.clear();
    await this.pubsub.flush();
  }

  // --- Internal ---

  private async dispatch(task: BackgroundTask): Promise<void> {
    // Publish `task.dispatch` on `TOPIC_DISPATCH` with `WORKER_GROUP`, so
    // exactly one worker handles the task. `handleDispatch` flips the
    // task to running and starts the per-task workflow run.
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
        runId: task.runId,
      },
      runId: task.id,
    });
  }

  /**
   * Handles a task.dispatch event. Returns true if the message was nacked (for retry).
   */
  private async handleDispatch(event: Event): Promise<boolean> {
    const { taskId } = event.data;
    const deliveryAttempt = event.deliveryAttempt ?? 1;
    let nacked = false;

    const storage = await this.getStorage();
    const task = await storage.getTask(taskId);
    if (!task || task.status === 'cancelled') {
      this.deregisterTaskContext(taskId);
      return false;
    }

    await storage.updateTask(taskId, { status: 'running', startedAt: new Date(), retryCount: deliveryAttempt - 1 });

    // Publish running lifecycle event (fan-out, for stream consumers)
    const runningTask = await storage.getTask(taskId);
    if (runningTask) await this.publishLifecycleEvent('task.running', runningTask);

    // Fire-and-forget the workflow run; the workflow step body owns
    // executor invocation, retries, and suspend/resume. The local
    // execution hook still runs here so callers see `onExecution` fire.
    if (this.#mastra) {
      if (runningTask) void this.runLocalExecutionHook(runningTask);
      const workflow = this.#mastra.__getInternalWorkflow(BACKGROUND_TASK_WORKFLOW_ID);
      const run = await workflow.createRun({ runId: taskId });
      void run
        .start({ inputData: { taskId } })
        .then(result => {
          if (result.status !== 'suspended') {
            void workflow.deleteWorkflowRunById(taskId);
          }
        })
        .catch(err => {
          this.#mastra?.getLogger?.()?.error(`background-task workflow start failed for ${taskId}:`, err);
        })
        .finally(() => {
          // Free the concurrency slot once the run terminates.
          void this.drainPending();
        });
    }

    return nacked;
  }

  /**
   * Handles a task.resume event. Mirrors the workflow branch of handleDispatch
   * but resumes an existing run from its suspended snapshot instead of starting
   * a fresh one. Concurrency gating, suspended-status validation, and the
   * `task.resumed` lifecycle publish all happen here so a different process
   * than the one that suspended the task can drive the resume.
   */
  private async handleResume(event: Event): Promise<void> {
    const { taskId, resumeData } = event.data;

    const storage = await this.getStorage();
    const task = await storage.getTask(taskId);
    if (!task || task.status !== 'suspended') {
      // Either gone or already resumed/cancelled by another worker. Drop the
      // event silently — the worker group ensures exactly-once delivery, but
      // the task may have moved on between publish and pickup.
      return;
    }

    await storage.updateTask(taskId, {
      status: 'running',
      startedAt: new Date(),
      suspendPayload: undefined,
      suspendedAt: undefined,
    });
    const resumedTask = await storage.getTask(taskId);
    if (resumedTask) {
      await this.publishLifecycleEvent('task.resumed', resumedTask);
    }

    if (!this.#mastra) return;
    const workflow = this.#mastra.__getInternalWorkflow(BACKGROUND_TASK_WORKFLOW_ID);
    // `createRun({ runId })` reattaches to the existing snapshot when given a
    // stable runId — we don't want a fresh run.
    const run = await workflow.createRun({ runId: taskId });
    void run
      .resume({ resumeData })
      .then(result => {
        if (result.status !== 'suspended') {
          void workflow.deleteWorkflowRunById(taskId);
        }
      })
      .catch(err => {
        this.#mastra?.getLogger?.()?.error(`background-task workflow resume failed for ${taskId}:`, err);
      })
      .finally(() => {
        // Mirror dispatch's drain — resuming frees a slot when it terminates.
        void this.drainPending();
      });
  }

  /**
   * Run per-task hooks (onChunk, onResult, onComplete/onFailed) locally in the
   * worker path, before publishing the terminal lifecycle event. Ensures
   * memory / stream state is consistent by the time any pubsub subscriber is
   * notified. After running, the task context is deregistered so
   * `handleResult` (which also fires from pubsub) becomes a no-op for this
   * task in the same process.
   *
   * In distributed deployments where the worker runs in a different process
   * from the dispatcher, `this.taskContexts` won't contain an entry for
   * `task.id` — this method is a no-op there, and `handleResult` in the
   * dispatching process runs the hooks instead.
   */
  /**
   * Terminal-state hooks only. Called when a task reaches `'completed'` or
   * `'failed'`. Suspend is non-terminal — see `runLocalSuspendHooks` for that
   * path.
   *
   * @internal — also called by the workflow-engine step bodies in workflow.ts
   */
  async runLocalCompletionHooks(
    task: BackgroundTask,
    status: 'completed' | 'failed',
    extras: { result?: unknown; error?: { message: string; stack?: string } },
  ): Promise<void> {
    const ctx = this.taskContexts.get(task.id);
    if (!ctx) return;

    try {
      if (status === 'completed') {
        ctx.onChunk?.({
          type: 'background-task-completed',
          payload: {
            taskId: task.id,
            toolName: task.toolName,
            toolCallId: task.toolCallId,
            runId: task.runId,
            result: extras.result,
            completedAt: task.completedAt!,
            agentId: task.agentId,
          },
        });

        await ctx.onResult?.({
          runId: task.runId,
          taskId: task.id,
          toolCallId: task.toolCallId,
          toolName: task.toolName,
          agentId: task.agentId,
          threadId: task.threadId,
          resourceId: task.resourceId,
          result: extras.result,
          status: 'completed',
          completedAt: task.completedAt!,
          startedAt: task.startedAt!,
        });

        // Globals (this.config.onTaskComplete / onTaskFailed) fire from
        // handleResult via pubsub so they run once per subscribing process
        // — in distributed deployments that's the dispatching process, which
        // is where observers/metrics are typically wired.
        await ctx.onComplete?.(task);
      } else {
        ctx.onChunk?.({
          type: 'background-task-failed',
          payload: {
            taskId: task.id,
            toolName: task.toolName,
            toolCallId: task.toolCallId,
            runId: task.runId,
            error: extras.error ?? { message: 'Unknown error' },
            completedAt: task.completedAt!,
            agentId: task.agentId,
          },
        });

        await ctx.onResult?.({
          runId: task.runId,
          taskId: task.id,
          toolCallId: task.toolCallId,
          toolName: task.toolName,
          agentId: task.agentId,
          threadId: task.threadId,
          resourceId: task.resourceId,
          error: extras.error,
          status: 'failed',
          completedAt: task.completedAt!,
          startedAt: task.startedAt!,
        });

        // See comment above — globals are handled exclusively by
        // handleResult so they fire once per subscribing process.
        await ctx.onFailed?.(task);
      }
    } finally {
      this.deregisterTaskContext(task.id);
    }
  }

  /**
   * Per-task suspend hooks. Fires `ctx.onResult({ status: 'suspended', ... })`
   * so the message list / memory pick up the suspension as the tool's
   * current invocation state. Does NOT deregister the task context — resume
   * needs the executor closure intact.
   *
   * @internal — called by the workflow-engine step bodies in workflow.ts
   */
  async runLocalSuspendHooks(task: BackgroundTask): Promise<void> {
    const ctx = this.taskContexts.get(task.id);
    if (!ctx) return;
    await ctx.onExecution?.({
      runId: task.runId,
      taskId: task.id,
      toolCallId: task.toolCallId,
      toolName: task.toolName,
      agentId: task.agentId,
      threadId: task.threadId,
      resourceId: task.resourceId,
      startedAt: task.startedAt!,
      suspendedAt: task.suspendedAt,
    });
  }

  /** @internal — also called by the workflow-engine step bodies in workflow.ts */
  async runLocalExecutionHook(task: BackgroundTask): Promise<void> {
    const ctx = this.taskContexts.get(task.id);
    if (!ctx) return;

    try {
      await ctx.onExecution?.({
        runId: task.runId,
        taskId: task.id,
        toolCallId: task.toolCallId,
        toolName: task.toolName,
        agentId: task.agentId,
        threadId: task.threadId,
        resourceId: task.resourceId,
        startedAt: task.startedAt!,
      });
    } catch {
      //fail silently
    }
  }

  private async handleResult(event: Event): Promise<void> {
    const { taskId, toolName, toolCallId, threadId, resourceId, runId } = event.data;
    const storage = await this.getStorage();
    const task = await storage.getTask(taskId);

    if (task?.completedAt) {
      // Look up per-task hooks
      const ctx = this.taskContexts.get(taskId);

      if (event.type === 'task.completed') {
        ctx?.onChunk?.({
          type: 'background-task-completed',
          payload: {
            taskId,
            toolName,
            toolCallId,
            runId,
            result: event.data.result,
            completedAt: task.completedAt,
            agentId: task.agentId,
          },
        });

        await ctx?.onResult?.({
          runId,
          taskId,
          toolCallId,
          toolName,
          agentId: event.data.agentId,
          threadId,
          resourceId,
          result: event.data.result,
          status: 'completed',
          completedAt: task.completedAt!,
          startedAt: task.startedAt!,
        });

        if (task) {
          await Promise.all([ctx?.onComplete?.(task), this.config.onTaskComplete?.(task)]);
        }
      }

      if (event.type === 'task.failed') {
        ctx?.onChunk?.({
          type: 'background-task-failed',
          payload: {
            taskId,
            toolName,
            toolCallId,
            runId,
            error: event.data.error,
            completedAt: task.completedAt,
            agentId: task.agentId,
          },
        });

        await ctx?.onResult?.({
          runId,
          taskId,
          toolCallId,
          toolName,
          agentId: event.data.agentId,
          threadId,
          resourceId,
          error: event.data.error,
          status: 'failed',
          completedAt: task.completedAt!,
          startedAt: task.startedAt!,
        });

        if (task) {
          await Promise.all([ctx?.onFailed?.(task), this.config.onTaskFailed?.(task)]);
        }
      }

      // Clean up context after terminal result
      this.deregisterTaskContext(taskId);
    }
  }

  private handleCancel(event: Event): void {
    const { taskId } = event.data;
    const controller = this.activeAbortControllers.get(taskId);
    if (controller) {
      controller.abort(new Error('Task cancelled'));
      this.activeAbortControllers.delete(taskId);
    }
    this.deregisterTaskContext(taskId);
  }

  /** @internal — also called by the workflow-engine step bodies in workflow.ts */
  async publishLifecycleEvent(
    type:
      | 'task.running'
      | 'task.completed'
      | 'task.failed'
      | 'task.cancelled'
      | 'task.output'
      | 'task.suspended'
      | 'task.resumed',
    task: BackgroundTaskEvent,
  ): Promise<void> {
    await this.pubsub.publish(TOPIC_RESULT, {
      type,
      data: {
        taskId: task.id,
        toolName: task.toolName,
        toolCallId: task.toolCallId,
        runId: task.runId,
        agentId: task.agentId,
        threadId: task.threadId,
        resourceId: task.resourceId,
        args: task.args,
        result: task.result,
        error: task.error,
        chunk: task.chunk,
        completedAt: task.completedAt,
        startedAt: task.startedAt,
        suspendPayload: task.suspendPayload,
        suspendedAt: task.suspendedAt,
      },
      runId: task.id,
    });
  }

  private async checkConcurrency(agentId: string): Promise<boolean> {
    const storage = await this.getStorage();
    const globalRunning = await storage.getRunningCount();
    if (globalRunning >= this.config.globalConcurrency) {
      return false;
    }

    const agentRunning = await storage.getRunningCountByAgent(agentId);
    if (agentRunning >= this.config.perAgentConcurrency) {
      return false;
    }

    return true;
  }

  private async drainPending(): Promise<void> {
    const storage = await this.getStorage();
    const { tasks: pending } = await storage.listTasks({
      status: 'pending',
      orderBy: 'createdAt',
      orderDirection: 'asc',
    });

    for (const task of pending) {
      if (await this.checkConcurrency(task.agentId)) {
        await this.dispatch(task);
      }
    }
  }

  /**
   * Recovers tasks left in 'running' or 'pending' state from a previous process.
   */
  private async recoverStaleTasks(): Promise<void> {
    try {
      const storage = await this.getStorage();
      const { tasks: staleTasks } = await storage.listTasks({ status: 'running' });
      for (const task of staleTasks) {
        if (task.maxRetries > 0) {
          await storage.updateTask(task.id, {
            status: 'pending',
            startedAt: undefined,
          });
        } else {
          await storage.updateTask(task.id, {
            status: 'failed',
            error: { message: 'Worker process terminated before task completed' },
            completedAt: new Date(),
          });
        }
      }

      const { tasks: pendingTasks } = await storage.listTasks({
        status: 'pending',
        orderBy: 'createdAt',
        orderDirection: 'asc',
      });
      for (const task of pendingTasks) {
        if (await this.checkConcurrency(task.agentId)) {
          await this.dispatch(task);
        }
      }
    } catch (error) {
      const logger = this.#mastra?.getLogger();
      if (logger) {
        logger.error('Failed to recover stale background tasks', error);
      }
    }
  }
}
