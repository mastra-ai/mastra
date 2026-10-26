import type { Mastra } from '..';
import type { PubSub } from '../events/pubsub';
import type { Event, EventCallback } from '../events/types';
import type {
  BackgroundTask,
  BackgroundTaskManagerConfig,
  BackgroundTaskStatus,
  EnqueueOptions,
  EnqueueResult,
  ResumeOptions,
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
const SHUTDOWN_GRACE_PERIOD_MS = 5_000;
const SHUTDOWN_ABORT_MESSAGE = 'Background task manager is shutting down';
const TASK_OWNERSHIP_LOST_MESSAGE = 'Background task execution ownership was taken over by another worker';

function workflowRunError(result: { status: string; error?: unknown; tripwire?: { reason?: string } }): unknown {
  if (result.error !== undefined) return result.error;
  if (result.tripwire?.reason) return new Error(result.tripwire.reason);
  return new Error(`Background task workflow run ended with status '${result.status}'`);
}

// Workflow results carry errors serialized to plain objects, not Error instances.
function toTaskError(err: unknown): { message: string; stack?: string } {
  if (err && typeof err === 'object' && typeof (err as { message?: unknown }).message === 'string') {
    const { message, stack } = err as { message: string; stack?: unknown };
    return typeof stack === 'string' ? { message, stack } : { message };
  }
  return { message: String(err) };
}

export class BackgroundTaskManager {
  private pubsub!: PubSub;
  private readonly workerId = globalThis.crypto.randomUUID();
  private readonly processAffineDispatchTopic = `${TOPIC_DISPATCH}:${this.workerId}`;
  config: Required<
    Pick<
      BackgroundTaskManagerConfig,
      | 'globalConcurrency'
      | 'perAgentConcurrency'
      | 'backpressure'
      | 'defaultTimeoutMs'
      | 'recoverStaleTasksOnStart'
      | 'leaseDurationMs'
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

  // Track active AbortControllers for running tasks (for cancellation + timeout)
  /** @internal — read by the workflow-engine step bodies in workflow.ts */
  activeAbortControllers: Map<string, AbortController> = new Map();

  // Process-affine executors are runtime closures and cannot participate in
  // storage-wide concurrency accounting. Keep their admission and queue
  // ownership local to the manager that owns the closure so abandoned rows
  // from another process cannot block them. Cross-process safety instead comes
  // from the persisted execution lease (see `ownedLeases`): a task is only
  // recoverable once its owner stops renewing the lease.
  private localReservations = new Map<string, string>();
  private localPendingTaskIds = new Set<string>();
  // Resumes requested with `onNoSlot: 'queue'` while no slot was free, keyed by
  // task ID. The rows stay `suspended`; `drainPending()` publishes them first.
  private localPendingResumes = new Map<string, { resumeData: unknown; suspendedAt: number | null }>();
  // Portable resumes this process has published that no worker has picked up
  // yet. The row stays `suspended` until `handleResume` runs, so storage-wide
  // running counts miss them; `checkConcurrency()` adds them back so one free
  // slot can't admit several queued resumes. Entries expire after a lease
  // duration in case the event is lost.
  private inFlightPortableResumes = new Map<string, { agentId: string; suspendedAt: number | null; until: number }>();
  private drainingPending = false;

  // Task IDs this manager currently holds an execution lease for. Populated on
  // a successful claim and drained by the lease heartbeat, which renews each
  // lease at `leaseDurationMs / 3`. A worker that dies stops renewing, so its
  // leases expire and other workers may safely reclaim the tasks.
  private ownedLeases = new Set<string>();
  // Pending task IDs enqueued with `pinToWorker`. Their rows carry this
  // manager's owner ID and a lease, renewed by the same heartbeat, so other
  // workers leave them alone until this manager claims them or dies.
  private pinnedPendingLeases = new Set<string>();
  private heartbeatInterval?: ReturnType<typeof setInterval>;

  // Pending follow-up pass for stale-task recovery. A running task whose lease
  // is still valid is left alone by a recovery scan, so if its owner died just
  // before that scan the task would otherwise stay 'running' until the next
  // process restart. This timer re-runs recovery once the earliest such lease
  // lapses, which lets a crashed owner's tasks settle without a restart.
  private staleRecoveryTimeout?: ReturnType<typeof setTimeout>;

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

  // Serializes teardown and makes repeated shutdown calls safe. Shutdown may
  // race the constructor-owned, fire-and-forget init path, so cleanup must not
  // run until initialization has either completed or failed.
  private shutdownPromise?: Promise<void>;

  // Wall-clock deadline shared by every step of the teardown sequence. Set once
  // when shutdown begins; steps that start after it has passed fire their
  // cleanup without blocking on it.
  private shutdownDeadline?: number;

  constructor(config: BackgroundTaskManagerConfig = { enabled: false }) {
    const leaseDurationMs = config.leaseDurationMs ?? 30_000;
    // The heartbeat renews at `leaseDurationMs / 3`, floored to 1s. A lease
    // shorter than 3s therefore expires before it can be renewed, so reject it
    // rather than silently letting every task's lease lapse mid-run.
    if (!Number.isFinite(leaseDurationMs) || leaseDurationMs < 3_000) {
      throw new Error(
        `BackgroundTaskManager leaseDurationMs must be a finite number of at least 3000ms (received: ${leaseDurationMs})`,
      );
    }
    for (const [owner, limit] of Object.entries(config.perOwnerConcurrency ?? {})) {
      if (!Number.isFinite(limit) || limit < 1) {
        throw new Error(
          `BackgroundTaskManager perOwnerConcurrency["${owner}"] must be a finite number of at least 1 (received: ${limit})`,
        );
      }
    }
    this.config = {
      ...config,
      globalConcurrency: config.globalConcurrency ?? 10,
      perAgentConcurrency: config.perAgentConcurrency ?? 5,
      backpressure: config.backpressure ?? 'queue',
      defaultTimeoutMs: config.defaultTimeoutMs ?? 300_000,
      recoverStaleTasksOnStart: config.recoverStaleTasksOnStart ?? true,
      leaseDurationMs,
    };
  }

  __registerMastra(mastra: Mastra) {
    this.#mastra = mastra;
  }

  /**
   * @internal — execution-lease owner identity for this manager process.
   * Persisted when a task is claimed so recovery can distinguish a live owner
   * from a dead one, and used by the workflow step bodies to fence their
   * terminal writes against a superseded owner.
   */
  get ownerId(): string {
    return this.workerId;
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
          handled = await this.handleResume(event);
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

      if (this.config.recoverStaleTasksOnStart) {
        // Recover stale tasks from a previous process — only workers should
        // attempt recovery since they own execution.
        await this.recoverStaleTasks();
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

    // Start periodic cleanup if configured
    const cleanupConfig = this.config.cleanup;
    if (cleanupConfig && !this.shuttingDown) {
      const intervalMs = cleanupConfig.cleanupIntervalMs ?? 60_000;
      this.cleanupInterval = setInterval(() => {
        void this.cleanup();
      }, intervalMs);
    }

    // Renew execution leases while this process owns tasks. Idle managers do
    // nothing — the handler returns immediately when `ownedLeases` is empty.
    if (!this.shuttingDown) {
      this.#startLeaseHeartbeat();
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

  /** @internal — called by the workflow step immediately before executor invocation. */
  registerActiveAbortController(taskId: string, controller: AbortController): boolean {
    if (this.shuttingDown) {
      controller.abort(new Error(SHUTDOWN_ABORT_MESSAGE));
      return false;
    }
    this.activeAbortControllers.set(taskId, controller);
    return true;
  }

  /** @internal — read by workflow error classification during graceful shutdown. */
  isShuttingDown(): boolean {
    return this.shuttingDown;
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

  // --- Core operations ---

  /**
   * Enqueue a task for background execution.
   * Prefer `createBackgroundTask()` which returns a self-contained handle.
   */
  async enqueue(payload: TaskPayload, context?: TaskContext, options?: EnqueueOptions): Promise<EnqueueResult> {
    if (this.shuttingDown) {
      throw new Error('BackgroundTaskManager is shutting down, cannot enqueue new tasks');
    }
    const pinned = options?.pinToWorker === true;
    if (pinned && !context) {
      // A portable row pinned here would be skipped by every other worker on
      // the shared dispatch topic while this process holds no closure for it.
      throw new Error('pinToWorker requires a task context');
    }

    // Mastra fires `init` as fire-and-forget. If a caller hits enqueue
    // before init completes, the dispatch publish fires before the worker
    // subscribes and the event is dropped (or, worse, lands on a worker
    // whose Mastra hasn't yet registered the bg-task workflow → "Workflow
    // with id __background-task not found"). Await readiness up front.
    if (this.initPromise) await this.initPromise;

    const createdAt = new Date();
    const task: BackgroundTask = {
      id: this.#mastra?.generateId() ?? globalThis.crypto.randomUUID(),
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
      createdAt,
      ...(payload.expiresAt ? { expiresAt: payload.expiresAt } : {}),
      ...(payload.metadata ? { metadata: payload.metadata } : {}),
      ...(pinned
        ? { ownerId: this.workerId, leaseExpiresAt: new Date(createdAt.getTime() + this.config.leaseDurationMs) }
        : {}),
    };

    // Register per-task context if provided
    if (context) {
      this.registerTaskContext(task.id, context);
    }

    const storage = await this.getStorage();
    await storage.createTask(task);
    if (pinned) this.pinnedPendingLeases.add(task.id);

    const isProcessAffine = Boolean(context);
    const canRun = isProcessAffine ? this.reserveLocalSlot(task) : await this.checkConcurrency(task.agentId);

    if (canRun) {
      try {
        await this.dispatch(task);
      } catch (error) {
        this.pinnedPendingLeases.delete(task.id);
        const failed = await storage.updateTask(
          task.id,
          {
            status: 'failed',
            error: { message: error instanceof Error ? error.message : String(error) },
            completedAt: new Date(),
            ...(pinned ? { ownerId: undefined, leaseExpiresAt: undefined } : {}),
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

    // Backpressure
    switch (this.config.backpressure) {
      case 'reject':
        this.pinnedPendingLeases.delete(task.id);
        this.deregisterTaskContext(task.id);
        await storage.deleteTask(task.id);
        throw new Error(`Concurrency limit reached, cannot enqueue task for tool "${task.toolName}"`);

      case 'fallback-sync':
        this.pinnedPendingLeases.delete(task.id);
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
      // Cancellation is an explicit operator action and may arrive from any
      // process, so it is fenced on status only — but it must drop the lease,
      // since the task is leaving `running` and no owner should keep renewing.
      const cancelled = await storage.updateTask(
        taskId,
        { status: 'cancelled', completedAt: new Date(), ownerId: undefined, leaseExpiresAt: undefined },
        { expectedStatus: previousStatus },
      );
      if (!cancelled) {
        task = await storage.getTask(taskId);
        if (!task) return;
        continue;
      }
      this.ownedLeases.delete(taskId);
      this.pinnedPendingLeases.delete(taskId);
      this.localPendingResumes.delete(taskId);

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
  async resume(taskId: string, resumeData?: unknown, options?: ResumeOptions): Promise<BackgroundTask> {
    if (this.shuttingDown) {
      throw new Error('BackgroundTaskManager is shutting down, cannot resume tasks');
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
    if (task.status !== 'suspended') {
      throw new Error(`Cannot resume task in status '${task.status}' (expected 'suspended')`);
    }

    const isProcessAffine = this.taskContexts.has(taskId);
    if (!isProcessAffine) await this.#pruneInFlightResumes();
    const canRun = isProcessAffine ? this.reserveLocalSlot(task) : await this.checkConcurrency(task.agentId);
    if (!canRun) {
      if (options?.onNoSlot === 'queue') {
        // The row stays `suspended` until a slot frees and `drainPending()`
        // publishes the resume. Only this process holds the queued resume, so
        // if it exits first the task is still a resumable suspended row.
        // The suspension token ties the queued data to this suspension: if the
        // task is resumed elsewhere and suspends again, the entry is dropped.
        this.localPendingResumes.set(taskId, { resumeData, suspendedAt: suspensionToken(task) });
        return task;
      }
      // By default resume sits outside the queue/fallback-sync paths — there's
      // no synchronous caller to fall back to, and silently leaving the task
      // suspended hides the failure from the caller. Throw and let the
      // caller retry once a slot frees.
      throw new Error(`Concurrency limit reached, cannot resume task "${taskId}" — retry once a slot is available`);
    }

    this.localPendingResumes.delete(taskId);
    await this.#publishResume(task, resumeData, isProcessAffine);
    return task;
  }

  async #publishResume(task: BackgroundTask, resumeData: unknown, isProcessAffine: boolean): Promise<void> {
    const taskId = task.id;
    if (this.shuttingDown) {
      if (isProcessAffine) this.releaseLocalSlot(taskId);
      throw new Error('BackgroundTaskManager is shutting down, cannot resume tasks');
    }
    // Resume publishes directly (not via dispatch()), so it needs its own
    // lazy worker start for the library-mode process-restart case.
    await this.#ensureExecutionWorkersStarted();

    // Resume invocation-bound executors on their owning manager. A task
    // without local context remains portable through the shared worker group.
    const dispatchTopic = isProcessAffine ? this.processAffineDispatchTopic : TOPIC_DISPATCH;
    try {
      await this.pubsub.publish(dispatchTopic, {
        type: 'task.resume',
        data: { taskId, resumeData },
        runId: taskId,
      });
    } catch (error) {
      if (isProcessAffine) this.releaseLocalSlot(taskId);
      throw error;
    }
    if (!isProcessAffine) {
      this.inFlightPortableResumes.set(taskId, {
        agentId: task.agentId,
        suspendedAt: suspensionToken(task),
        until: Date.now() + this.config.leaseDurationMs,
      });
    }
  }

  /**
   * Re-dispatches a previously pending or running task. The tool executor is
   * re-registered via `registerTaskContext(taskId, ...)` because the original
   * registration is gone (e.g. process restart) — the manager doesn't
   * rehydrate executor closures from storage.
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
    if (task.status !== 'pending' && task.status !== 'running') {
      throw new Error(`Cannot restart task in status '${task.status}' (expected 'pending' or 'running')`);
    }
    const isRestart = task.status === 'running';

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
      await this.dispatch(task, isRestart);
    } catch (error) {
      if (isProcessAffine) this.releaseLocalSlot(taskId);
      throw error;
    }

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
    if (!storage.supportsTaskExpiry) {
      // Adapters written before `expiresAt` existed ignore `hasExpiresAt` and
      // treat an unknown `dateFilterBy` as `createdAt`, so the expiry pass
      // would delete every finished row. Keep the global TTLs only.
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
      return;
    }
    // Rows with their own `expiresAt` are retained until that deadline instead
    // of the global TTLs. Only terminal rows are deleted, so a live row is never
    // removed from under its lease owner.
    await storage.deleteTasks({
      status: ['completed', 'failed', 'cancelled', 'timed_out'],
      toDate: new Date(now),
      dateFilterBy: 'expiresAt',
    });

    await storage.deleteTasks({
      status: ['completed'],
      hasExpiresAt: false,
      toDate: new Date(now - completedTtlMs),
      dateFilterBy: 'completedAt',
    });

    await storage.deleteTasks({
      status: ['failed', 'cancelled', 'timed_out'],
      hasExpiresAt: false,
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
      let timeout: ReturnType<typeof setTimeout> | undefined;
      let progressInterval: ReturnType<typeof setInterval> | undefined;
      let pollInterval: ReturnType<typeof setInterval> | undefined;

      const cleanup = () => {
        if (pollInterval) clearInterval(pollInterval);
        if (timeout) clearTimeout(timeout);
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
          if (task && isTerminal(task.status)) {
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
   *
   * Events are scoped to a resource: when `resourceId` is omitted, only tasks without a
   * `resourceId` are delivered. Pass `allResources: true` to receive events for every
   * resource (privileged consumers only — payloads include task args and results).
   */
  stream(options?: {
    agentId?: string;
    runId?: string;
    threadId?: string;
    resourceId?: string;
    taskId?: string;
    abortSignal?: AbortSignal;
    includeExisting?: boolean;
    allResources?: boolean;
  }): ReadableStream<Record<string, unknown>> {
    const manager = this;
    const pubsub = this.pubsub;
    const {
      agentId,
      runId,
      threadId,
      resourceId,
      abortSignal,
      taskId,
      includeExisting = true,
      allResources = false,
    } = options ?? {};
    const matchesResource = (taskResourceId: string | null | undefined) => {
      if (resourceId !== undefined) return taskResourceId === resourceId;
      return allResources || taskResourceId == null;
    };

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
          if (!matchesResource(data.resourceId)) return;
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
            if (task && task.status === 'running' && matchesResource(task.resourceId)) {
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
              if (!matchesResource(task.resourceId)) continue;
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

    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = undefined;
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
    this.localReservations.clear();
    this.localPendingTaskIds.clear();
    this.localPendingResumes.clear();
    this.inFlightPortableResumes.clear();
    this.staticExecutors.clear();

    // Stop renewing leases and hand back the ones still held so another worker
    // can recover and re-run those tasks immediately instead of waiting for the
    // lease to expire. Best-effort: storage may already be gone.
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = undefined;
    }
    if (this.staleRecoveryTimeout) {
      clearTimeout(this.staleRecoveryTimeout);
      this.staleRecoveryTimeout = undefined;
    }
    if (this.ownedLeases.size > 0) {
      const ownedTaskIds = [...this.ownedLeases];
      this.ownedLeases.clear();
      try {
        const storage = await this.getStorage();
        // Fenced on `ownerId` so a task already reclaimed or finished elsewhere
        // is left alone. Bounded by the shared shutdown deadline so a slow store
        // cannot stall teardown; any lease left unreleased expires on its own.
        await this.#waitForShutdownStep(
          'background task lease release',
          Promise.allSettled(
            ownedTaskIds.map(taskId =>
              storage.updateTask(
                taskId,
                { ownerId: undefined, leaseExpiresAt: undefined },
                { expectedOwnerId: this.workerId },
              ),
            ),
          ),
        );
      } catch {
        // Storage unavailable — leases expire on their own.
      }
    }
    if (this.pinnedPendingLeases.size > 0) {
      const pinnedTaskIds = [...this.pinnedPendingLeases];
      this.pinnedPendingLeases.clear();
      try {
        const storage = await this.getStorage();
        // Expire the lease but keep the owner: the work this pin stood for is
        // abandoned, so peers recover the row now as a lost attempt (consuming a
        // retry or failing) rather than as fresh, never-run work.
        await this.#waitForShutdownStep(
          'background task pinned lease release',
          Promise.allSettled(
            pinnedTaskIds.map(taskId =>
              storage.updateTask(
                taskId,
                { leaseExpiresAt: new Date() },
                { expectedStatus: 'pending', expectedOwnerId: this.workerId },
              ),
            ),
          ),
        );
      } catch {
        // Storage unavailable — leases expire on their own.
      }
    }
    if (this.initPromise) {
      await this.#waitForShutdownStep('background task pubsub flush', this.pubsub.flush());
    }
  }

  async #cancelTaskForShutdown(taskId: string): Promise<void> {
    const storage = await this.getStorage();
    const task = await storage.getTask(taskId);
    if (task?.status === 'running' && task.maxRetries > 0) return;
    await this.cancel(taskId);
  }

  #abortActiveControllers(): void {
    for (const controller of this.activeAbortControllers.values()) {
      controller.abort(new Error(SHUTDOWN_ABORT_MESSAGE));
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

  private async dispatch(task: BackgroundTask, isRestart?: boolean): Promise<void> {
    if (this.shuttingDown) return;
    await this.#ensureExecutionWorkersStarted();

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
    if (this.shuttingDown) return false;
    const task = await storage.getTask(taskId);
    if (this.shuttingDown) return false;
    if (!task || task.status === 'cancelled') {
      this.releaseLocalSlot(taskId);
      this.deregisterTaskContext(taskId);
      return true;
    }

    const isRunningRedelivery = task.status === 'running' && deliveryAttempt > 1;
    const canDispatch = isRestart ? task.status === 'running' : task.status === 'pending' || isRunningRedelivery;

    if (!canDispatch) {
      // The task moved to a state this delivery cannot start. Acknowledge the
      // stale event without clearing its context: suspended tasks still need
      // that context to resume, and terminal result hooks may still be running.
      return true;
    }

    if (isRunningRedelivery && task.leaseExpiresAt && task.leaseExpiresAt.getTime() > Date.now()) {
      // The task still holds a live lease, so its owner is presumed alive and
      // reclaiming it here would double-run the task. A duplicate delivery for a
      // run this worker already tracks is acknowledged; any other case is left
      // unacked so the broker redelivers it once the lease lapses and the task
      // can be recovered by a live owner.
      return task.ownerId === this.workerId;
    }

    if (task.status === 'pending' && task.ownerId && task.ownerId !== this.workerId) {
      // Pinned to another worker (`pinToWorker`), which holds the work for it.
      // Claiming it here would run the task twice. If that worker dies, stale
      // recovery accounts for the lost attempt and re-dispatches the row.
      return true;
    }
    // A row pinned to this worker is claimed fenced on the owner alone: the
    // heartbeat may renew its lease between the read above and this write.
    const pinnedHere = task.status === 'pending' && task.ownerId === this.workerId;

    // A broker redelivery only counts against the retry budget when a previous
    // delivery actually started execution (the task was marked `running`, e.g.
    // the worker crashed mid-run). A dispatch declined cleanly during shutdown
    // leaves the task `pending`, so the worker that picks up the redelivery
    // still gets the full retry budget.
    const retryCount = task.status === 'running' ? deliveryAttempt - 1 : task.retryCount;
    // Claim execution ownership with an expiring lease. The compare-and-set on
    // the previously observed owner/lease fences concurrent dispatchers: when
    // two workers race for the same pending task, only the first claim wins and
    // the loser acknowledges without starting a second execution. An explicit
    // restart skips the owner fence — the caller is deliberately asking this
    // worker to take the task over from whoever ran it before.
    const now = new Date();
    const started = await storage.updateTask(
      taskId,
      {
        status: 'running',
        startedAt: now,
        retryCount,
        ownerId: this.workerId,
        leaseExpiresAt: new Date(now.getTime() + this.config.leaseDurationMs),
      },
      isRestart
        ? { expectedStatus: task.status }
        : pinnedHere
          ? { expectedStatus: 'pending', expectedOwnerId: this.workerId }
          : {
              expectedStatus: task.status,
              expectedOwnerId: task.ownerId ?? null,
              expectedLeaseExpiresAt: task.leaseExpiresAt ?? null,
            },
    );
    if (!started) return true;
    this.pinnedPendingLeases.delete(taskId);
    this.ownedLeases.add(taskId);
    if (this.shuttingDown) return false;

    // Publish running lifecycle event (fan-out, for stream consumers)
    const runningTask = await storage.getTask(taskId);
    if (!runningTask || runningTask.status !== 'running') return true;
    await this.publishLifecycleEvent('task.running', runningTask);
    if (this.shuttingDown) return false;

    // Fire-and-forget the workflow run; the workflow step body owns
    // executor invocation, retries, and suspend/resume. The local
    // execution hook still runs here so callers see `onExecution` fire.
    if (!this.#mastra) {
      this.releaseLocalSlot(taskId);
      this.ownedLeases.delete(taskId);
      const markedFailed = await storage.updateTask(
        taskId,
        {
          status: 'failed',
          error: { message: 'Mastra is not registered with this background task manager' },
          completedAt: new Date(),
          ownerId: undefined,
          leaseExpiresAt: undefined,
        },
        { expectedStatus: 'running', expectedOwnerId: this.workerId },
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
      const prevWorkflowRun = isRestart ? await workflow.getWorkflowRunById(taskId) : undefined;
      if (this.shuttingDown) return false;
      const shouldRestart = isRestart && prevWorkflowRun?.status === 'running';
      const run = await workflow.createRun({ runId: taskId });
      if (this.shuttingDown) return false;
      const runPromise = shouldRestart ? run.restart() : run.start({ inputData: { taskId } });
      const action = shouldRestart ? 'restart' : 'start';
      void runPromise
        .then(
          result => {
            if (result.status !== 'suspended') {
              void workflow.deleteWorkflowRunById(taskId);
            }
            if (result.status !== 'success' && result.status !== 'suspended') {
              return this.failUnsettledTask(taskId, action, workflowRunError(result));
            }
          },
          err => this.failUnsettledTask(taskId, action, err),
        )
        .finally(() => {
          // The run has settled (suspended or terminal), so this worker no
          // longer owns the lease: stop renewing it.
          this.ownedLeases.delete(taskId);
          this.releaseLocalSlot(taskId);
          void this.drainPending();
        });
    } catch (error) {
      this.releaseLocalSlot(taskId);
      this.ownedLeases.delete(taskId);
      const markedFailed = await storage.updateTask(
        taskId,
        {
          status: 'failed',
          error: { message: error instanceof Error ? error.message : String(error) },
          completedAt: new Date(),
          ownerId: undefined,
          leaseExpiresAt: undefined,
        },
        { expectedStatus: 'running', expectedOwnerId: this.workerId },
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
    this.inFlightPortableResumes.delete(taskId);

    const storage = await this.getStorage();
    if (this.shuttingDown) return false;
    const task = await storage.getTask(taskId);
    if (this.shuttingDown) return false;
    if (!task || task.status !== 'suspended') {
      // Either gone or already resumed/cancelled by another worker. Drop the
      // event silently — the worker group ensures exactly-once delivery, but
      // the task may have moved on between publish and pickup.
      this.releaseLocalSlot(taskId);
      void this.drainPending();
      return true;
    }

    const resumed = await storage.updateTask(
      taskId,
      {
        status: 'running',
        startedAt: new Date(),
        suspendPayload: undefined,
        suspendedAt: undefined,
        ownerId: this.workerId,
        leaseExpiresAt: new Date(Date.now() + this.config.leaseDurationMs),
      },
      { expectedStatus: 'suspended' },
    );
    if (!resumed) {
      this.releaseLocalSlot(taskId);
      void this.drainPending();
      return true;
    }
    // This suspension is answered; a resume queued here for it is now stale.
    this.localPendingResumes.delete(taskId);
    this.ownedLeases.add(taskId);
    const resumedTask = await storage.getTask(taskId);
    if (resumedTask) {
      await this.publishLifecycleEvent('task.resumed', resumedTask);
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
    void run
      .resume({ resumeData })
      .then(
        result => {
          if (result.status !== 'suspended') {
            void workflow.deleteWorkflowRunById(taskId);
          }
          if (result.status !== 'success' && result.status !== 'suspended') {
            return this.failUnsettledTask(taskId, 'resume', workflowRunError(result));
          }
        },
        err => this.failUnsettledTask(taskId, 'resume', err),
      )
      .finally(() => {
        // The resumed run has settled (suspended or terminal): stop renewing
        // the lease this worker held for it.
        this.ownedLeases.delete(taskId);
        this.releaseLocalSlot(taskId);
        void this.drainPending();
      });
    return true;
  }

  /**
   * Settles a task whose background-task workflow run ended in a non-success,
   * non-suspended state (or rejected). On the ordinary failure path
   * classify-outcome has already moved the task to `failed`, so the CAS below
   * is a no-op. It only takes effect when a step threw before persisting a
   * terminal status (e.g. the `completed` write failed), which would otherwise
   * leave the task `running` forever.
   */
  private async failUnsettledTask(taskId: string, action: 'start' | 'restart' | 'resume', err: unknown) {
    const errorInfo = toTaskError(err);
    try {
      const storage = await this.getStorage();
      const marked = await storage.updateTask(
        taskId,
        {
          status: 'failed',
          error: errorInfo,
          completedAt: new Date(),
          ownerId: undefined,
          leaseExpiresAt: undefined,
        },
        { expectedStatus: 'running', expectedOwnerId: this.workerId },
      );
      if (!marked) return;
      this.#mastra?.getLogger?.()?.error(`background-task workflow ${action} failed for ${taskId}:`, err);
      const failedTask = await storage.getTask(taskId);
      if (failedTask?.status === 'failed') {
        await this.runLocalCompletionHooks(failedTask, 'failed', { error: failedTask.error ?? errorInfo });
        await this.publishLifecycleEvent('task.failed', failedTask);
      }
    } catch (settleError) {
      this.#mastra
        ?.getLogger?.()
        ?.error(`background-task workflow ${action} failed for ${taskId} and the task could not be marked failed:`, {
          error: err,
          settleError,
        });
      this.deregisterTaskContext(taskId);
    }
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
    } catch (hookError) {
      // Callers publish the terminal lifecycle event right after this; a
      // throwing per-task hook must not suppress it.
      this.#mastra?.getLogger?.()?.warn(`background-task ${status} hooks threw for ${task.id}:`, hookError);
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
        // Output events can fire once per chunk; subscribers never read `args`
        // from them, so don't repeat a possibly large input on each one.
        args: type === 'task.output' ? undefined : task.args,
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

  /**
   * Renew every lease this manager holds, at `leaseDurationMs / 3`. Called on
   * an interval so a live owner keeps proving liveness; a task whose renewal
   * fails has left `running` (completed/failed/suspended/cancelled) or been
   * reclaimed by another owner, so it is dropped from the tracking set.
   */
  async #renewOwnedLeases(): Promise<void> {
    if (this.ownedLeases.size === 0 && this.pinnedPendingLeases.size === 0) return;
    let storage;
    try {
      storage = await this.getStorage();
    } catch {
      // Storage unavailable mid-shutdown — leases expire on their own.
      return;
    }
    for (const taskId of [...this.ownedLeases]) {
      try {
        // Fenced on the owner so a worker whose lease already lapsed (and whose
        // task was reclaimed) cannot revive it.
        const renewed = await storage.updateTask(
          taskId,
          { leaseExpiresAt: new Date(Date.now() + this.config.leaseDurationMs) },
          { expectedStatus: 'running', expectedOwnerId: this.workerId },
        );
        if (!renewed) {
          this.ownedLeases.delete(taskId);
          await this.#abortSupersededRun(taskId);
        }
      } catch {
        // Transient storage error — keep the lease tracked and retry next tick.
      }
    }
    for (const taskId of [...this.pinnedPendingLeases]) {
      try {
        // A failed renewal means the row was claimed, cancelled, or recovered
        // by another worker after this lease lapsed — stop tracking it.
        const renewed = await storage.updateTask(
          taskId,
          { leaseExpiresAt: new Date(Date.now() + this.config.leaseDurationMs) },
          { expectedStatus: 'pending', expectedOwnerId: this.workerId },
        );
        if (!renewed) this.pinnedPendingLeases.delete(taskId);
      } catch {
        // Transient storage error — retry next tick.
      }
    }
  }

  /**
   * Called when a lease renewal loses its compare-and-set. Renewal normally
   * fails because the task left `running` (it completed, failed, suspended or
   * was cancelled), which needs no action. When the task is *still running under
   * a different owner*, another worker has taken it over, so the local run is
   * aborted to stop a superseded executor from doing further work. Its fenced
   * terminal writes would be rejected anyway; aborting just stops the wasted run.
   */
  async #abortSupersededRun(taskId: string): Promise<void> {
    try {
      const storage = await this.getStorage();
      const current = await storage.getTask(taskId);
      if (current?.status !== 'running') return;
      if (current.ownerId === this.workerId || !current.ownerId) return;
      const controller = this.activeAbortControllers.get(taskId);
      if (!controller) return;
      controller.abort(new Error(TASK_OWNERSHIP_LOST_MESSAGE));
    } catch {
      // Storage unavailable — the run will be superseded on its next write.
    }
  }

  #startLeaseHeartbeat(): void {
    if (this.heartbeatInterval) return;
    const intervalMs = Math.max(1_000, Math.floor(this.config.leaseDurationMs / 3));
    this.heartbeatInterval = setInterval(() => {
      void this.#renewOwnedLeases();
      // Storage-wide admission can be freed by another process, which never
      // triggers a local drain. Retry queued resumes on each tick.
      if (this.localPendingResumes.size > 0) void this.drainPending();
    }, intervalMs);
    // Never keep the process alive just to renew leases.
    this.heartbeatInterval.unref?.();
  }

  private reserveLocalSlot(task: Pick<BackgroundTask, 'id' | 'agentId'>): boolean {
    if (this.localReservations.has(task.id)) return true;
    if (this.localReservations.size >= this.config.globalConcurrency) return false;

    let agentRunning = 0;
    for (const agentId of this.localReservations.values()) {
      if (agentId === task.agentId) agentRunning++;
    }
    if (agentRunning >= this.#ownerLimit(task.agentId)) return false;

    this.localReservations.set(task.id, task.agentId);
    return true;
  }

  #ownerLimit(agentId: string): number {
    const overrides = this.config.perOwnerConcurrency;
    return overrides && Object.hasOwn(overrides, agentId) ? overrides[agentId]! : this.config.perAgentConcurrency;
  }

  private releaseLocalSlot(taskId: string): void {
    this.localReservations.delete(taskId);
  }

  private async checkConcurrency(agentId: string): Promise<boolean> {
    const storage = await this.getStorage();
    let inFlightForAgent = 0;
    for (const entry of this.inFlightPortableResumes.values()) {
      if (entry.agentId === agentId) inFlightForAgent++;
    }
    const globalRunning = (await storage.getRunningCount()) + this.inFlightPortableResumes.size;
    if (globalRunning >= this.config.globalConcurrency) {
      return false;
    }

    const agentRunning = (await storage.getRunningCountByAgent(agentId)) + inFlightForAgent;
    if (agentRunning >= this.#ownerLimit(agentId)) {
      return false;
    }

    return true;
  }

  async #pruneInFlightResumes(): Promise<void> {
    if (this.inFlightPortableResumes.size === 0) return;
    const storage = await this.getStorage();
    const now = Date.now();
    for (const [taskId, entry] of [...this.inFlightPortableResumes]) {
      if (entry.until <= now) {
        this.inFlightPortableResumes.delete(taskId);
        continue;
      }
      // Once the row leaves this suspension, storage counts it (or it is done).
      const task = await storage.getTask(taskId);
      if (!task || task.status !== 'suspended' || suspensionToken(task) !== entry.suspendedAt) {
        this.inFlightPortableResumes.delete(taskId);
      }
    }
  }

  private async drainPending(): Promise<void> {
    if (this.drainingPending || this.shuttingDown) return;
    this.drainingPending = true;

    try {
      const storage = await this.getStorage();
      await this.#pruneInFlightResumes();
      // Queued resumes go first: they continue work that already started.
      for (const [taskId, entry] of [...this.localPendingResumes]) {
        const task = await storage.getTask(taskId);
        // Drop the entry if the task left the suspension it was queued for —
        // including being resumed elsewhere and suspending again.
        if (!task || task.status !== 'suspended' || suspensionToken(task) !== entry.suspendedAt) {
          this.localPendingResumes.delete(taskId);
          continue;
        }

        const isProcessAffine = this.taskContexts.has(taskId);
        const canRun = isProcessAffine ? this.reserveLocalSlot(task) : await this.checkConcurrency(task.agentId);
        if (!canRun) continue;
        if (this.shuttingDown) return;

        this.localPendingResumes.delete(taskId);
        try {
          await this.#publishResume(task, entry.resumeData, isProcessAffine);
        } catch (error) {
          this.localPendingResumes.set(taskId, entry);
          this.#mastra?.getLogger?.()?.warn(`background-task resume failed while draining ${taskId}:`, error as any);
          return;
        }
      }

      for (const taskId of [...this.localPendingTaskIds]) {
        const task = await storage.getTask(taskId);
        if (!task || task.status !== 'pending') {
          this.localPendingTaskIds.delete(taskId);
          continue;
        }

        const isProcessAffine = this.taskContexts.has(taskId);
        const canRun = isProcessAffine ? this.reserveLocalSlot(task) : await this.checkConcurrency(task.agentId);
        if (!canRun) continue;

        this.localPendingTaskIds.delete(taskId);
        try {
          await this.dispatch(task);
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
   *
   * Running tasks are only reclaimed once their execution lease has lapsed, so
   * one whose owner died moments before this scan is still protected. When that
   * happens the scan reschedules itself for the moment the earliest such lease
   * expires — see `#scheduleStaleRecovery`.
   */
  private async recoverStaleTasks(): Promise<void> {
    if (this.shuttingDown) return;
    try {
      const storage = await this.getStorage();
      const now = Date.now();
      const { tasks: staleTasks } = await storage.listTasks({ status: 'running' });
      let nextSweepAt: number | undefined;
      for (const task of staleTasks) {
        // A still-valid lease proves the owner is alive — do not reclaim it.
        // This is what stops a second worker from taking over a task another
        // process is actively running.
        if (task.ownerId && task.leaseExpiresAt && task.leaseExpiresAt.getTime() > now) {
          const leaseExpiry = task.leaseExpiresAt.getTime();
          nextSweepAt = nextSweepAt === undefined ? leaseExpiry : Math.min(nextSweepAt, leaseExpiry);
          continue;
        }

        // Fence the reclaim on the owner/lease we observed. If another worker
        // reclaimed this task between the list and now, the compare-and-set
        // fails and we leave it to them instead of clobbering their run.
        const fence = {
          expectedStatus: 'running' as const,
          expectedOwnerId: task.ownerId ?? null,
          expectedLeaseExpiresAt: task.leaseExpiresAt ?? null,
        };
        if (task.maxRetries > 0) {
          await storage.updateTask(
            task.id,
            {
              status: 'pending',
              startedAt: undefined,
              ownerId: undefined,
              leaseExpiresAt: undefined,
            },
            fence,
          );
        } else {
          await storage.updateTask(
            task.id,
            {
              status: 'failed',
              error: { message: 'Worker process terminated before task completed' },
              completedAt: new Date(),
              ownerId: undefined,
              leaseExpiresAt: undefined,
            },
            fence,
          );
        }
      }

      const { tasks: pendingTasks } = await storage.listTasks({
        status: 'pending',
        orderBy: 'createdAt',
        orderDirection: 'asc',
      });
      for (const task of pendingTasks) {
        if (task.ownerId) {
          // Pinned with `pinToWorker`: work for the row is in flight on its
          // owner. Leave it alone while the owner keeps renewing the lease.
          const leaseExpiry = task.leaseExpiresAt?.getTime();
          if (leaseExpiry !== undefined && leaseExpiry > now) {
            nextSweepAt = nextSweepAt === undefined ? leaseExpiry : Math.min(nextSweepAt, leaseExpiry);
            continue;
          }
          // The owner died with the work in flight: account for the lost
          // attempt exactly like a `running` row whose lease lapsed.
          const fence = {
            expectedStatus: 'pending' as const,
            expectedOwnerId: task.ownerId,
            expectedLeaseExpiresAt: task.leaseExpiresAt ?? null,
          };
          if (task.retryCount < task.maxRetries) {
            const unpinned = await storage.updateTask(
              task.id,
              { retryCount: task.retryCount + 1, ownerId: undefined, leaseExpiresAt: undefined },
              fence,
            );
            if (!unpinned) continue;
          } else {
            await storage.updateTask(
              task.id,
              {
                status: 'failed',
                error: { message: 'Worker process terminated before task completed' },
                completedAt: new Date(),
                ownerId: undefined,
                leaseExpiresAt: undefined,
              },
              fence,
            );
            continue;
          }
        }
        if (await this.checkConcurrency(task.agentId)) {
          await this.dispatch(task);
        }
      }

      this.#scheduleStaleRecovery(nextSweepAt);
    } catch (error) {
      const logger = this.#mastra?.getLogger();
      if (logger) {
        logger.error('Failed to recover stale background tasks', error);
      }
    }
  }

  /**
   * Re-runs the stale-task scan once the earliest still-valid lease lapses.
   * Rescheduling is harmless while an owner stays alive: its heartbeat keeps
   * pushing the expiry out, so each pass simply schedules the next one.
   */
  #scheduleStaleRecovery(nextSweepAt: number | undefined): void {
    if (this.staleRecoveryTimeout) {
      clearTimeout(this.staleRecoveryTimeout);
      this.staleRecoveryTimeout = undefined;
    }
    if (nextSweepAt === undefined || this.shuttingDown) return;

    // Wait just past the lease expiry (clocks drift between workers), but bound
    // the delay so a stray far-future lease cannot park recovery indefinitely.
    const delay = Math.min(
      Math.max(nextSweepAt - Date.now() + 1_000, 1_000),
      Math.max(this.config.leaseDurationMs, 1_000),
    );
    this.staleRecoveryTimeout = setTimeout(() => {
      this.staleRecoveryTimeout = undefined;
      void this.recoverStaleTasks();
    }, delay);
    // Never keep the process alive just to sweep for stale tasks.
    this.staleRecoveryTimeout.unref?.();
  }
}

function suspensionToken(task: BackgroundTask): number | null {
  return task.suspendedAt?.getTime() ?? null;
}
