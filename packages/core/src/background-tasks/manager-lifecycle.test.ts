import EventEmitter from 'node:events';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { EventEmitterPubSub } from '../events/event-emitter';
import type { Event, EventCallback, SubscribeOptions } from '../events/types';
import { Mastra } from '../mastra';
import { InMemoryStore, MockStore } from '../storage';
import { BackgroundTasksInMemory } from '../storage/domains/background-tasks/inmemory';
import { InMemoryDB } from '../storage/domains/inmemory-db';
import { BackgroundTaskManager } from './manager';
import type { BackgroundTask, UpdateBackgroundTask, UpdateBackgroundTaskOptions } from './types';
import { BACKGROUND_TASK_WORKFLOW_ID } from './workflow-id';

function deferred<T = void>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  const promise = new Promise<T>(r => {
    resolve = r;
  });
  return { promise, resolve };
}

class GatedSubscribePubSub extends EventEmitterPubSub {
  readonly subscribeStarted = deferred();
  readonly subscribeGate = deferred();
  #gated = false;

  override async subscribe(topic: string, cb: EventCallback, options?: SubscribeOptions): Promise<void> {
    if (!this.#gated) {
      this.#gated = true;
      this.subscribeStarted.resolve();
      await this.subscribeGate.promise;
    }
    await super.subscribe(topic, cb, options);
  }
}

class NeverSubscribePubSub extends EventEmitterPubSub {
  readonly subscribeStarted = deferred();

  override async subscribe(): Promise<void> {
    this.subscribeStarted.resolve();
    await new Promise<void>(() => {});
  }
}

class ResultGatedPubSub extends EventEmitterPubSub {
  readonly subscribeStarted = deferred();
  readonly subscribeGate = deferred();

  override async subscribe(topic: string, cb: EventCallback, options?: SubscribeOptions): Promise<void> {
    if (topic === 'background-tasks-result') {
      this.subscribeStarted.resolve();
      await this.subscribeGate.promise;
    }
    await super.subscribe(topic, cb, options);
  }
}

class CapturingPubSub extends EventEmitterPubSub {
  dispatchCallback?: EventCallback;
  resultCallback?: EventCallback;

  override async subscribe(topic: string, cb: EventCallback, options?: SubscribeOptions): Promise<void> {
    if (topic === 'background-tasks') this.dispatchCallback = cb;
    if (topic === 'background-tasks-result') this.resultCallback = cb;
    await super.subscribe(topic, cb, options);
  }
}

class SilentPublishPubSub extends EventEmitterPubSub {
  override async publish(): Promise<void> {}
}

/**
 * In-memory store whose workflows and background-task domains reject every
 * call once `close()` has run, like LibSQL's client does with CLIENT_CLOSED.
 * `failDeletes` makes run deletes reject regardless; `holdTaskDeletesUntilClose`
 * parks `deleteTasks` calls until the store closes, so they land on it closed.
 */
class ClosableStore extends InMemoryStore {
  closed = false;
  failDeletes = false;
  holdTaskDeletesUntilClose = false;
  readonly taskDeleteStarted = deferred();
  readonly #closedSignal = deferred();

  constructor() {
    super();
    this.stores.workflows = this.#rejectWhenClosed(this.stores.workflows!);
    this.stores.backgroundTasks = this.#rejectWhenClosed(this.stores.backgroundTasks!);
  }

  #rejectWhenClosed<T extends object>(domain: T): T {
    return new Proxy(domain, {
      get: (target, prop, receiver) => {
        const value = Reflect.get(target, prop, receiver);
        if (typeof value !== 'function') return value;
        return (...args: unknown[]) => {
          if (this.holdTaskDeletesUntilClose && prop === 'deleteTasks') {
            this.taskDeleteStarted.resolve();
            return this.#closedSignal.promise.then(() =>
              Promise.reject(new Error('CLIENT_CLOSED: The client is closed')),
            );
          }
          if (this.closed) return Promise.reject(new Error('CLIENT_CLOSED: The client is closed'));
          if (this.failDeletes && prop === 'deleteWorkflowRunById') return Promise.reject(new Error('delete failed'));
          return value.apply(target, args);
        };
      },
    });
  }

  override async close(): Promise<void> {
    this.closed = true;
    this.#closedSignal.resolve();
  }
}

function recordUnhandledRejections() {
  const rejections: unknown[] = [];
  const onRejection = (reason: unknown) => rejections.push(reason);
  process.on('unhandledRejection', onRejection);
  return { rejections, stop: () => process.off('unhandledRejection', onRejection) };
}

function waitUntilAborted(_args: unknown, { abortSignal }: { abortSignal?: AbortSignal } = {}) {
  return new Promise(resolve => abortSignal?.addEventListener('abort', () => resolve('stopped'), { once: true }));
}

function makeRunningTask(overrides: Partial<BackgroundTask> = {}): BackgroundTask {
  return {
    id: 'task-1',
    status: 'running',
    toolName: 'slow-tool',
    toolCallId: 'call-1',
    args: {},
    agentId: 'agent-1',
    runId: 'run-1',
    createdAt: new Date(),
    startedAt: new Date(),
    retryCount: 0,
    maxRetries: 1,
    timeoutMs: 60_000,
    ...overrides,
  };
}

describe('BackgroundTaskManager lifecycle', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('does not install resources after shutdown starts during initialization', async () => {
    const emitter = new EventEmitter();
    const pubsub = new GatedSubscribePubSub(emitter);
    const mastra = new Mastra({ logger: false, storage: new MockStore(), workers: false });
    const manager = new BackgroundTaskManager({ enabled: true });
    manager.__registerMastra(mastra);

    const initPromise = manager.init(pubsub);
    await pubsub.subscribeStarted.promise;
    const shutdownPromise = manager.shutdown();
    pubsub.subscribeGate.resolve();

    try {
      await Promise.all([initPromise, shutdownPromise]);
      expect(emitter.listenerCount('background-tasks')).toBe(0);
      expect(emitter.listenerCount('background-tasks-result')).toBe(0);
    } finally {
      await manager.shutdown();
      await pubsub.close();
      await mastra.shutdown();
      mastra.__unregisterHooks();
    }
  });

  it('releases every subscription when shutdown starts during the final initialization step', async () => {
    const emitter = new EventEmitter();
    const pubsub = new ResultGatedPubSub(emitter);
    const manager = new BackgroundTaskManager({ enabled: true, recoverStaleTasksOnStart: false });

    const initPromise = manager.init(pubsub);
    await pubsub.subscribeStarted.promise;
    const shutdownPromise = manager.shutdown();
    pubsub.subscribeGate.resolve();

    await Promise.all([initPromise, shutdownPromise]);
    expect(emitter.eventNames()).toEqual([]);
    await pubsub.close();
  });

  it('preserves resolved defaults when optional config values are explicitly undefined', () => {
    const manager = new BackgroundTaskManager({ enabled: true, recoverStaleTasksOnStart: undefined });

    expect((manager as any).config.recoverStaleTasksOnStart).toBe(true);
  });

  it('allows shutdown before initialization', async () => {
    const manager = new BackgroundTaskManager({ enabled: true });

    await expect(manager.shutdown()).resolves.toBeUndefined();
    await expect(manager.shutdown()).resolves.toBeUndefined();
  });

  it('bounds shutdown while initialization is stuck in a remote subscribe', async () => {
    vi.useFakeTimers();
    const pubsub = new NeverSubscribePubSub();
    const manager = new BackgroundTaskManager({ enabled: true });
    void manager.init(pubsub);
    await pubsub.subscribeStarted.promise;

    const shutdownPromise = manager.shutdown();
    let settled = false;
    void shutdownPromise.then(() => {
      settled = true;
    });

    await vi.advanceTimersByTimeAsync(4_999);
    expect(settled).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    await expect(shutdownPromise).resolves.toBeUndefined();
  });

  it('bounds cancellation waits and still aborts the local executor', async () => {
    vi.useFakeTimers();
    const mastra = new Mastra({ logger: false, storage: new MockStore(), workers: false });
    const manager = new BackgroundTaskManager({ enabled: true });
    manager.__registerMastra(mastra);
    const storage = await manager.getStorage();
    await storage.createTask(makeRunningTask({ maxRetries: 0 }));
    const controller = new AbortController();
    manager.activeAbortControllers.set('task-1', controller);
    vi.spyOn(manager, 'cancel').mockReturnValue(new Promise<void>(() => {}));

    const shutdownPromise = manager.shutdown();
    await vi.advanceTimersByTimeAsync(5_000);

    await expect(shutdownPromise).resolves.toBeUndefined();
    expect(controller.signal.aborted).toBe(true);
    mastra.__unregisterHooks();
  });

  it('bounds the whole shutdown sequence with a single grace period', async () => {
    vi.useFakeTimers();
    const pubsub = new NeverSubscribePubSub();
    const mastra = new Mastra({ logger: false, storage: new MockStore(), workers: false });
    const manager = new BackgroundTaskManager({ enabled: true });
    manager.__registerMastra(mastra);
    const storage = await manager.getStorage();
    await storage.createTask(makeRunningTask({ maxRetries: 0 }));
    void manager.init(pubsub);
    await pubsub.subscribeStarted.promise;

    const controller = new AbortController();
    manager.activeAbortControllers.set('task-1', controller);
    vi.spyOn(manager, 'cancel').mockReturnValue(new Promise<void>(() => {}));

    const shutdownPromise = manager.shutdown();
    let settled = false;
    void shutdownPromise.then(() => {
      settled = true;
    });
    await vi.advanceTimersByTimeAsync(4_999);
    expect(settled).toBe(false);
    await vi.advanceTimersByTimeAsync(1);

    await expect(shutdownPromise).resolves.toBeUndefined();
    expect(controller.signal.aborted).toBe(true);
    mastra.__unregisterHooks();
  });

  it('bounds shutdown by a caller-provided deadline instead of its own grace period', async () => {
    vi.useFakeTimers();
    const pubsub = new NeverSubscribePubSub();
    const manager = new BackgroundTaskManager({ enabled: true });
    void manager.init(pubsub);
    await pubsub.subscribeStarted.promise;

    // Mastra.shutdown() shares its drain deadline; the manager must not add
    // a further 5 s on top of it.
    const shutdownPromise = manager.shutdown({ deadline: Date.now() + 1_000 });
    let settled = false;
    void shutdownPromise.then(() => {
      settled = true;
    });

    await vi.advanceTimersByTimeAsync(999);
    expect(settled).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    await expect(shutdownPromise).resolves.toBeUndefined();
  });

  it('logs task cancellation failures during shutdown', async () => {
    const mastra = new Mastra({ logger: false, storage: new MockStore(), workers: false });
    const warn = vi.spyOn(mastra.getLogger(), 'warn');
    const manager = new BackgroundTaskManager({ enabled: true });
    manager.__registerMastra(mastra);
    const storage = await manager.getStorage();
    await storage.createTask(makeRunningTask({ maxRetries: 0 }));
    manager.activeAbortControllers.set('task-1', new AbortController());
    const error = new Error('storage unavailable');
    vi.spyOn(manager, 'cancel').mockRejectedValue(error);

    try {
      await manager.shutdown();
      expect(warn).toHaveBeenCalledWith('Failed to cancel background task task-1 during shutdown:', error);
    } finally {
      mastra.__unregisterHooks();
    }
  });

  it('finishes deleting a running task workflow run before Mastra closes storage on shutdown', async () => {
    // A task aborted by shutdown settles after manager.shutdown() used to return,
    // so its fire-and-forget run delete hit the already-closed store and became
    // an unhandled rejection, which crashes Node mid-shutdown.
    const store = new ClosableStore();
    const mastra = new Mastra({ logger: false, storage: store, backgroundTasks: { enabled: true } });
    const manager = mastra.backgroundTaskManager!;
    manager.registerStaticExecutor('wait', { execute: waitUntilAborted });
    const unhandled = recordUnhandledRejections();

    try {
      const { task } = await manager.enqueue({
        runId: 'run-1',
        toolName: 'wait',
        toolCallId: 'call-1',
        args: {},
        agentId: 'agent-1',
      });
      await vi.waitFor(async () => expect((await manager.getTask(task.id))?.status).toBe('running'));
      const workflowsStore = await store.getStore('workflows');
      const backgroundTaskRun = () =>
        workflowsStore!.getWorkflowRunById({ runId: task.id, workflowName: BACKGROUND_TASK_WORKFLOW_ID });
      await vi.waitFor(async () => expect(await backgroundTaskRun()).not.toBeNull());

      await mastra.shutdown();
      await new Promise(resolve => setTimeout(resolve, 200));

      expect(unhandled.rejections).toEqual([]);
      store.closed = false;
      expect(await backgroundTaskRun()).toBeNull();
    } finally {
      unhandled.stop();
    }
  });

  it('logs a failed workflow run delete instead of rejecting unhandled', async () => {
    const store = new ClosableStore();
    store.failDeletes = true;
    const mastra = new Mastra({ logger: false, storage: store, backgroundTasks: { enabled: true } });
    const warn = vi.spyOn(mastra.getLogger(), 'warn');
    const manager = mastra.backgroundTaskManager!;
    manager.registerStaticExecutor('quick', { execute: async () => 'done' });
    const unhandled = recordUnhandledRejections();

    try {
      const { task } = await manager.enqueue({
        runId: 'run-1',
        toolName: 'quick',
        toolCallId: 'call-1',
        args: {},
        agentId: 'agent-1',
      });
      await vi.waitFor(async () => expect((await manager.getTask(task.id))?.status).toBe('completed'));
      await vi.waitFor(() =>
        expect(warn).toHaveBeenCalledWith(
          `Failed to delete workflow run for background task ${task.id}:`,
          expect.objectContaining({ message: 'delete failed' }),
        ),
      );
      await new Promise(resolve => setTimeout(resolve, 50));
      expect(unhandled.rejections).toEqual([]);
    } finally {
      unhandled.stop();
      await mastra.shutdown();
    }
  });

  it('logs a cleanup tick that lands on storage closed by shutdown instead of rejecting unhandled', async () => {
    // Shutdown clears the cleanup interval, but a tick already deleting task
    // records keeps going and finishes after Mastra has closed storage.
    const store = new ClosableStore();
    store.holdTaskDeletesUntilClose = true;
    const mastra = new Mastra({
      logger: false,
      storage: store,
      backgroundTasks: { enabled: true, cleanup: { cleanupIntervalMs: 20 } },
    });
    const warn = vi.spyOn(mastra.getLogger(), 'warn');
    const unhandled = recordUnhandledRejections();

    try {
      await store.taskDeleteStarted.promise;
      await mastra.shutdown();
      await new Promise(resolve => setTimeout(resolve, 50));

      expect(unhandled.rejections).toEqual([]);
      expect(warn).toHaveBeenCalledWith(
        'Background task cleanup failed:',
        expect.objectContaining({ message: 'CLIENT_CLOSED: The client is closed' }),
      );
    } finally {
      unhandled.stop();
    }
  });

  it('declines a resume caught mid-preparation by shutdown and keeps the task suspended', async () => {
    // The resume event flips the task to `running` and then awaits the run.
    // If shutdown starts in that gap, it must not start the run against a
    // store that is about to close, and the task must stay resumable.
    const store = new ClosableStore();
    const mastra = new Mastra({ logger: false, storage: store, backgroundTasks: { enabled: true } });
    const manager = mastra.backgroundTaskManager!;
    const execute = vi.fn(async (_args: unknown, opts: any) => {
      if (!opts.resumeData) return opts.suspend({ waiting: true });
      return opts.resumeData;
    });
    manager.registerStaticExecutor('approval', { execute });
    const unhandled = recordUnhandledRejections();

    try {
      const { task } = await manager.enqueue({
        runId: 'run-1',
        toolName: 'approval',
        toolCallId: 'call-1',
        args: {},
        agentId: 'agent-1',
      });
      await vi.waitFor(async () => expect((await manager.getTask(task.id))?.status).toBe('suspended'));

      const workflow = mastra.__getInternalWorkflow(BACKGROUND_TASK_WORKFLOW_ID);
      const createRun = workflow.createRun.bind(workflow);
      const createRunStarted = deferred();
      const createRunGate = deferred();
      vi.spyOn(workflow, 'createRun').mockImplementation(async (...args) => {
        createRunStarted.resolve();
        await createRunGate.promise;
        return createRun(...args);
      });

      await manager.resume(task.id, { ok: true });
      await createRunStarted.promise;
      expect((await manager.getTask(task.id))?.status).toBe('running');

      const shutdown = mastra.shutdown();
      await new Promise(resolve => setTimeout(resolve, 20));
      createRunGate.resolve();
      await shutdown;
      await new Promise(resolve => setTimeout(resolve, 50));

      expect(unhandled.rejections).toEqual([]);
      expect(execute).toHaveBeenCalledTimes(1);
      store.closed = false;
      const backgroundTasks = await store.getStore('backgroundTasks');
      expect(await backgroundTasks!.getTask(task.id)).toMatchObject({
        status: 'suspended',
        suspendPayload: { waiting: true },
        ownerId: undefined,
        leaseExpiresAt: undefined,
      });
    } finally {
      unhandled.stop();
    }
  });

  it('leaves retryable running tasks recoverable across shutdown', async () => {
    const pubsub = new SilentPublishPubSub();
    const mastra = new Mastra({ logger: false, storage: new MockStore(), workers: false });
    const manager = new BackgroundTaskManager({ enabled: true });
    manager.__registerMastra(mastra);
    await manager.init(pubsub);
    const storage = await manager.getStorage();
    await storage.createTask(makeRunningTask());
    const controller = new AbortController();
    manager.activeAbortControllers.set('task-1', controller);

    const recoveringManager = new BackgroundTaskManager({ enabled: true });
    recoveringManager.__registerMastra(mastra);
    try {
      await manager.shutdown();
      expect(controller.signal.aborted).toBe(true);
      expect(await storage.getTask('task-1')).toMatchObject({ status: 'running' });

      await recoveringManager.init(pubsub);
      expect(await storage.getTask('task-1')).toMatchObject({ status: 'pending' });
    } finally {
      await recoveringManager.shutdown();
      await pubsub.close();
      await mastra.shutdown();
      mastra.__unregisterHooks();
    }
  });

  it('does not acknowledge dispatches delivered after shutdown starts', async () => {
    const pubsub = new CapturingPubSub();
    const manager = new BackgroundTaskManager({ enabled: true });
    await manager.init(pubsub);
    const callback = pubsub.dispatchCallback!;
    const ack = vi.fn(async () => {});
    const nack = vi.fn(async () => {});
    const event: Event = {
      type: 'task.dispatch',
      id: 'event-1',
      data: { taskId: 'task-1' },
      runId: 'task-1',
      createdAt: new Date(),
    };

    const shutdownPromise = manager.shutdown();
    await callback(event, ack, nack);

    expect(ack).not.toHaveBeenCalled();
    expect(nack).not.toHaveBeenCalled();
    await shutdownPromise;
    await pubsub.close();
  });

  it('does not acknowledge an in-flight dispatch interrupted by shutdown', async () => {
    const pubsub = new CapturingPubSub();
    const manager = new BackgroundTaskManager({ enabled: true });
    await manager.init(pubsub);
    const getTaskStarted = deferred();
    const getTaskGate = deferred();
    manager.__registerMastra({
      getStorage: () => ({
        getStore: async () => ({
          getTask: async () => {
            getTaskStarted.resolve();
            await getTaskGate.promise;
            return null;
          },
        }),
      }),
    } as unknown as Mastra);
    const ack = vi.fn(async () => {});
    const event: Event = {
      type: 'task.dispatch',
      id: 'event-1',
      data: { taskId: 'task-1' },
      runId: 'task-1',
      createdAt: new Date(),
    };

    const callbackPromise = pubsub.dispatchCallback!(event, ack);
    await getTaskStarted.promise;
    const shutdownPromise = manager.shutdown();
    getTaskGate.resolve();
    await callbackPromise;

    expect(ack).not.toHaveBeenCalled();
    await shutdownPromise;
    await pubsub.close();
  });

  it.each(
    (['completed', 'failed', 'timed_out', 'suspended'] as const).flatMap(status =>
      ([undefined, 1, 2] as const).map(deliveryAttempt => ({ status, deliveryAttempt })),
    ),
  )(
    'ignores a stale dispatch for a $status task at delivery attempt $deliveryAttempt',
    async ({ status, deliveryAttempt }) => {
      const pubsub = new CapturingPubSub();
      const manager = new BackgroundTaskManager({ enabled: true });
      await manager.init(pubsub);

      const task = makeRunningTask({ status });
      const updateTask = vi.fn(async () => {});
      const createRun = vi.fn();
      const getInternalWorkflow = vi.fn(() => ({ createRun }));
      const executionHook = vi.spyOn(manager, 'runLocalExecutionHook');
      manager.registerTaskContext(task.id, { executor: { execute: vi.fn() } });
      manager.__registerMastra({
        getStorage: () => ({
          getStore: async () => ({
            getTask: async () => task,
            updateTask,
            listTasks: async () => ({ tasks: [] }),
          }),
        }),
        __getInternalWorkflow: getInternalWorkflow,
      } as unknown as Mastra);
      const publish = vi.spyOn(pubsub, 'publish');
      const ack = vi.fn(async () => {});
      const event: Event = {
        type: 'task.dispatch',
        id: 'event-1',
        data: { taskId: task.id },
        runId: task.id,
        createdAt: new Date(),
        ...(deliveryAttempt === undefined ? {} : { deliveryAttempt }),
      };

      await pubsub.dispatchCallback!(event, ack);

      expect(ack).toHaveBeenCalledOnce();
      expect(updateTask).not.toHaveBeenCalled();
      expect(publish).not.toHaveBeenCalled();
      expect(executionHook).not.toHaveBeenCalled();
      expect(getInternalWorkflow).not.toHaveBeenCalled();
      expect(createRun).not.toHaveBeenCalled();
      expect(manager.taskContexts.has(task.id)).toBe(true);
      await manager.shutdown();
      await pubsub.close();
    },
  );

  it.each([undefined, 1])('ignores a duplicate first delivery for a running task (%s)', async deliveryAttempt => {
    const pubsub = new CapturingPubSub();
    const manager = new BackgroundTaskManager({ enabled: true });
    await manager.init(pubsub);

    const task = makeRunningTask();
    const updateTask = vi.fn(async () => {});
    const getInternalWorkflow = vi.fn();
    manager.__registerMastra({
      getStorage: () => ({
        getStore: async () => ({
          getTask: async () => task,
          updateTask,
          listTasks: async () => ({ tasks: [] }),
        }),
      }),
      __getInternalWorkflow: getInternalWorkflow,
    } as unknown as Mastra);
    const ack = vi.fn(async () => {});
    const event: Event = {
      type: 'task.dispatch',
      id: 'event-1',
      data: { taskId: task.id },
      runId: task.id,
      createdAt: new Date(),
      ...(deliveryAttempt === undefined ? {} : { deliveryAttempt }),
    };

    await pubsub.dispatchCallback!(event, ack);

    expect(ack).toHaveBeenCalledOnce();
    expect(updateTask).not.toHaveBeenCalled();
    expect(getInternalWorkflow).not.toHaveBeenCalled();
    await manager.shutdown();
    await pubsub.close();
  });

  it('does not start a pending task that is cancelled while dispatch is claiming it', async () => {
    const pubsub = new CapturingPubSub();
    const mastra = new Mastra({ logger: false, storage: new MockStore(), workers: false });
    const manager = new BackgroundTaskManager({ enabled: true });
    manager.__registerMastra(mastra);
    await manager.init(pubsub);

    const task = makeRunningTask({ status: 'pending', startedAt: undefined });
    const storage = await manager.getStorage();
    await storage.createTask(task);
    const claimStarted = deferred();
    const claimGate = deferred();
    const originalUpdateTask = storage.updateTask.bind(storage);
    vi.spyOn(storage, 'updateTask').mockImplementation(async (taskId, update, options) => {
      if (update.status === 'running') {
        claimStarted.resolve();
        await claimGate.promise;
      }
      return originalUpdateTask(taskId, update, options);
    });

    const execute = vi.fn();
    manager.registerTaskContext(task.id, { executor: { execute } });
    const createRun = vi.spyOn(mastra.__getInternalWorkflow(BACKGROUND_TASK_WORKFLOW_ID), 'createRun');
    const ack = vi.fn(async () => {});
    const event: Event = {
      type: 'task.dispatch',
      id: 'event-1',
      data: { taskId: task.id },
      runId: task.id,
      createdAt: new Date(),
    };

    const dispatchPromise = pubsub.dispatchCallback!(event, ack);
    await claimStarted.promise;
    await manager.cancel(task.id);
    claimGate.resolve();
    await dispatchPromise;

    expect((await storage.getTask(task.id))!.status).toBe('cancelled');
    expect(createRun).not.toHaveBeenCalled();
    expect(execute).not.toHaveBeenCalled();
    expect(ack).toHaveBeenCalledOnce();
    await manager.shutdown();
    await pubsub.close();
    await mastra.shutdown();
    mastra.__unregisterHooks();
  });

  it('acknowledges completed results and cleans up when the global completion callback rejects', async () => {
    const pubsub = new CapturingPubSub();
    const mockStore = new MockStore();
    const mastra = new Mastra({ logger: false, storage: mockStore, workers: false });
    const error = new Error('completion callback failed');
    const manager = new BackgroundTaskManager({
      enabled: true,
      recoverStaleTasksOnStart: false,
      onTaskComplete: async () => {
        throw error;
      },
    });
    manager.__registerMastra(mastra);
    const warn = vi.spyOn(mastra.getLogger(), 'warn');
    const drainPending = vi.spyOn(manager as any, 'drainPending').mockResolvedValue(undefined);
    const storage = await mockStore.getStore('backgroundTasks');
    if (!storage) throw new Error('Background task storage is unavailable');
    const task = makeRunningTask({ status: 'completed', completedAt: new Date(), result: { ok: true } });
    await storage.createTask(task);
    manager.registerTaskContext(task.id, { executor: { execute: vi.fn() } });

    try {
      await manager.init(pubsub);
      const ack = vi.fn(async () => {});
      const event: Event = {
        type: 'task.completed',
        id: 'event-1',
        data: { ...task, taskId: task.id },
        runId: task.runId,
        createdAt: new Date(),
      };

      await expect(pubsub.resultCallback!(event, ack)).resolves.toBeUndefined();

      expect(warn).toHaveBeenCalledWith(`background-task completion callback failed for ${task.id}:`, error);
      expect(manager.taskContexts.has(task.id)).toBe(false);
      expect(drainPending).toHaveBeenCalledOnce();
      expect(ack).toHaveBeenCalledOnce();
    } finally {
      await manager.shutdown();
      await pubsub.close();
      await mastra.shutdown();
      mastra.__unregisterHooks();
    }
  });

  it('acknowledges failed results and cleans up when the global failure callback rejects', async () => {
    const pubsub = new CapturingPubSub();
    const mockStore = new MockStore();
    const mastra = new Mastra({ logger: false, storage: mockStore, workers: false });
    const error = new Error('failure callback failed');
    const manager = new BackgroundTaskManager({
      enabled: true,
      recoverStaleTasksOnStart: false,
      onTaskFailed: async () => {
        throw error;
      },
    });
    manager.__registerMastra(mastra);
    const warn = vi.spyOn(mastra.getLogger(), 'warn');
    const drainPending = vi.spyOn(manager as any, 'drainPending').mockResolvedValue(undefined);
    const storage = await mockStore.getStore('backgroundTasks');
    if (!storage) throw new Error('Background task storage is unavailable');
    const task = makeRunningTask({
      status: 'failed',
      completedAt: new Date(),
      error: { message: 'task failed' },
    });
    await storage.createTask(task);
    manager.registerTaskContext(task.id, { executor: { execute: vi.fn() } });

    try {
      await manager.init(pubsub);
      const ack = vi.fn(async () => {});
      const event: Event = {
        type: 'task.failed',
        id: 'event-1',
        data: { ...task, taskId: task.id },
        runId: task.runId,
        createdAt: new Date(),
      };

      await expect(pubsub.resultCallback!(event, ack)).resolves.toBeUndefined();

      expect(warn).toHaveBeenCalledWith(`background-task failure callback failed for ${task.id}:`, error);
      expect(manager.taskContexts.has(task.id)).toBe(false);
      expect(drainPending).toHaveBeenCalledOnce();
      expect(ack).toHaveBeenCalledOnce();
    } finally {
      await manager.shutdown();
      await pubsub.close();
      await mastra.shutdown();
      mastra.__unregisterHooks();
    }
  });

  it('acknowledges and cleans up before propagating a per-task completion callback rejection', async () => {
    const pubsub = new CapturingPubSub();
    const mockStore = new MockStore();
    const mastra = new Mastra({ logger: false, storage: mockStore, workers: false });
    const manager = new BackgroundTaskManager({ enabled: true, recoverStaleTasksOnStart: false });
    manager.__registerMastra(mastra);
    const drainPending = vi.spyOn(manager as any, 'drainPending').mockResolvedValue(undefined);
    const storage = await mockStore.getStore('backgroundTasks');
    if (!storage) throw new Error('Background task storage is unavailable');
    const task = makeRunningTask({ status: 'completed', completedAt: new Date(), result: { ok: true } });
    const error = new Error('per-task callback failed');
    await storage.createTask(task);
    manager.registerTaskContext(task.id, {
      executor: { execute: vi.fn() },
      onComplete: async () => {
        throw error;
      },
    });

    try {
      await manager.init(pubsub);
      const ack = vi.fn(async () => {});
      const event: Event = {
        type: 'task.completed',
        id: 'event-1',
        data: { ...task, taskId: task.id },
        runId: task.runId,
        createdAt: new Date(),
      };

      await expect(pubsub.resultCallback!(event, ack)).rejects.toThrow(error);

      expect(manager.taskContexts.has(task.id)).toBe(false);
      expect(drainPending).toHaveBeenCalledOnce();
      expect(ack).toHaveBeenCalledOnce();
    } finally {
      await manager.shutdown();
      await pubsub.close();
      await mastra.shutdown();
      mastra.__unregisterHooks();
    }
  });

  it('fails and acknowledges a claimed dispatch when Mastra is not registered', async () => {
    const pubsub = new CapturingPubSub();
    const manager = new BackgroundTaskManager({ enabled: true, recoverStaleTasksOnStart: false });
    const mockStore = new MockStore();
    const storage = await mockStore.getStore('backgroundTasks');
    if (!storage) throw new Error('Background task storage is unavailable');
    vi.spyOn(manager, 'getStorage').mockResolvedValue(storage);
    await manager.init(pubsub);

    const task = makeRunningTask({ status: 'pending', startedAt: undefined });
    await storage.createTask(task);
    const ack = vi.fn(async () => {});
    const event: Event = {
      type: 'task.dispatch',
      id: 'event-1',
      data: { taskId: task.id },
      runId: task.id,
      createdAt: new Date(),
    };

    await pubsub.dispatchCallback!(event, ack);

    expect(await storage.getTask(task.id)).toMatchObject({
      status: 'failed',
      error: { message: 'Mastra is not registered with this background task manager' },
    });
    expect(ack).toHaveBeenCalledOnce();
    await manager.shutdown();
    await pubsub.close();
  });

  it('does not overwrite cancellation when workflow startup fails', async () => {
    const pubsub = new CapturingPubSub();
    const manager = new BackgroundTaskManager({ enabled: true, recoverStaleTasksOnStart: false });
    await manager.init(pubsub);

    const task = makeRunningTask({ status: 'pending', startedAt: undefined });
    let currentTask = task;
    const updateTask = vi.fn(
      async (
        _taskId: string,
        update: Partial<BackgroundTask>,
        options?: { expectedStatus?: BackgroundTask['status'] },
      ) => {
        if (options?.expectedStatus === 'pending') {
          currentTask = { ...currentTask, ...update };
          return true;
        }
        currentTask = { ...currentTask, status: 'cancelled' };
        return false;
      },
    );
    const publish = vi.spyOn(pubsub, 'publish');
    manager.__registerMastra({
      getStorage: () => ({
        getStore: async () => ({
          getTask: async () => currentTask,
          updateTask,
          listTasks: async () => ({ tasks: [] }),
        }),
      }),
      __getInternalWorkflow: () => ({
        createRun: async () => {
          throw new Error('workflow startup failed');
        },
      }),
    } as unknown as Mastra);
    const ack = vi.fn(async () => {});
    const event: Event = {
      type: 'task.dispatch',
      id: 'event-1',
      data: { taskId: task.id },
      runId: task.id,
      createdAt: new Date(),
    };

    await pubsub.dispatchCallback!(event, ack);

    expect(updateTask).toHaveBeenLastCalledWith(task.id, expect.objectContaining({ status: 'failed' }), {
      expectedStatus: 'running',
      expectedOwnerId: (manager as any).ownerId,
    });
    expect(publish).not.toHaveBeenCalledWith(expect.objectContaining({ type: 'task.failed' }));
    expect(ack).toHaveBeenCalledOnce();
    await manager.shutdown();
    await pubsub.close();
  });

  it('releases a reserved slot when a resumed task is no longer suspended', async () => {
    const manager = new BackgroundTaskManager({ enabled: true });
    vi.spyOn(manager, 'getStorage').mockResolvedValue({
      getTask: async () => makeRunningTask({ status: 'completed' }),
    } as any);
    (manager as any).localReservations.set('task-1', 'agent-1');
    const event: Event = {
      type: 'task.resume',
      id: 'event-1',
      data: { taskId: 'task-1', resumeData: {} },
      runId: 'task-1',
      createdAt: new Date(),
    };

    await expect((manager as any).handleResume(event)).resolves.toBe(true);

    expect((manager as any).localReservations.has('task-1')).toBe(false);
    await manager.shutdown();
  });

  it('logs dispatch failures while draining instead of rejecting', async () => {
    const mastra = new Mastra({ logger: false, storage: new MockStore(), workers: false });
    const warn = vi.spyOn(mastra.getLogger(), 'warn');
    const manager = new BackgroundTaskManager({ enabled: true });
    manager.__registerMastra(mastra);
    vi.spyOn(manager, 'getStorage').mockResolvedValue({
      getTask: async () => makeRunningTask({ status: 'pending', startedAt: undefined }),
    } as any);
    const error = new Error('dispatch failed');
    vi.spyOn(manager as any, 'dispatch').mockRejectedValue(error);
    manager.registerTaskContext('task-1', { executor: { execute: vi.fn() } });
    (manager as any).localPendingTaskIds.add('task-1');

    await expect((manager as any).drainPending()).resolves.toBeUndefined();

    expect(warn).toHaveBeenCalledWith('background-task dispatch failed while draining task-1:', error);
    expect((manager as any).localPendingTaskIds.has('task-1')).toBe(true);
    expect((manager as any).localReservations.has('task-1')).toBe(false);
    await manager.shutdown();
    await mastra.shutdown();
    mastra.__unregisterHooks();
  });

  it('logs storage failures while draining instead of rejecting', async () => {
    const mastra = new Mastra({ logger: false, storage: new MockStore(), workers: false });
    const warn = vi.spyOn(mastra.getLogger(), 'warn');
    const manager = new BackgroundTaskManager({ enabled: true });
    manager.__registerMastra(mastra);
    const error = new Error('storage failed');
    vi.spyOn(manager, 'getStorage').mockResolvedValue({
      getTask: async () => {
        throw error;
      },
    } as any);
    (manager as any).localPendingTaskIds.add('task-1');

    try {
      await expect((manager as any).drainPending()).resolves.toBeUndefined();

      expect(warn).toHaveBeenCalledWith('background-task queue drain failed:', error);
      expect((manager as any).localPendingTaskIds.has('task-1')).toBe(true);
      expect((manager as any).drainingPending).toBe(false);
    } finally {
      await manager.shutdown();
      await mastra.shutdown();
      mastra.__unregisterHooks();
    }
  });

  it('still restarts an explicitly restarted running task', async () => {
    const pubsub = new CapturingPubSub();
    const manager = new BackgroundTaskManager({ enabled: true });
    await manager.init(pubsub);

    const task = makeRunningTask();
    const updateTask = vi.fn(async () => true);
    const start = vi.fn(async () => ({ status: 'success' }));
    const restart = vi.fn(async () => ({ status: 'success' }));
    const deleteWorkflowRunById = vi.fn(async () => {});
    manager.__registerMastra({
      getStorage: () => ({
        getStore: async () => ({
          getTask: async () => task,
          updateTask,
          listTasks: async () => ({ tasks: [] }),
        }),
      }),
      __getInternalWorkflow: () => ({
        getWorkflowRunById: async () => ({ status: 'running' }),
        createRun: async () => ({ start, restart }),
        deleteWorkflowRunById,
      }),
    } as unknown as Mastra);
    const ack = vi.fn(async () => {});
    const event: Event = {
      type: 'task.dispatch',
      id: 'event-1',
      data: { taskId: task.id, isRestart: true },
      runId: task.id,
      createdAt: new Date(),
    };

    await pubsub.dispatchCallback!(event, ack);

    expect(updateTask).toHaveBeenCalledWith(task.id, expect.objectContaining({ status: 'running' }), {
      expectedStatus: 'running',
    });
    expect(restart).toHaveBeenCalledOnce();
    expect(start).not.toHaveBeenCalled();
    expect(ack).toHaveBeenCalledOnce();
    await vi.waitFor(() => expect(deleteWorkflowRunById).toHaveBeenCalledWith(task.id));
    await manager.shutdown();
    await pubsub.close();
  });

  it('does not consume a retry when a redelivered dispatch was declined before starting', async () => {
    const pubsub = new CapturingPubSub();
    const manager = new BackgroundTaskManager({ enabled: true });
    await manager.init(pubsub);

    // A previous worker declined the dispatch during shutdown before marking
    // the task running, so the redelivered event (deliveryAttempt: 2) finds
    // the task still pending. The retry budget must stay intact.
    const pendingTask = makeRunningTask({ status: 'pending', startedAt: undefined });
    const updateTask = vi.fn(async () => true);
    const workflowRun = { start: vi.fn(async () => ({ status: 'success' })) };
    manager.__registerMastra({
      getStorage: () => ({
        getStore: async () => ({
          getTask: async () => pendingTask,
          updateTask,
          listTasks: async () => ({ tasks: [] }),
        }),
      }),
      __getInternalWorkflow: () => ({
        createRun: async () => workflowRun,
        deleteWorkflowRunById: async () => {},
      }),
    } as unknown as Mastra);
    const ack = vi.fn(async () => {});
    const event: Event = {
      type: 'task.dispatch',
      id: 'event-1',
      data: { taskId: 'task-1' },
      runId: 'task-1',
      createdAt: new Date(),
      deliveryAttempt: 2,
    };

    await pubsub.dispatchCallback!(event, ack);

    expect(updateTask).toHaveBeenCalledWith('task-1', expect.objectContaining({ status: 'running', retryCount: 0 }), {
      expectedStatus: 'pending',
      expectedOwnerId: null,
      expectedLeaseExpiresAt: null,
    });
    expect(ack).toHaveBeenCalled();
    await manager.shutdown();
    await pubsub.close();
  });

  it('still counts a crashed attempt when a redelivered dispatch finds the task running', async () => {
    const pubsub = new CapturingPubSub();
    const manager = new BackgroundTaskManager({ enabled: true });
    await manager.init(pubsub);

    const crashedTask = makeRunningTask();
    const updateTask = vi.fn(async () => true);
    const workflowRun = { start: vi.fn(async () => ({ status: 'success' })) };
    manager.__registerMastra({
      getStorage: () => ({
        getStore: async () => ({
          getTask: async () => crashedTask,
          updateTask,
          listTasks: async () => ({ tasks: [] }),
        }),
      }),
      __getInternalWorkflow: () => ({
        createRun: async () => workflowRun,
        deleteWorkflowRunById: async () => {},
      }),
    } as unknown as Mastra);
    const ack = vi.fn(async () => {});
    const event: Event = {
      type: 'task.dispatch',
      id: 'event-1',
      data: { taskId: 'task-1' },
      runId: 'task-1',
      createdAt: new Date(),
      deliveryAttempt: 2,
    };

    await pubsub.dispatchCallback!(event, ack);

    expect(updateTask).toHaveBeenCalledWith('task-1', expect.objectContaining({ status: 'running', retryCount: 1 }), {
      expectedStatus: 'running',
      expectedOwnerId: null,
      expectedLeaseExpiresAt: null,
    });
    expect(ack).toHaveBeenCalled();
    await manager.shutdown();
    await pubsub.close();
  });

  it("leaves a redelivered dispatch unacked while another worker's lease is still live", async () => {
    const pubsub = new CapturingPubSub();
    const manager = new BackgroundTaskManager({ enabled: true });
    await manager.init(pubsub);

    const leasedTask = makeRunningTask({
      ownerId: 'other-worker',
      leaseExpiresAt: new Date(Date.now() + 60_000),
    });
    const updateTask = vi.fn(async () => true);
    manager.__registerMastra({
      getStorage: () => ({
        getStore: async () => ({
          getTask: async () => leasedTask,
          updateTask,
          listTasks: async () => ({ tasks: [] }),
        }),
      }),
      __getInternalWorkflow: () => ({
        createRun: async () => ({ start: vi.fn(async () => ({ status: 'success' })) }),
        deleteWorkflowRunById: async () => {},
      }),
    } as unknown as Mastra);
    const ack = vi.fn(async () => {});
    const event: Event = {
      type: 'task.dispatch',
      id: 'event-1',
      data: { taskId: 'task-1' },
      runId: 'task-1',
      createdAt: new Date(),
      deliveryAttempt: 2,
    };

    await pubsub.dispatchCallback!(event, ack);

    // The lease is live and held by someone else, so this delivery neither
    // claims the task nor acknowledges the message: it stays queued for a
    // redelivery once the lease lapses.
    expect(updateTask).not.toHaveBeenCalled();
    expect(ack).not.toHaveBeenCalled();
    await manager.shutdown();
    await pubsub.close();
  });

  it('acks a redelivered dispatch for a live lease it already owns without reclaiming', async () => {
    const pubsub = new CapturingPubSub();
    const manager = new BackgroundTaskManager({ enabled: true });
    await manager.init(pubsub);

    const leasedTask = makeRunningTask({
      ownerId: manager.ownerId,
      leaseExpiresAt: new Date(Date.now() + 60_000),
    });
    const updateTask = vi.fn(async () => true);
    manager.__registerMastra({
      getStorage: () => ({
        getStore: async () => ({
          getTask: async () => leasedTask,
          updateTask,
          listTasks: async () => ({ tasks: [] }),
        }),
      }),
      __getInternalWorkflow: () => ({
        createRun: async () => ({ start: vi.fn(async () => ({ status: 'success' })) }),
        deleteWorkflowRunById: async () => {},
      }),
    } as unknown as Mastra);
    const ack = vi.fn(async () => {});
    const event: Event = {
      type: 'task.dispatch',
      id: 'event-1',
      data: { taskId: 'task-1' },
      runId: 'task-1',
      createdAt: new Date(),
      deliveryAttempt: 2,
    };

    await pubsub.dispatchCallback!(event, ack);

    // This worker already owns the live lease, so the duplicate delivery is
    // acknowledged without another claim.
    expect(updateTask).not.toHaveBeenCalled();
    expect(ack).toHaveBeenCalled();
    await manager.shutdown();
    await pubsub.close();
  });

  it('rejects a lease duration too short to renew before it lapses', () => {
    const message = /leaseDurationMs must be a finite number of at least 3000ms/;
    expect(() => new BackgroundTaskManager({ enabled: true, leaseDurationMs: 1_000 })).toThrow(message);
    expect(() => new BackgroundTaskManager({ enabled: true, leaseDurationMs: Number.NaN })).toThrow(message);
    expect(() => new BackgroundTaskManager({ enabled: true, leaseDurationMs: 3_000 })).not.toThrow();
  });

  it('rejects AbortController registration after shutdown starts', async () => {
    const manager = new BackgroundTaskManager({ enabled: true });
    const controller = new AbortController();
    const shutdownPromise = manager.shutdown();

    expect((manager as any).registerActiveAbortController('task-1', controller)).toBe(false);
    expect(controller.signal.aborted).toBe(true);
    expect(manager.activeAbortControllers.has('task-1')).toBe(false);
    await shutdownPromise;
  });
});

class FailOnceOnCompleteBackgroundTasks extends BackgroundTasksInMemory {
  completedWriteFailures = 0;

  override async updateTask(
    taskId: string,
    update: UpdateBackgroundTask,
    options?: UpdateBackgroundTaskOptions,
  ): Promise<boolean> {
    if (update.status === 'completed' && this.completedWriteFailures === 0) {
      this.completedWriteFailures++;
      throw new Error('storage unavailable while completing task');
    }
    return super.updateTask(taskId, update, options);
  }
}

class FailOnceOnCompleteStore extends InMemoryStore {
  readonly backgroundTasks = new FailOnceOnCompleteBackgroundTasks({ db: new InMemoryDB() });

  constructor() {
    super();
    this.stores.backgroundTasks = this.backgroundTasks;
  }
}

describe('BackgroundTaskManager workflow run settlement', () => {
  async function setup(storage: InMemoryStore) {
    const mastra = new Mastra({ logger: false, storage });
    await mastra.startWorkers();
    const pubsub = new EventEmitterPubSub();
    const onTaskFailed = vi.fn();
    const onTaskComplete = vi.fn();
    const manager = new BackgroundTaskManager({ enabled: true, onTaskFailed, onTaskComplete });
    manager.__registerMastra(mastra);
    await manager.init(pubsub);
    const publish = vi.spyOn(pubsub, 'publish');
    return {
      manager,
      onTaskFailed,
      onTaskComplete,
      completedEvents: () => publish.mock.calls.filter(([, event]) => event.type === 'task.completed'),
      failedEvents: () => publish.mock.calls.filter(([, event]) => event.type === 'task.failed'),
      cleanup: async () => {
        await manager.shutdown();
        await pubsub.close();
        await mastra.stopWorkers();
      },
    };
  }

  it('marks the task failed when the workflow run fails before a terminal status is persisted', async () => {
    const storage = new FailOnceOnCompleteStore();
    const { manager, onTaskFailed, failedEvents, cleanup } = await setup(storage);
    const onFailed = vi.fn();

    try {
      const { task } = await manager.enqueue(
        { toolName: 'my-tool', toolCallId: 'call-1', args: {}, agentId: 'agent-1', runId: 'run-1' },
        { executor: { execute: async () => 'done' }, onFailed },
      );

      await vi.waitFor(async () => expect((await manager.getTask(task.id))?.status).toBe('failed'));
      await vi.waitFor(() => expect(onTaskFailed).toHaveBeenCalledTimes(1));

      expect(storage.backgroundTasks.completedWriteFailures).toBe(1);
      const failed = await manager.getTask(task.id);
      expect(failed?.error?.message).toBe('storage unavailable while completing task');
      expect(failed?.completedAt).toBeInstanceOf(Date);
      expect(onFailed).toHaveBeenCalledTimes(1);
      expect(failedEvents()).toHaveLength(1);
    } finally {
      await cleanup();
    }
  });

  it('still publishes task.failed when a per-task failure hook throws during settlement', async () => {
    const storage = new FailOnceOnCompleteStore();
    const { manager, onTaskFailed, failedEvents, cleanup } = await setup(storage);
    const onFailed = vi.fn(async () => {
      throw new Error('onFailed hook exploded');
    });

    try {
      const { task } = await manager.enqueue(
        { toolName: 'my-tool', toolCallId: 'call-1', args: {}, agentId: 'agent-1', runId: 'run-1' },
        { executor: { execute: async () => 'done' }, onFailed },
      );

      await vi.waitFor(async () => expect((await manager.getTask(task.id))?.status).toBe('failed'));
      await vi.waitFor(() => expect(onTaskFailed).toHaveBeenCalledTimes(1));

      expect(onFailed).toHaveBeenCalledTimes(1);
      expect(failedEvents()).toHaveLength(1);
    } finally {
      await cleanup();
    }
  });

  it('fires failure hooks and events once when the task itself fails', async () => {
    const { manager, onTaskFailed, failedEvents, cleanup } = await setup(new InMemoryStore());
    const onFailed = vi.fn();

    try {
      const { task } = await manager.enqueue(
        { toolName: 'my-tool', toolCallId: 'call-1', args: {}, agentId: 'agent-1', runId: 'run-1', maxRetries: 0 },
        {
          executor: {
            execute: async () => {
              throw new Error('tool exploded');
            },
          },
          onFailed,
        },
      );

      await vi.waitFor(async () => expect((await manager.getTask(task.id))?.status).toBe('failed'));
      await vi.waitFor(() => expect(onTaskFailed).toHaveBeenCalledTimes(1));
      // Let the workflow run settle so a duplicate settle-path publish would land.
      await new Promise(resolve => setTimeout(resolve, 100));

      expect((await manager.getTask(task.id))?.error?.message).toBe('tool exploded');
      expect(onTaskFailed).toHaveBeenCalledTimes(1);
      expect(onFailed).toHaveBeenCalledTimes(1);
      expect(failedEvents()).toHaveLength(1);
    } finally {
      await cleanup();
    }
  });
  it('still publishes task.failed when onFailed throws after an ordinary step failure', async () => {
    const { manager, onTaskFailed, failedEvents, cleanup } = await setup(new InMemoryStore());
    const onFailed = vi.fn(async () => {
      throw new Error('onFailed hook exploded');
    });

    try {
      const { task } = await manager.enqueue(
        { toolName: 'my-tool', toolCallId: 'call-1', args: {}, agentId: 'agent-1', runId: 'run-1', maxRetries: 0 },
        {
          executor: {
            execute: async () => {
              throw new Error('tool exploded');
            },
          },
          onFailed,
        },
      );

      await vi.waitFor(async () => expect((await manager.getTask(task.id))?.status).toBe('failed'));
      await vi.waitFor(() => expect(onTaskFailed).toHaveBeenCalledTimes(1));
      // Let the workflow run settle so a duplicate settle-path publish would land.
      await new Promise(resolve => setTimeout(resolve, 100));

      expect((await manager.getTask(task.id))?.error?.message).toBe('tool exploded');
      expect(onFailed).toHaveBeenCalledTimes(1);
      expect(onTaskFailed).toHaveBeenCalledTimes(1);
      expect(failedEvents()).toHaveLength(1);
    } finally {
      await cleanup();
    }
  });

  it('still publishes task.completed when onComplete throws after a successful run', async () => {
    const { manager, onTaskComplete, onTaskFailed, completedEvents, failedEvents, cleanup } = await setup(
      new InMemoryStore(),
    );
    const onComplete = vi.fn(async () => {
      throw new Error('onComplete hook exploded');
    });

    try {
      const { task } = await manager.enqueue(
        { toolName: 'my-tool', toolCallId: 'call-1', args: {}, agentId: 'agent-1', runId: 'run-1' },
        { executor: { execute: async () => 'done' }, onComplete },
      );

      await vi.waitFor(async () => expect((await manager.getTask(task.id))?.status).toBe('completed'));
      await vi.waitFor(() => expect(onTaskComplete).toHaveBeenCalledTimes(1));
      await new Promise(resolve => setTimeout(resolve, 100));

      expect((await manager.getTask(task.id))?.status).toBe('completed');
      expect(onComplete).toHaveBeenCalledTimes(1);
      expect(completedEvents()).toHaveLength(1);
      expect(onTaskFailed).not.toHaveBeenCalled();
      expect(failedEvents()).toHaveLength(0);
    } finally {
      await cleanup();
    }
  });
});
