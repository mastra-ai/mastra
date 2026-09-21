import { AsyncLocalStorage } from 'node:async_hooks';
import { randomUUID } from 'node:crypto';
import type { Mastra } from '..';
import type { PubSub } from '../events/pubsub';
import type { Event, EventCallback } from '../events/types';
import { BACKGROUND_TASK_SHUTDOWN_ABORT_MESSAGE } from './shutdown';
import { BACKGROUND_TASK_REQUIRES_PERMISSION_HOOK_KEY } from './types';
import type {
  BackgroundTask,
  BackgroundTaskManagerConfig,
  BackgroundTaskResumeOptions,
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
const RECOVERY_ERROR_RETRY_MS = 60_000;
const SHUTDOWN_GRACE_PERIOD_MS = 5_000;

const isTerminalBackgroundTaskStatus = (status: BackgroundTaskStatus) =>
  status === 'completed' || status === 'failed' || status === 'cancelled' || status === 'timed_out';

type ExecutionAncestryFrame = Readonly<{
  taskId: string;
  agentId: string;
}>;
type ExecutionAncestry = readonly ExecutionAncestryFrame[];

type ResumeAdmissionWaiter = {
  taskId: string;
  eventId: string;
  context: TaskContext;
  reservationAgentId?: string;
  admitted: boolean;
  superseded: boolean;
  admissionSettled: boolean;
  callerSettled: boolean;
  publicationSettled: boolean;
  failureCleanupComplete: boolean;
  promise: Promise<void>;
  resolve: () => void;
  reject: (reason?: unknown) => void;
  failureCleanupPromise?: Promise<void>;
};

type InFlightEnqueueAdmission = {
  taskId: string;
  admitted: boolean;
};

class BackgroundTaskResumeAdmissionError extends Error {
  readonly cause: unknown;

  constructor(cause: unknown) {
    super(cause instanceof Error ? cause.message : String(cause));
    this.name = 'BackgroundTaskResumeAdmissionError';
    this.cause = cause;
  }
}

export const isBackgroundTaskResumePublishedError = (error: unknown): boolean =>
  error instanceof BackgroundTaskResumeAdmissionError;

const markResumeAdmissionPublished = (error: unknown): Error =>
  error instanceof BackgroundTaskResumeAdmissionError ? error : new BackgroundTaskResumeAdmissionError(error);

const freezeExecutionAncestry = (ancestry: readonly ExecutionAncestryFrame[]): ExecutionAncestry =>
  Object.freeze(ancestry.map(frame => Object.freeze({ taskId: frame.taskId, agentId: frame.agentId })));

const isWaitComplete = (task: BackgroundTask | null, includeSuspended = false): task is BackgroundTask =>
  Boolean(task && (isTerminalBackgroundTaskStatus(task.status) || (includeSuspended && task.status === 'suspended')));

const createUnrecoverableTaskError = (task: BackgroundTask): { message: string } => ({
  message:
    `Background task "${task.id}" for tool "${task.toolName}" could not be recovered after restart because ` +
    `no local task context or registered static executor is available. Closure-backed tasks must stay behind ` +
    `an owning durable Harness row that can retry or repair the work.`,
});

export class BackgroundTaskManager {
  private pubsub!: PubSub;
  private readonly workerId = randomUUID();
  private readonly processAffineDispatchTopic = `${TOPIC_DISPATCH}:${this.workerId}`;
  config: Required<
    Pick<
      BackgroundTaskManagerConfig,
      'globalConcurrency' | 'perAgentConcurrency' | 'backpressure' | 'defaultTimeoutMs' | 'recoverStaleTasksOnStart'
    >
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

  // The current task ancestry is process-local execution context. It is never
  // persisted: the task-id map below retains it only while an invocation-bound
  // task can resume in this manager.
  private readonly executionAncestry = new AsyncLocalStorage<ExecutionAncestry>();
  private taskAncestries = new Map<string, ExecutionAncestry>();

  // Track active AbortControllers for running tasks (for cancellation + timeout)
  /** @internal — read by the workflow-engine step bodies in workflow.ts */
  activeAbortControllers: Map<string, AbortController> = new Map();

  // Process-affine executors are runtime closures and cannot participate in
  // storage-wide concurrency accounting without persisted ownership/leases.
  // Keep their admission and queue ownership local to the manager that owns
  // the closure so abandoned rows from another process cannot block them.
  // TODO: Replace this POC boundary with persisted ownership, leases,
  // heartbeats, atomic claims, and fenced terminal writes before treating
  // process-affine work as recoverable across worker crashes.
  private localReservations = new Map<string, string>();
  private localPendingTaskIds = new Set<string>();
  private localReleaseEpoch = 0;
  private taskReleaseEpochs = new Map<string, number>();
  private inFlightEnqueueAdmissions = new Map<string, InFlightEnqueueAdmission>();
  private drainingPending = false;

  // Pubsub callbacks (kept for unsubscribe)
  private workerCallback?: EventCallback;
  private resultCallback?: EventCallback;
  private resumeAdmissionWaiters = new Map<string, Set<ResumeAdmissionWaiter>>();

  private shuttingDown = false;

  // Cleanup interval handle
  private cleanupInterval?: ReturnType<typeof setInterval>;
  private recoveryTimer?: ReturnType<typeof setTimeout>;
  private recoveryTimerAt?: number;

  // Tracks the in-flight `init(pubsub)` so consumers can await readiness.
  // Mastra fires init as fire-and-forget in `#ensureBackgroundTaskManager`,
  // so without this any caller that hits `enqueue`/`resume`/`cancel`
  // before init completes races against worker subscription + workflow
  // registration. Public methods that depend on init await this promise
  // before doing work.
  private initPromise?: Promise<void>;

  // Serializes teardown and makes repeated shutdown calls safe. Shutdown may
  // race the constructor-owned, fire-and-forget init path, so cleanup must not
  // run until initialization has either completed or failed.
  private shutdownPromise?: Promise<void>;

  // Wall-clock deadline shared by every step of the teardown sequence. Set once
  // when shutdown begins; steps that start after it has passed fire their
  // cleanup without blocking on it.
  private shutdownDeadline?: number;

  constructor(config: BackgroundTaskManagerConfig = { enabled: false }) {
    this.config = {
      ...config,
      globalConcurrency: config.globalConcurrency ?? 10,
      perAgentConcurrency: config.perAgentConcurrency ?? 5,
      backpressure: config.backpressure ?? 'queue',
      defaultTimeoutMs: config.defaultTimeoutMs ?? 300_000,
      recoverStaleTasksOnStart: config.recoverStaleTasksOnStart ?? true,
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
    if (this.shuttingDown) {
      throw new Error('BackgroundTaskManager is shutting down, cannot initialize');
    }
    if (this.initPromise) return this.initPromise;
    this.initPromise = this.#doInit(pubsub);
    return this.initPromise;
  }

  async #doInit(pubsub: PubSub): Promise<void> {
    this.pubsub = pubsub;

    const isProducerOnly = this.config.mode === 'producer';

    // Result listener: fan-out so all processes receive results.
    // Both producer and worker modes need this — the producer uses it
    // to receive completion/failure notifications for dispatched tasks.
    this.resultCallback = async (event: Event, ack?: () => Promise<void>) => {
      if (event.type === 'task.completed' || event.type === 'task.failed') {
        try {
          await this.handleResult(event);
        } finally {
          await ack?.();
        }
        return;
      } else if (event.type === 'task.cancelled') {
        this.handleCancel(event);
      }
      await ack?.();
    };

    if (!isProducerOnly) {
      // Worker: subscribes with group so only one worker processes each task.
      this.workerCallback = async (event: Event, ack?: () => Promise<void>) => {
        // A grouped delivery consumed while this process is shutting down must
        // remain unacked so a durable broker can redeliver it to a live worker.
        if (this.shuttingDown) return;

        let handled = true;
        if (event.type === 'task.dispatch' || event.type === 'task.restart') {
          handled = await this.handleDispatch(event);
        } else if (event.type === 'task.resume') {
          try {
            handled = await this.handleResume(event);
          } catch (error) {
            this.rejectResumeAdmission(event.data.taskId, event.id, error);
            throw error;
          }
        } else if (event.type === 'task.cancel') {
          this.handleCancel(event);
        }
        if (handled) await ack?.();
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
      await this.pubsub.subscribe(this.processAffineDispatchTopic, this.workerCallback);

      if (this.shuttingDown) {
        await this.#releaseLateInitSubscriptions([
          [TOPIC_DISPATCH, this.workerCallback],
          [this.processAffineDispatchTopic, this.workerCallback],
        ]);
        return;
      }
    }

    await this.pubsub.subscribe(TOPIC_RESULT, this.resultCallback);
    if (this.shuttingDown) {
      // Producer mode never registers a worker callback, so only include the
      // dispatch subscriptions when they actually exist.
      const lateSubscriptions: Array<[string, EventCallback]> = [];
      if (this.workerCallback) {
        lateSubscriptions.push([TOPIC_DISPATCH, this.workerCallback]);
        lateSubscriptions.push([this.processAffineDispatchTopic, this.workerCallback]);
      }
      lateSubscriptions.push([TOPIC_RESULT, this.resultCallback]);
      await this.#releaseLateInitSubscriptions(lateSubscriptions);
      return;
    }

    if (this.shuttingDown) return;

    if (!isProducerOnly && this.config.recoverStaleTasksOnStart) {
      // Recover stale tasks from a previous process — only workers should
      // attempt recovery since they own execution.
      await this.recoverStaleTasks();
    }

    if (this.shuttingDown) return;
    // Start periodic cleanup if configured
    const cleanupConfig = this.config.cleanup;
    if (cleanupConfig && !this.shuttingDown) {
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
    this.taskAncestries.delete(taskId);
    this.taskReleaseEpochs.delete(taskId);
  }

  private async cleanupFailedEnqueueRegistration(
    storage: Awaited<ReturnType<BackgroundTaskManager['getStorage']>>,
    taskId: string,
    capturedAncestry: ExecutionAncestry,
    context?: TaskContext,
  ): Promise<void> {
    try {
      if (await storage.getTask(taskId)) return;
      if (this.taskAncestries.get(taskId) !== capturedAncestry) return;
      if (context ? this.taskContexts.get(taskId) !== context : this.taskContexts.has(taskId)) return;
      if (this.localReservations.has(taskId) || this.activeAbortControllers.has(taskId)) return;

      if (context) this.deregisterTaskContext(taskId);
      else this.taskAncestries.delete(taskId);
    } catch {
      // A storage read failure leaves the registration in place so a committed
      // row or a later recovery can still find its invocation-bound executor.
    }
  }

  /** @internal — wraps a native task executor with its captured ancestry. */
  runWithTaskExecutionContext<T>(taskId: string, agentId: string, execute: () => Promise<T>): Promise<T> {
    const ancestry = this.taskAncestries.get(taskId) ?? [];
    return this.executionAncestry.run(freezeExecutionAncestry([...ancestry, { taskId, agentId }]), execute);
  }

  /** @internal — called by the workflow step immediately before executor invocation. */
  registerActiveAbortController(taskId: string, controller: AbortController): boolean {
    if (this.shuttingDown) {
      controller.abort(new Error(BACKGROUND_TASK_SHUTDOWN_ABORT_MESSAGE));
      return false;
    }
    this.activeAbortControllers.set(taskId, controller);
    return true;
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
   * `workflow.ts:runAttemptStep` as a fallback when no per-task `TaskContext`
   * is registered (cross-process path).
   */
  getStaticExecutor(toolName: string): ToolExecutor | undefined {
    return this.staticExecutors.get(toolName);
  }

  /** @internal — read by workflow step bodies before starting local execution. */
  isShuttingDown(): boolean {
    return this.shuttingDown;
  }

  private canResolveTaskExecutor(task: BackgroundTask): boolean {
    return (
      this.taskContexts.has(task.id) ||
      (task.agentId ? this.staticExecutors.has(`${task.agentId}:${task.toolName}`) : false) ||
      this.staticExecutors.has(task.toolName)
    );
  }

  private isRunningTaskExpired(task: BackgroundTask, now: Date): boolean {
    if (!task.startedAt) return true;
    const expiresAt = task.startedAt.getTime() + task.timeoutMs;
    return Number.isFinite(expiresAt) && expiresAt <= now.getTime();
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

    // Capture before the first asynchronous storage/pubsub boundary. The
    // workflow later reconstructs the current task context from this map when
    // it invokes the native executor.
    const capturedAncestry = freezeExecutionAncestry(this.executionAncestry.getStore() ?? []);

    // Mastra fires `init` as fire-and-forget. If a caller hits enqueue
    // before init completes, the dispatch publish fires before the worker
    // subscribes and the event is dropped (or, worse, lands on a worker
    // whose Mastra hasn't yet registered the bg-task workflow → "Workflow
    // with id __background-task not found"). Await readiness up front.
    if (this.initPromise) await this.initPromise;
    if (this.shuttingDown) {
      throw new Error('BackgroundTaskManager is shutting down, cannot enqueue new tasks');
    }

    const task: BackgroundTask = {
      id: this.#mastra?.generateId() ?? randomUUID(),
      status: 'pending',
      toolName: payload.toolName,
      toolCallId: payload.toolCallId,
      // The hook requirement persists inside `args` — the only field every
      // store serializes verbatim — so a foreign worker or recovered run can
      // tell this call was authorization-gated. run-attempt strips the marker
      // before the executor sees the args.
      args: payload.requiresToolPermissionHook
        ? { ...payload.args, [BACKGROUND_TASK_REQUIRES_PERMISSION_HOOK_KEY]: true }
        : payload.args,
      agentId: payload.agentId,
      threadId: payload.threadId,
      resourceId: payload.resourceId,
      runId: payload.runId,
      retryCount: 0,
      maxRetries: payload.maxRetries ?? this.config.defaultRetries?.maxRetries ?? 0,
      timeoutMs: payload.timeoutMs ?? this.config.defaultTimeoutMs,
      createdAt: new Date(),
    };
    const storage = await this.getStorage();
    if (this.shuttingDown) {
      throw new Error('BackgroundTaskManager is shutting down, cannot enqueue new tasks');
    }

    this.taskAncestries.set(task.id, capturedAncestry);

    // Register per-task context before the row is committed so a worker that
    // observes the row during a slow create can still resolve the invocation
    // bound executor.
    if (context) {
      this.registerTaskContext(task.id, context);
    }

    const enqueueAdmission: InFlightEnqueueAdmission = { taskId: task.id, admitted: false };
    this.inFlightEnqueueAdmissions.set(task.id, enqueueAdmission);
    try {
      await storage.createTask(task);
    } catch (error) {
      // Storage adapters may have committed the row before rejecting. Return
      // the adapter's original error promptly and clean up only after an
      // authoritative absence check.
      void this.cleanupFailedEnqueueRegistration(storage, task.id, capturedAncestry, context);
      throw error;
    } finally {
      if (this.inFlightEnqueueAdmissions.get(task.id) === enqueueAdmission) {
        this.inFlightEnqueueAdmissions.delete(task.id);
      }
    }
    if (this.shuttingDown) {
      // Preserve the established enqueue rejection once shutdown begins. A
      // recovery worker may already own this row, so only an unclaimed create
      // can be rolled back safely here.
      if (!enqueueAdmission.admitted) {
        await storage.deleteTask(task.id);
        this.deregisterTaskContext(task.id);
      }
      throw new Error('BackgroundTaskManager is shutting down, cannot enqueue new tasks');
    }
    if (enqueueAdmission.admitted) {
      return { task };
    }

    const isProcessAffine = Boolean(context);
    const canRun = isProcessAffine ? this.reserveLocalSlot(task) : await this.checkConcurrency(task.agentId);

    if (this.shuttingDown) {
      this.releaseLocalSlot(task.id);
      this.deregisterTaskContext(task.id);
      await storage.deleteTask(task.id);
      throw new Error('BackgroundTaskManager is shutting down, cannot enqueue new tasks');
    }

    if (canRun) {
      try {
        const dispatched = await this.dispatch(task);
        if (!dispatched) {
          this.releaseLocalSlot(task.id);
          this.deregisterTaskContext(task.id);
          await storage.deleteTask(task.id);
          throw new Error('BackgroundTaskManager is shutting down, cannot enqueue new tasks');
        }
      } catch (error) {
        const failed = await storage.updateTask(
          task.id,
          {
            status: 'failed',
            error: { message: error instanceof Error ? error.message : String(error) },
            completedAt: new Date(),
          },
          { expectedStatus: 'pending' },
        );
        if (failed) {
          this.releaseLocalSlot(task.id);
          this.deregisterTaskContext(task.id);
          void this.drainPending();
        }
        throw error;
      }
      return { task };
    }

    // A queued awaited child cannot make progress while one of its actual
    // ancestors owns the saturated local reservation. Drop the temporary
    // row and let the caller run the same tool inline, preserving the
    // ancestor's reservation. Unrelated queued work and capacity available
    // for a nested dispatch retain their existing behavior.
    if (
      this.config.backpressure === 'queue' &&
      context?.awaited &&
      this.isAwaitedNestedDispatchBlockedByAncestor(task)
    ) {
      this.deregisterTaskContext(task.id);
      await storage.deleteTask(task.id);
      return { task, fallbackToSync: true };
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
        // Queue ownership stays local. A persisted pending row does not carry
        // enough information to distinguish an invocation-bound closure from
        // a portable static executor in another process.
        this.localPendingTaskIds.add(task.id);
        return { task };
    }
  }

  async cancel(taskId: string): Promise<void> {
    if (this.initPromise) await this.initPromise;
    const storage = await this.getStorage();
    let task = await storage.getTask(taskId);
    if (!task) {
      throw new Error(`Task not found: ${taskId}`);
    }

    while (true) {
      if (
        task.status === 'completed' ||
        task.status === 'failed' ||
        task.status === 'cancelled' ||
        task.status === 'timed_out'
      ) {
        return; // no-op for terminal states
      }

      const previousStatus = task.status;
      const isProcessAffine = this.taskContexts.has(taskId);
      const cancelled = await storage.updateTask(
        taskId,
        { status: 'cancelled', completedAt: new Date() },
        { expectedStatus: previousStatus },
      );
      if (!cancelled) {
        task = await storage.getTask(taskId);
        if (!task) return;
        continue;
      }

      this.rejectResumeAdmissions(taskId, new Error(`Background task ${taskId} was cancelled before resume admission`));

      if (previousStatus === 'pending') {
        this.localPendingTaskIds.delete(taskId);
        this.releaseLocalSlot(taskId);
      }

      if (previousStatus === 'running') {
        // Abort the running tool
        const controller = this.activeAbortControllers.get(taskId);
        if (controller) {
          controller.abort(new Error('Task cancelled'));
          this.activeAbortControllers.delete(taskId);
        }
      }

      if (previousStatus === 'running' || previousStatus === 'suspended') {
        // Cancel the workflow run so workflow storage reflects the
        // cancellation and any stored suspended snapshot is cleaned up.
        if (this.#mastra) {
          try {
            const workflow = this.#mastra.__getInternalWorkflow(BACKGROUND_TASK_WORKFLOW_ID);
            const wrapper = await workflow.createRun({ runId: taskId });
            await wrapper.cancel();
          } catch (err) {
            this.#mastra?.getLogger?.()?.warn(`background-task workflow cancel failed for ${taskId}:`, err as any);
          }
        }
      }

      const cancelledTask = await storage.getTask(taskId);
      if (cancelledTask) {
        await this.publishLifecycleEvent('task.cancelled', cancelledTask);
        try {
          await this.config.onTaskCancelled?.(cancelledTask);
        } catch (error) {
          this.#mastra
            ?.getLogger?.()
            ?.warn(`background-task cancellation callback failed for ${taskId}:`, error as any);
        }
      }
      this.deregisterTaskContext(taskId);

      if (previousStatus === 'running') {
        // Route cancellation to the same process that owns an invocation-bound executor.
        const dispatchTopic = isProcessAffine ? this.processAffineDispatchTopic : TOPIC_DISPATCH;
        await this.pubsub.publish(dispatchTopic, {
          type: 'task.cancel',
          data: { taskId },
          runId: taskId,
        });
      }
      return;
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
  async resume(taskId: string, resumeData?: unknown, options?: BackgroundTaskResumeOptions): Promise<BackgroundTask> {
    if (this.shuttingDown) {
      throw new Error('BackgroundTaskManager is shutting down, cannot resume tasks');
    }
    if (!this.#mastra) {
      throw new Error('Mastra is not registered with this manager');
    }

    if (this.initPromise) await this.initPromise;
    if (this.shuttingDown) {
      throw new Error('BackgroundTaskManager is shutting down, cannot resume tasks');
    }

    const storage = await this.getStorage();
    if (this.shuttingDown) {
      throw new Error('BackgroundTaskManager is shutting down, cannot resume tasks');
    }

    const task = await storage.getTask(taskId);
    if (this.shuttingDown) {
      throw new Error('BackgroundTaskManager is shutting down, cannot resume tasks');
    }
    if (!task) {
      throw new Error(`Task not found: ${taskId}`);
    }
    if (task.status !== 'suspended') {
      throw new Error(`Cannot resume task in status '${task.status}' (expected 'suspended')`);
    }

    const isProcessAffine = this.taskContexts.has(taskId);
    if (options?.waitForAdmission && !isProcessAffine) {
      throw new Error('waitForAdmission is only supported for process-affine background tasks');
    }
    const canRun = isProcessAffine ? this.reserveLocalSlot(task) : await this.checkConcurrency(task.agentId);
    if (this.shuttingDown) {
      this.releaseLocalSlot(taskId);
      throw new Error('BackgroundTaskManager is shutting down, cannot resume tasks');
    }
    if (!canRun) {
      // Resume sits outside the queue/fallback-sync paths — there's no
      // synchronous caller to fall back to, and silently leaving the task
      // suspended hides the failure from the caller. Throw and let the
      // caller retry once a slot frees.
      throw new Error(`Concurrency limit reached, cannot resume task "${taskId}" — retry once a slot is available`);
    }

    // Resume publishes directly (not via dispatch()), so it needs its own
    // lazy worker start for the library-mode process-restart case.
    await this.#ensureExecutionWorkersStarted();
    if (this.shuttingDown) {
      throw new Error('BackgroundTaskManager is shutting down, cannot resume tasks');
    }

    // Resume invocation-bound executors on their owning manager. A task
    // without local context remains portable through the shared worker group.
    const dispatchTopic = isProcessAffine ? this.processAffineDispatchTopic : TOPIC_DISPATCH;
    if (options?.waitForAdmission && options.abortSignal?.aborted) {
      this.releaseLocalSlot(taskId);
      throw options.abortSignal.reason ?? new Error('Background task resume admission aborted');
    }
    const resumeEvent = {
      id: randomUUID(),
      type: 'task.resume' as const,
      data: { taskId, resumeData },
      runId: taskId,
    };
    const resumeAdmission = isProcessAffine
      ? this.waitForResumeAdmission(
          taskId,
          resumeEvent.id,
          task.timeoutMs,
          options?.waitForAdmission ? options.abortSignal : undefined,
          options?.waitForAdmission ?? false,
        )
      : undefined;
    const publicationState: {
      status: 'pending' | 'fulfilled' | 'rejected';
      error?: unknown;
    } = { status: 'pending' };
    let publicationPromise: Promise<void>;
    try {
      publicationPromise = this.pubsub.publish(dispatchTopic, resumeEvent).then(
        () => {
          publicationState.status = 'fulfilled';
          if (resumeAdmission) this.markResumePublicationSettled(resumeAdmission);
        },
        error => {
          publicationState.status = 'rejected';
          publicationState.error = error;
          if (resumeAdmission) this.markResumePublicationSettled(resumeAdmission, error, true);
          throw error;
        },
      );
    } catch (error) {
      publicationState.status = 'rejected';
      publicationState.error = error;
      if (resumeAdmission) this.markResumePublicationSettled(resumeAdmission, error, true);
      publicationPromise = Promise.reject(error);
    }
    if (!resumeAdmission || !options?.waitForAdmission) {
      try {
        await publicationPromise;
      } catch (error) {
        throw resumeAdmission ? markResumeAdmissionPublished(publicationState.error ?? error) : error;
      }
      return task;
    }

    void resumeAdmission.promise.catch(() => {});

    try {
      await Promise.all([publicationPromise, resumeAdmission.promise]);
    } catch (error) {
      if (publicationState.status === 'rejected' && !resumeAdmission.admitted && !resumeAdmission.superseded) {
        throw markResumeAdmissionPublished(publicationState.error ?? error);
      }

      throw markResumeAdmissionPublished(
        resumeAdmission.admitted || resumeAdmission.superseded ? (publicationState.error ?? error) : error,
      );
    }

    return task;
  }

  /**
   * Restarts a previously running task. The tool executor is re-registered via
   * `registerTaskContext(taskId, ...)` because the original
   * registration is gone (e.g. process restart) — the manager doesn't
   * rehydrate executor closures from storage.
   *
   */
  async restart(taskId: string, context?: TaskContext): Promise<BackgroundTask> {
    if (this.shuttingDown) {
      throw new Error('BackgroundTaskManager is shutting down, cannot restart tasks');
    }
    if (!this.#mastra) {
      throw new Error('Mastra is not registered with this manager');
    }

    if (this.initPromise) await this.initPromise;

    const storage = await this.getStorage();
    const task = await storage.getTask(taskId);
    if (!task) {
      throw new Error(`Task not found: ${taskId}`);
    }
    if (task.status !== 'running') {
      throw new Error(`Cannot restart task in status '${task.status}' (expected 'running')`);
    }

    if (context) {
      this.registerTaskContext(task.id, context);
    }

    const isProcessAffine = this.taskContexts.has(taskId);
    const canRun = isProcessAffine ? this.reserveLocalSlot(task) : await this.checkConcurrency(task.agentId);
    if (!canRun) {
      // Restart sits outside the queue/fallback-sync paths — there's no
      // synchronous caller to fall back to, and silently leaving the task
      // running hides the failure from the caller. Throw and let the
      // caller retry once a slot frees.
      throw new Error(`Concurrency limit reached, cannot restart task "${taskId}" — retry once a slot is available`);
    }

    try {
      await this.dispatch(task, true);
    } catch (error) {
      if (isProcessAffine) this.releaseLocalSlot(taskId);
      throw error;
    }

    return task;
  }

  /**
   * Persists the tool-permission-hook requirement onto an existing task's
   * stored args. `enqueue` folds the marker in at create time, but a handle
   * carrying `requiresToolPermissionHook` that attaches to a row it did not
   * create (resume/restart legs, or a row written before the marker existed)
   * must backfill it so a later cold recovery still fails closed instead of
   * executing without revalidation. Verifies the write by re-reading — a
   * store that cannot persist `args` updates throws so the caller refuses
   * the attach rather than leaving a claimable-but-unmarked row.
   */
  async markTaskRequiresToolPermissionHook(taskId: string): Promise<void> {
    const storage = await this.getStorage();
    const task = await storage.getTask(taskId);
    if (task?.args?.[BACKGROUND_TASK_REQUIRES_PERMISSION_HOOK_KEY] === true) return;
    // A null read is ambiguous — the row may be gone or the store may have
    // failed. The caller is attaching a permission requirement; skipping the
    // write would leave a claimable-but-unmarked row, so fail closed.
    if (!task) {
      throw new Error(`Cannot persist permission-hook requirement — background task "${taskId}" not found`);
    }
    await storage.updateTask(taskId, {
      args: { ...(task.args ?? {}), [BACKGROUND_TASK_REQUIRES_PERMISSION_HOOK_KEY]: true },
    });
    const persisted = await storage.getTask(taskId);
    if (!persisted || persisted.args?.[BACKGROUND_TASK_REQUIRES_PERMISSION_HOOK_KEY] !== true) {
      throw new Error(
        `Unable to persist permission-hook requirement on background task "${taskId}" — refusing to attach`,
      );
    }
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
      abortSignal?: AbortSignal;
      includeSuspended?: boolean;
    },
  ): Promise<BackgroundTask> {
    const storage = await this.getStorage();

    for (const id of taskIds) {
      const task = await storage.getTask(id);
      if (isWaitComplete(task, options?.includeSuspended)) {
        return task;
      }
    }

    return new Promise((resolve, reject) => {
      const startTime = Date.now();
      let timeout: ReturnType<typeof setTimeout> | undefined;
      let progressInterval: ReturnType<typeof setInterval> | undefined;
      let pollInterval: ReturnType<typeof setInterval> | undefined;

      const cleanup = () => {
        if (pollInterval) clearInterval(pollInterval);
        if (timeout !== undefined) clearTimeout(timeout);
        if (progressInterval) clearInterval(progressInterval);
        options?.abortSignal?.removeEventListener('abort', handleAbort);
      };
      const handleAbort = () => {
        cleanup();
        reject(options?.abortSignal?.reason ?? new Error('Background task wait aborted'));
      };

      if (options?.abortSignal?.aborted) {
        handleAbort();
        return;
      }
      options?.abortSignal?.addEventListener('abort', handleAbort, { once: true });

      timeout = options?.timeoutMs
        ? setTimeout(() => {
            cleanup();
            reject(new Error('Timed out waiting for background task'));
          }, options.timeoutMs)
        : undefined;

      progressInterval = options?.onProgress
        ? setInterval(() => {
            options.onProgress!(Date.now() - startTime);
          }, options.progressIntervalMs ?? 3000)
        : undefined;

      pollInterval = setInterval(async () => {
        for (const id of taskIds) {
          const task = await storage.getTask(id);
          if (isWaitComplete(task, options?.includeSuspended)) {
            cleanup();
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
    includeExisting?: boolean;
  }): ReadableStream<Record<string, unknown>> {
    const manager = this;
    const pubsub = this.pubsub;
    const { agentId, runId, threadId, resourceId, abortSignal, taskId, includeExisting = true } = options ?? {};

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

        await pubsub.subscribe(TOPIC_RESULT, handler);

        const close = () => {
          void pubsub.unsubscribe(TOPIC_RESULT, handler);
          try {
            controller.close();
          } catch {
            // Already closed
          }
        };
        if (abortSignal?.aborted) {
          close();
          return;
        }
        abortSignal?.addEventListener('abort', close, { once: true });

        // 2. Emit snapshot of existing in-flight tasks (running + suspended).
        if (!includeExisting) return;
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

  /**
   * @param options.deadline - Absolute wall-clock deadline (ms since epoch) to
   *   bound teardown by. `Mastra.shutdown()` passes the deadline shared with
   *   its workflow drain so the two do not stack. Defaults to
   *   `SHUTDOWN_GRACE_PERIOD_MS` from now when called standalone.
   */
  shutdown(options?: { deadline?: number }): Promise<void> {
    if (this.shutdownPromise) return this.shutdownPromise;
    this.shuttingDown = true;
    this.shutdownDeadline = options?.deadline ?? Date.now() + SHUTDOWN_GRACE_PERIOD_MS;
    this.shutdownPromise = this.#shutdown();
    return this.shutdownPromise;
  }

  async #shutdown(): Promise<void> {
    this.rejectAllResumeAdmissions(new Error('BackgroundTaskManager is shutting down, cannot resume tasks'));

    // Stop an already-running cleanup loop immediately. Init may still be in
    // flight and install one later, so repeat this check after awaiting it.
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = undefined;
    }

    // `Mastra` starts init without awaiting it. Give initialization a bounded
    // chance to settle; if it completes later, #doInit observes shuttingDown
    // and releases any subscription it installed after this teardown pass.
    // Initialization failures are handled by Mastra's original init catch.
    if (this.initPromise) {
      await this.#waitForShutdownStep(
        'background task manager initialization',
        this.initPromise.catch(() => {}),
      );
    }

    // Abort user code first, without waiting on storage or a remote broker.
    // Retryable running tasks intentionally remain `running` in storage so
    // the next process can recover them through recoverStaleTasks(). Tasks
    // without retries retain the existing terminal cancellation behavior.
    const activeTaskIds = [...this.activeAbortControllers.keys()];
    this.#abortActiveControllers();
    const cancellationResults = await this.#waitForShutdownStep(
      'background task cancellation',
      Promise.allSettled(activeTaskIds.map(taskId => this.#cancelTaskForShutdown(taskId))),
    );
    cancellationResults?.forEach((result, index) => {
      if (result.status === 'rejected') {
        this.#mastra
          ?.getLogger?.()
          ?.warn(`Failed to cancel background task ${activeTaskIds[index]} during shutdown:`, result.reason as any);
      }
    });

    // Do not await initPromise again without a deadline. If initialization
    // outlives the shutdown budget, #doInit observes shuttingDown and releases
    // any subscription it installs through #releaseLateInitSubscriptions().
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = undefined;
    }
    if (this.recoveryTimer) {
      clearTimeout(this.recoveryTimer);
      this.recoveryTimer = undefined;
      this.recoveryTimerAt = undefined;
    }

    const subscriptions: Array<[string, EventCallback]> = [];
    if (this.workerCallback) {
      subscriptions.push([TOPIC_DISPATCH, this.workerCallback]);
      subscriptions.push([this.processAffineDispatchTopic, this.workerCallback]);
    }
    if (this.resultCallback) subscriptions.push([TOPIC_RESULT, this.resultCallback]);
    const unsubscribeResults = await this.#waitForShutdownStep(
      'background task subscription cleanup',
      Promise.allSettled(subscriptions.map(([topic, callback]) => this.pubsub.unsubscribe(topic, callback))),
    );
    unsubscribeResults?.forEach((result, index) => {
      if (result.status === 'rejected') {
        this.#mastra
          ?.getLogger?.()
          ?.warn(
            `Failed to unsubscribe from ${subscriptions[index]?.[0]} during background task shutdown:`,
            result.reason,
          );
      }
    });

    // Defensive final sweep for any workflow attempt that was already between
    // awaits when shutdown began. New registrations are rejected atomically by
    // registerActiveAbortController().
    this.#abortActiveControllers();

    this.taskContexts.clear();
    this.taskAncestries.clear();
    this.localReservations.clear();
    this.localPendingTaskIds.clear();
    this.taskReleaseEpochs.clear();
    this.inFlightEnqueueAdmissions.clear();
    this.staticExecutors.clear();
    if (this.initPromise) {
      await this.#waitForShutdownStep('background task pubsub flush', this.pubsub.flush());
    }
  }

  async #cancelTaskForShutdown(taskId: string): Promise<void> {
    const storage = await this.getStorage();
    const task = await storage.getTask(taskId);
    // A retryable running task is left for stale-task recovery in another
    // process. A task with no retry budget must still transition terminally.
    if (task?.status === 'running' && task.retryCount < task.maxRetries) return;
    await this.cancel(taskId);
  }

  #abortActiveControllers(): void {
    for (const controller of this.activeAbortControllers.values()) {
      controller.abort(new Error(BACKGROUND_TASK_SHUTDOWN_ABORT_MESSAGE));
    }
    this.activeAbortControllers.clear();
  }

  /**
   * Await one teardown step against the shutdown-wide deadline. Callers pass an
   * already-started promise, so a step that finds the budget spent still runs —
   * it just stops blocking the rest of teardown, which keeps cleanup
   * best-effort while bounding `#shutdown()` as a whole.
   */
  async #waitForShutdownStep<T>(description: string, promise: Promise<T>): Promise<T | undefined> {
    const remainingMs = this.#remainingShutdownBudgetMs();
    if (remainingMs <= 0) {
      void promise.catch(() => {});
      this.#mastra?.getLogger?.()?.warn(`${description} left running in the background: the shutdown budget is spent`);
      return undefined;
    }

    let timeoutHandle: ReturnType<typeof setTimeout> | undefined;
    let outcome: { status: 'settled'; value: T } | { status: 'timed-out' };
    try {
      outcome = await Promise.race([
        promise.then(value => ({ status: 'settled' as const, value })),
        new Promise<{ status: 'timed-out' }>(resolve => {
          timeoutHandle = setTimeout(() => resolve({ status: 'timed-out' }), remainingMs);
        }),
      ]);
    } catch (error) {
      this.#mastra?.getLogger?.()?.warn(`${description} failed during shutdown:`, error as any);
      return undefined;
    } finally {
      if (timeoutHandle) clearTimeout(timeoutHandle);
    }

    if (outcome.status === 'timed-out') {
      this.#mastra
        ?.getLogger?.()
        ?.warn(`${description} exhausted the remaining ${remainingMs}ms of the graceful shutdown budget`);
      return undefined;
    }
    return outcome.value;
  }

  #remainingShutdownBudgetMs(): number {
    // No deadline means this ran outside `shutdown()`; fall back to the full
    // budget rather than treating the step as already expired.
    if (this.shutdownDeadline === undefined) return SHUTDOWN_GRACE_PERIOD_MS;
    return this.shutdownDeadline - Date.now();
  }

  async #releaseLateInitSubscriptions(subscriptions: Array<[string, EventCallback]>): Promise<void> {
    const results = await this.#waitForShutdownStep(
      'late background task subscription cleanup',
      Promise.allSettled(subscriptions.map(([topic, callback]) => this.pubsub.unsubscribe(topic, callback))),
    );
    results?.forEach((result, index) => {
      if (result.status === 'rejected') {
        this.#mastra
          ?.getLogger?.()
          ?.warn(`Failed to release late ${subscriptions[index]?.[0]} subscription after shutdown:`, result.reason);
      }
    });
  }

  // --- Internal ---

  /**
   * Lazily start Mastra's execution workers before publishing. In "library
   * mode" nothing ever calls `mastra.startWorkers()`, so the evented
   * `__background-task` workflow started by `handleDispatch` would publish
   * to the `workflows` topic with no consumer and the task would sit at
   * `running` forever (#19339). A no-op once workers are running; honors the
   * `workers: false` / `MASTRA_WORKERS` opt-outs.
   *
   * Startup failures are logged but don't abort the publish — in distributed
   * topologies a remote worker on the shared broker can still pick the task
   * up, and throwing here would also abort `drainPending()` /
   * `recoverStaleTasks()` loops.
   */
  async #ensureExecutionWorkersStarted(): Promise<void> {
    if (this.shuttingDown) return;
    if (!this.#mastra) return;
    try {
      await this.#mastra.__ensureExecutionWorkersStarted();
    } catch (err) {
      this.#mastra.getLogger?.()?.error('Failed to start execution workers for background task', err as any);
    }
  }

  private async dispatch(task: BackgroundTask, isRestart?: boolean): Promise<boolean> {
    if (this.shuttingDown) return false;
    await this.#ensureExecutionWorkersStarted();
    if (this.shuttingDown) return false;

    // Invocation-bound executors are closures owned by this manager and cannot
    // run in another process. Static executors remain portable and use the
    // shared competing-consumer topic.
    const dispatchTopic = this.taskContexts.has(task.id) ? this.processAffineDispatchTopic : TOPIC_DISPATCH;
    await this.pubsub.publish(dispatchTopic, {
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
        isRestart,
      },
      runId: task.id,
    });
    return true;
  }

  /**
   * Handles a task.dispatch and task.restart events.
   * Both events are similar, but the latter is used to restart a running task.
   */
  private async handleDispatch(event: Event): Promise<boolean> {
    if (this.shuttingDown) return false;

    const { taskId, isRestart } = event.data;
    const deliveryAttempt = event.deliveryAttempt ?? 1;

    const storage = await this.getStorage();
    if (this.shuttingDown) {
      this.deregisterTaskContext(taskId);
      return false;
    }

    const task = await storage.getTask(taskId);
    if (this.shuttingDown) {
      this.releaseLocalSlot(taskId);
      this.deregisterTaskContext(taskId);
      return false;
    }
    if (!task || task.status === 'cancelled') {
      this.releaseLocalSlot(taskId);
      this.deregisterTaskContext(taskId);
      return true;
    }
    const isRedeliveredRunning = !isRestart && task.status === 'running' && deliveryAttempt > 1;
    if (isRestart) {
      if (task.status !== 'running') {
        // The task already moved on, so this obsolete delivery is consumed.
        return true;
      }
    } else if (task.status !== 'pending' && !isRedeliveredRunning) {
      // Keep taskContexts registered on claim contention so local hooks can
      // still observe the worker that owns the final completion. The delivery
      // is obsolete once another worker owns it, so consume it rather than
      // redelivering forever.
      return true;
    }

    const claimedStatus = task.status === 'running' ? 'running' : 'pending';
    const claimedRetryCount = isRedeliveredRunning ? Math.max(task.retryCount, deliveryAttempt - 1) : task.retryCount;
    const restoreClaim = async () => {
      const restored = await storage.updateTask(
        taskId,
        {
          status: claimedStatus,
          startedAt: task.startedAt,
          retryCount: task.retryCount,
        },
        { expectedStatus: 'running' },
      );
      if (restored) this.deregisterTaskContext(taskId);
    };

    const claimed = await storage.updateTask(
      taskId,
      {
        status: 'running',
        startedAt: new Date(),
        retryCount: claimedRetryCount,
      },
      { expectedStatus: claimedStatus },
    );
    if (!claimed) {
      const latestTask = await storage.getTask(taskId);
      if (!latestTask) {
        this.deregisterTaskContext(taskId);
      }
      // Another worker established ownership (or completed) after our read.
      // Consume this obsolete delivery; only shutdown rollback is redelivered.
      return true;
    }

    // A recovery dispatch may claim a row while the original enqueue is
    // still awaiting its storage create promise. Let that authoritative
    // claim own execution so the enqueue continuation does not reserve and
    // dispatch the same task a second time.
    const enqueueAdmission = this.inFlightEnqueueAdmissions.get(taskId);
    if (enqueueAdmission) enqueueAdmission.admitted = true;

    // Publish running lifecycle event (fan-out, for stream consumers)
    const runningTask = await storage.getTask(taskId);
    if (this.shuttingDown) {
      await restoreClaim();
      return false;
    }
    if (!runningTask || runningTask.status !== 'running') return true;
    await this.publishLifecycleEvent('task.running', runningTask);
    if (this.shuttingDown) {
      await restoreClaim();
      return false;
    }

    // Fire-and-forget the workflow run; the workflow step body owns
    // executor invocation, retries, and suspend/resume. The local
    // execution hook still runs here so callers see `onExecution` fire.
    if (!this.#mastra) {
      this.releaseLocalSlot(taskId);
      const markedFailed = await storage.updateTask(
        taskId,
        {
          status: 'failed',
          error: { message: 'Mastra is not registered with this background task manager' },
          completedAt: new Date(),
        },
        { expectedStatus: 'running' },
      );
      if (markedFailed) {
        const failedTask = await storage.getTask(taskId);
        if (failedTask?.status === 'failed') await this.publishLifecycleEvent('task.failed', failedTask);
      }
      void this.drainPending();
      return true;
    }

    try {
      if (runningTask) void this.runLocalExecutionHook(runningTask);
      const workflow = this.#mastra.__getInternalWorkflow(BACKGROUND_TASK_WORKFLOW_ID);
      const prevWorkflowRun = await workflow.getWorkflowRunById(taskId, { withNestedWorkflows: false });
      const shouldRestart = isRestart && prevWorkflowRun?.status === 'running';
      if (!shouldRestart && prevWorkflowRun && !prevWorkflowRun.isFromInMemory) {
        // Fresh dispatches own their run id. The background-task row is the
        // authoritative task state machine, so once this worker's
        // pending→running (or restart) claim has succeeded, any durable
        // workflow snapshot still stored under this taskId is a stale lineage
        // from a previous incarnation (crash between a resume claim and the
        // workflow resume, a restart over a non-running run, or a reused task
        // id). The standard engine's lifecycle-identity reservation fails
        // `run.start()` closed on such foreign lineages ("lifecycle execution
        // admission is stale") — correctly, for workflows in general. The
        // evented engine this manager was originally built against (#19652
        // moved bg-tasks onto the standard engine) simply overwrote leftover
        // snapshots on start; restore that dispatch semantic here at the
        // bg-task boundary instead of weakening the engine's admission
        // contract.
        await workflow.deleteWorkflowRunById(taskId);
        if (this.shuttingDown) {
          await restoreClaim();
          return false;
        }
      }
      const run = await workflow.createRun({ runId: taskId });
      if (this.shuttingDown) {
        await restoreClaim();
        return false;
      }
      const runPromise = shouldRestart ? run.restart() : run.start({ inputData: { taskId } });
      void runPromise
        .then(result => {
          if (result.status !== 'suspended') {
            void workflow.deleteWorkflowRunById(taskId);
          }
        })
        .catch(err => {
          this.#mastra
            ?.getLogger?.()
            ?.error(`background-task workflow ${shouldRestart ? 'restart' : 'start'} failed for ${taskId}:`, err);
        })
        .finally(() => {
          this.releaseLocalSlot(taskId);
          void this.drainPending();
        });
    } catch (error) {
      this.releaseLocalSlot(taskId);
      const markedFailed = await storage.updateTask(
        taskId,
        {
          status: 'failed',
          error: { message: error instanceof Error ? error.message : String(error) },
          completedAt: new Date(),
        },
        { expectedStatus: 'running' },
      );
      if (markedFailed) {
        const failedTask = await storage.getTask(taskId);
        if (failedTask?.status === 'failed') await this.publishLifecycleEvent('task.failed', failedTask);
      }
      void this.drainPending();
    }

    return true;
  }

  /**
   * Handles a task.resume event. Mirrors the workflow branch of handleDispatch
   * but resumes an existing run from its suspended snapshot instead of starting
   * a fresh one. Concurrency gating, suspended-status validation, and the
   * `task.resumed` lifecycle publish all happen here so a different process
   * than the one that suspended the task can drive the resume.
   */
  private async handleResume(event: Event): Promise<boolean> {
    if (this.shuttingDown) return false;

    const { taskId, resumeData } = event.data;

    const storage = await this.getStorage();
    if (this.shuttingDown) return false;

    const task = await storage.getTask(taskId);
    if (this.shuttingDown) return false;
    if (!task || task.status !== 'suspended') {
      // Either gone or already resumed/cancelled by another worker. Drop the
      // event silently — the worker group ensures exactly-once delivery, but
      // the task may have moved on between publish and pickup.
      if (!task) {
        this.rejectResumeAdmission(taskId, event.id, new Error(`Task not found: ${taskId}`));
      } else {
        this.resolveResumeAdmission(taskId, event.id);
      }
      this.releaseLocalSlot(taskId);
      void this.drainPending();
      return true;
    }

    const restoreSuspended = async () => {
      await storage.updateTask(
        taskId,
        {
          status: 'suspended',
          startedAt: task.startedAt,
          suspendPayload: task.suspendPayload,
          suspendedAt: task.suspendedAt,
        },
        { expectedStatus: 'running' },
      );
    };

    const resumed = await storage.updateTask(
      taskId,
      {
        status: 'running',
        startedAt: new Date(),
        suspendPayload: undefined,
        suspendedAt: undefined,
      },
      { expectedStatus: 'suspended' },
    );
    if (!resumed) {
      const latestTask = await storage.getTask(taskId);
      if (!latestTask) {
        this.rejectResumeAdmission(taskId, event.id, new Error(`Task not found: ${taskId}`));
      } else if (latestTask.status !== 'suspended') {
        this.resolveResumeAdmission(taskId, event.id);
      }
      this.releaseLocalSlot(taskId);
      void this.drainPending();
      return true;
    }
    const resumedTask = await storage.getTask(taskId);
    if (this.shuttingDown) {
      await restoreSuspended();
      return false;
    }
    this.resolveResumeAdmission(taskId, event.id);
    if (resumedTask) {
      await this.publishLifecycleEvent('task.resumed', resumedTask);
    }
    if (this.shuttingDown) {
      await restoreSuspended();
      return false;
    }

    if (!this.#mastra) {
      this.releaseLocalSlot(taskId);
      void this.drainPending();
      return true;
    }
    const workflow = this.#mastra.__getInternalWorkflow(BACKGROUND_TASK_WORKFLOW_ID);
    // `createRun({ runId })` reattaches to the existing snapshot when given a
    // stable runId — we don't want a fresh run.
    const run = await workflow.createRun({ runId: taskId });
    if (this.shuttingDown) {
      await restoreSuspended();
      return false;
    }
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
        this.releaseLocalSlot(taskId);
        void this.drainPending();
      });
    return true;
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

    if (!task?.completedAt) return;

    // Look up per-task hooks
    const ctx = this.taskContexts.get(taskId);

    try {
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
          completedAt: task.completedAt,
          startedAt: task.startedAt!,
        });

        await Promise.all([
          ctx?.onComplete?.(task),
          (async () => {
            try {
              await this.config.onTaskComplete?.(task);
            } catch (error) {
              this.#mastra
                ?.getLogger?.()
                ?.warn(`background-task completion callback failed for ${taskId}:`, error as any);
            }
          })(),
        ]);
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
          completedAt: task.completedAt,
          startedAt: task.startedAt!,
        });

        await Promise.all([
          ctx?.onFailed?.(task),
          (async () => {
            try {
              await this.config.onTaskFailed?.(task);
            } catch (error) {
              this.#mastra?.getLogger?.()?.warn(`background-task failure callback failed for ${taskId}:`, error as any);
            }
          })(),
        ]);
      }
    } finally {
      // Clean up context after terminal result and admit the next task owned
      // by this manager. Portable tasks may have completed on another process,
      // so the result fan-out is the origin manager's queue-drain signal.
      this.deregisterTaskContext(taskId);
      void this.drainPending();
    }
  }

  private handleCancel(event: Event): void {
    if (this.shuttingDown) return;

    const { taskId } = event.data;
    this.rejectResumeAdmissions(taskId, new Error(`Background task ${taskId} was cancelled before resume admission`));
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

  private reserveLocalSlot(task: Pick<BackgroundTask, 'id' | 'agentId'>): boolean {
    if (this.localReservations.has(task.id)) return true;
    if (this.localReservations.size >= this.config.globalConcurrency) return false;

    let agentRunning = 0;
    for (const agentId of this.localReservations.values()) {
      if (agentId === task.agentId) agentRunning++;
    }
    if (agentRunning >= this.config.perAgentConcurrency) return false;

    this.localReservations.set(task.id, task.agentId);
    return true;
  }

  private releaseLocalSlot(taskId: string): void {
    if (this.localReservations.delete(taskId) && this.taskContexts.has(taskId)) {
      this.taskReleaseEpochs.set(taskId, ++this.localReleaseEpoch);
    }
  }

  private waitForResumeAdmission(
    taskId: string,
    eventId: string,
    timeoutMs: number,
    abortSignal?: AbortSignal,
    waitForCaller = true,
  ): ResumeAdmissionWaiter {
    let timeout: ReturnType<typeof setTimeout> | undefined;
    let onAbort: (() => void) | undefined;
    let resolvePromise = () => {};
    let rejectPromise = (_reason?: unknown) => {};
    const promise = waitForCaller
      ? new Promise<void>((resolve, reject) => {
          resolvePromise = resolve;
          rejectPromise = reject;
        })
      : Promise.resolve();
    const waiter = {} as ResumeAdmissionWaiter;
    const settleCaller = (reason?: unknown, rejected = false) => {
      if (waiter.callerSettled) {
        this.finalizeResumeAdmissionWaiter(waiter);
        return;
      }
      waiter.callerSettled = true;
      if (timeout !== undefined) clearTimeout(timeout);
      if (onAbort) abortSignal?.removeEventListener('abort', onAbort);
      if (rejected) rejectPromise(reason);
      else resolvePromise();
      this.finalizeResumeAdmissionWaiter(waiter);
    };

    Object.assign(waiter, {
      taskId,
      eventId,
      context: this.taskContexts.get(taskId)!,
      reservationAgentId: this.localReservations.get(taskId),
      admitted: false,
      superseded: false,
      admissionSettled: false,
      callerSettled: !waitForCaller,
      publicationSettled: false,
      failureCleanupComplete: true,
      promise,
      resolve: () => {
        if (waiter.superseded) return;
        waiter.admissionSettled = true;
        waiter.admitted = true;
        this.supersedeOtherResumeAdmissions(waiter);
        settleCaller(undefined, false);
      },
      reject: (reason?: unknown) => {
        if (waiter.admitted) return;
        settleCaller(reason, true);
      },
    } satisfies ResumeAdmissionWaiter);

    const waiters = this.resumeAdmissionWaiters.get(taskId) ?? new Set<ResumeAdmissionWaiter>();
    waiters.add(waiter);
    this.resumeAdmissionWaiters.set(taskId, waiters);

    if (waitForCaller) {
      onAbort = () => waiter.reject(abortSignal?.reason ?? new Error('Background task resume admission aborted'));
      abortSignal?.addEventListener('abort', onAbort, { once: true });
      if (abortSignal?.aborted) {
        onAbort();
      } else {
        timeout = setTimeout(
          () => waiter.reject(new Error(`Timed out waiting for background task "${taskId}" resume admission`)),
          Math.max(0, timeoutMs),
        );
      }
    }

    return waiter;
  }

  private finalizeResumeAdmissionWaiter(waiter: ResumeAdmissionWaiter): void {
    if (
      !waiter.admissionSettled ||
      !waiter.callerSettled ||
      !waiter.publicationSettled ||
      !waiter.failureCleanupComplete
    ) {
      return;
    }
    const taskWaiters = this.resumeAdmissionWaiters.get(waiter.taskId);
    if (!taskWaiters) return;
    taskWaiters.delete(waiter);
    if (taskWaiters.size === 0) this.resumeAdmissionWaiters.delete(waiter.taskId);
  }

  private supersedeOtherResumeAdmissions(waiter: ResumeAdmissionWaiter): void {
    this.supersedeResumeAdmissionsForEvent(waiter.taskId, waiter.eventId);
  }

  private supersedeResumeAdmissionsForEvent(taskId: string, eventId: string): void {
    const waiters = this.resumeAdmissionWaiters.get(taskId);
    if (!waiters) return;
    for (const other of [...waiters]) {
      if (other.eventId === eventId || other.admitted || other.superseded) continue;
      other.superseded = true;
      other.admissionSettled = true;
      other.reject(new Error(`Background task "${taskId}" resume was superseded`));
    }
  }

  private markResumePublicationSettled(waiter: ResumeAdmissionWaiter, error?: unknown, failed = false): void {
    if (waiter.publicationSettled) return;
    waiter.publicationSettled = true;
    if (failed) {
      waiter.admissionSettled = true;
      waiter.failureCleanupComplete = false;
      waiter.failureCleanupPromise = this.cleanupFailedResumeAdmission(waiter).finally(() => {
        waiter.failureCleanupComplete = true;
        this.finalizeResumeAdmissionWaiter(waiter);
      });
      waiter.reject(error);
      return;
    }
    this.finalizeResumeAdmissionWaiter(waiter);
  }

  private async cleanupFailedResumeAdmission(waiter: ResumeAdmissionWaiter): Promise<void> {
    if (waiter.admitted || waiter.superseded || this.shuttingDown) return;
    try {
      const storage = await this.getStorage();
      const task = await storage.getTask(waiter.taskId);
      if (!task || task.id !== waiter.taskId || task.status !== 'suspended') return;

      // Re-check every process-local owner after the storage read. A newer
      // resume may have replaced the context or reservation while the read was
      // in flight, and an older failed publication must not tear it down.
      if (this.taskContexts.get(waiter.taskId) !== waiter.context) return;
      if (this.localReservations.get(waiter.taskId) !== waiter.reservationAgentId) return;
      const waiters = this.resumeAdmissionWaiters.get(waiter.taskId);
      if (
        [...(waiters ?? [])].some(
          other => other !== waiter && !other.admitted && !other.superseded && !other.admissionSettled,
        )
      ) {
        return;
      }
      if (waiter.admitted || waiter.superseded) return;

      this.releaseLocalSlot(waiter.taskId);
      void this.drainPending();
    } catch {
      // An unavailable storage identity leaves ownership uncertain. The next
      // lifecycle event or shutdown will perform the authoritative cleanup.
    }
  }

  private resolveResumeAdmission(taskId: string, eventId: string): void {
    this.supersedeResumeAdmissionsForEvent(taskId, eventId);
    const waiters = this.resumeAdmissionWaiters.get(taskId);
    if (!waiters) return;
    for (const waiter of [...waiters]) {
      if (waiter.eventId === eventId) {
        waiter.admissionSettled = true;
        waiter.resolve();
      }
    }
  }

  private rejectResumeAdmission(taskId: string, eventId: string, reason: unknown): void {
    const waiters = this.resumeAdmissionWaiters.get(taskId);
    if (!waiters) return;
    for (const waiter of [...waiters]) {
      if (waiter.eventId === eventId) {
        waiter.admissionSettled = true;
        waiter.reject(reason);
      }
    }
  }

  private rejectResumeAdmissions(taskId: string, reason: unknown): void {
    const waiters = this.resumeAdmissionWaiters.get(taskId);
    if (!waiters) return;
    for (const waiter of [...waiters]) {
      waiter.admissionSettled = true;
      waiter.reject(reason);
    }
  }

  private rejectAllResumeAdmissions(reason: unknown): void {
    const waiters = this.resumeAdmissionWaiters;
    this.resumeAdmissionWaiters = new Map();
    for (const taskWaiters of waiters.values()) {
      for (const waiter of taskWaiters) waiter.reject(reason);
    }
  }

  private isAwaitedNestedDispatchBlockedByAncestor(task: Pick<BackgroundTask, 'id' | 'agentId'>): boolean {
    const ancestry = this.taskAncestries.get(task.id);
    if (!ancestry || ancestry.length === 0) return false;

    const activeAncestors = ancestry.filter(frame => this.localReservations.has(frame.taskId));
    if (activeAncestors.length === 0) return false;

    if (this.localReservations.size >= this.config.globalConcurrency) return true;

    const agentRunning = [...this.localReservations.values()].filter(agentId => agentId === task.agentId).length;
    return (
      agentRunning >= this.config.perAgentConcurrency &&
      activeAncestors.some(
        frame => frame.agentId === task.agentId && this.localReservations.get(frame.taskId) === task.agentId,
      )
    );
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
    if (this.drainingPending || this.shuttingDown) return;
    this.drainingPending = true;

    try {
      const storage = await this.getStorage();
      for (const taskId of [...this.localPendingTaskIds]) {
        if (this.shuttingDown) return;
        const pendingReleaseEpoch = this.localReleaseEpoch;
        const task = await storage.getTask(taskId);
        if (!task || task.status !== 'pending') {
          this.localPendingTaskIds.delete(taskId);
          continue;
        }

        const isProcessAffine = this.taskContexts.has(taskId);
        if (
          isProcessAffine &&
          ((this.taskReleaseEpochs.get(taskId) ?? 0) > pendingReleaseEpoch || this.localReservations.has(taskId))
        ) {
          this.localPendingTaskIds.delete(taskId);
          const nowMs = Date.now();
          this.scheduleRecovery(nowMs + RECOVERY_ERROR_RETRY_MS, nowMs);
          continue;
        }
        const canRun = isProcessAffine ? this.reserveLocalSlot(task) : await this.checkConcurrency(task.agentId);
        if (!canRun) continue;

        this.localPendingTaskIds.delete(taskId);
        try {
          if (!(await this.dispatch(task))) {
            this.releaseLocalSlot(taskId);
            this.localPendingTaskIds.add(taskId);
            return;
          }
        } catch (error) {
          if (isProcessAffine) this.releaseLocalSlot(taskId);
          this.localPendingTaskIds.add(taskId);
          this.#mastra?.getLogger?.()?.warn(`background-task dispatch failed while draining ${taskId}:`, error as any);
          return;
        }
      }
    } catch (error) {
      this.#mastra?.getLogger?.()?.warn('background-task queue drain failed:', error as any);
    } finally {
      this.drainingPending = false;
    }
  }

  /**
   * Recovers tasks left in 'running' or 'pending' state from a previous process.
   */
  private async recoverStaleTasks(): Promise<void> {
    let nextRecoveryAt: number | undefined;
    try {
      if (this.shuttingDown) return;
      if (this.recoveryTimer) {
        clearTimeout(this.recoveryTimer);
        this.recoveryTimer = undefined;
        this.recoveryTimerAt = undefined;
      }

      const storage = await this.getStorage();
      const { tasks: staleTasks } = await storage.listTasks({ status: 'running' });
      const now = new Date();
      for (const task of staleTasks) {
        if (this.shuttingDown) return;
        if (!this.isRunningTaskExpired(task, now)) {
          const retryAt = task.startedAt ? task.startedAt.getTime() + task.timeoutMs : now.getTime();
          nextRecoveryAt = Math.min(nextRecoveryAt ?? retryAt, retryAt);
          continue;
        }

        if (task.retryCount < task.maxRetries && this.canResolveTaskExecutor(task)) {
          await storage.updateTask(
            task.id,
            {
              status: 'pending',
              startedAt: undefined,
              retryCount: task.retryCount + 1,
            },
            { expectedStatus: 'running' },
          );
        } else {
          await storage.updateTask(
            task.id,
            {
              status: 'failed',
              error: this.canResolveTaskExecutor(task)
                ? { message: 'Worker process terminated before task completed' }
                : createUnrecoverableTaskError(task),
              completedAt: new Date(),
            },
            { expectedStatus: 'running' },
          );
        }
      }

      // A suspended or completed invocation can retain its context after
      // releasing a slot, invalidating a pending snapshot captured earlier.
      const pendingReleaseEpoch = this.localReleaseEpoch;
      const { tasks: pendingTasks } = await storage.listTasks({
        status: 'pending',
        orderBy: 'createdAt',
        orderDirection: 'asc',
      });
      for (const task of pendingTasks) {
        if (this.shuttingDown) return;
        if (!this.canResolveTaskExecutor(task)) continue;
        const isProcessAffine = this.taskContexts.has(task.id);
        // Do not reclaim capacity for a stale snapshot after that context
        // already released its earlier reservation.
        if (isProcessAffine && (this.taskReleaseEpochs.get(task.id) ?? 0) > pendingReleaseEpoch) {
          const retryAt = Date.now() + RECOVERY_ERROR_RETRY_MS;
          nextRecoveryAt = Math.min(nextRecoveryAt ?? retryAt, retryAt);
          continue;
        }
        const canRun = isProcessAffine ? this.reserveLocalSlot(task) : await this.checkConcurrency(task.agentId);
        if (canRun) {
          await this.dispatch(task);
        } else {
          this.localPendingTaskIds.add(task.id);
        }
      }
    } catch (error) {
      const logger = this.#mastra?.getLogger();
      if (logger) {
        logger.error('Failed to recover stale background tasks', error);
      }
      nextRecoveryAt = Date.now() + RECOVERY_ERROR_RETRY_MS;
    } finally {
      this.scheduleRecovery(nextRecoveryAt, Date.now());
    }
  }

  private scheduleRecovery(retryAt: number | undefined, nowMs: number): void {
    if (this.shuttingDown || retryAt === undefined) return;
    const delayMs = Math.min(Math.max(retryAt - nowMs, 0), 2_147_483_647);
    const scheduledAt = nowMs + delayMs;
    if (this.recoveryTimer && this.recoveryTimerAt !== undefined && this.recoveryTimerAt <= scheduledAt) return;
    if (this.recoveryTimer) clearTimeout(this.recoveryTimer);
    this.recoveryTimerAt = scheduledAt;
    this.recoveryTimer = setTimeout(() => {
      this.recoveryTimer = undefined;
      this.recoveryTimerAt = undefined;
      void this.recoverStaleTasks();
    }, delayMs);
  }
}
