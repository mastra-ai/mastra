import EventEmitter from 'node:events';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { EventEmitterPubSub } from '../events/event-emitter';
import type { Event, EventCallback, SubscribeOptions } from '../events/types';
import { Mastra } from '../mastra';
import { MockStore } from '../storage';
import { BackgroundTaskManager } from './manager';
import type { BackgroundTask } from './types';
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

class CapturingPubSub extends EventEmitterPubSub {
  dispatchCallback?: EventCallback;

  override async subscribe(topic: string, cb: EventCallback, options?: SubscribeOptions): Promise<void> {
    if (topic === 'background-tasks') this.dispatchCallback = cb;
    await super.subscribe(topic, cb, options);
  }
}

class SilentPublishPubSub extends EventEmitterPubSub {
  override async publish(): Promise<void> {}
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
    });
    expect(ack).toHaveBeenCalled();
    await manager.shutdown();
    await pubsub.close();
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
