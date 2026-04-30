import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { EventEmitterPubSub } from '../events/event-emitter';
import { Mastra } from '../mastra';
import { MockStore } from '../storage';
import { createBackgroundTask } from './create';
import { BackgroundTaskManager } from './manager';
import type { TaskContext } from './types';

/** Create a per-task context with the given execute function */
function ctx(executeFn: (args: any, opts?: any) => Promise<any>): TaskContext {
  return { executor: { execute: executeFn } };
}

const testStorage = new MockStore();

const mastra = new Mastra({
  logger: false,
  storage: testStorage,
});

/** Wait for async microtasks/timers to settle */
const tick = (ms = 50) => new Promise(resolve => setTimeout(resolve, ms));

describe('BackgroundTaskManager', () => {
  let pubsub: EventEmitterPubSub;
  let manager: BackgroundTaskManager;

  beforeEach(async () => {
    pubsub = new EventEmitterPubSub();
    manager = new BackgroundTaskManager({
      globalConcurrency: 3,
      perAgentConcurrency: 2,
      defaultTimeoutMs: 5000,
      enabled: true,
    });
    manager.__registerMastra(mastra);
    await manager.init(pubsub);
  });

  afterEach(async () => {
    await manager.shutdown();
    await pubsub.close();
    const backgroundTasksStore = await testStorage.getStore('backgroundTasks');
    await backgroundTasksStore?.dangerouslyClearAll();
  });

  describe('enqueue and execute', () => {
    it('enqueues a task, executes it, and completes', async () => {
      const executeFn = vi.fn().mockResolvedValue({ data: 'hello' });

      const { task } = await manager.enqueue(
        { toolName: 'my-tool', toolCallId: 'call-1', args: { query: 'test' }, agentId: 'agent-1', runId: 'run-1' },
        ctx(executeFn),
      );

      await tick();

      const completed = await manager.getTask(task.id);
      expect(completed?.status).toBe('completed');
      expect(completed?.result).toEqual({ data: 'hello' });
      expect(executeFn).toHaveBeenCalledWith(
        { query: 'test' },
        expect.objectContaining({ abortSignal: expect.any(AbortSignal) }),
      );
    });

    it('passes args correctly to the tool', async () => {
      const executeFn = vi.fn().mockResolvedValue('ok');

      await manager.enqueue(
        {
          toolName: 'my-tool',
          toolCallId: 'call-1',
          args: { foo: 'bar', num: 42 },
          agentId: 'agent-1',
          runId: 'run-1',
        },
        ctx(executeFn),
      );

      await tick();
      expect(executeFn).toHaveBeenCalledWith({ foo: 'bar', num: 42 }, expect.anything());
    });

    it('sets failed status when tool throws', async () => {
      const executeFn = vi.fn().mockRejectedValue(new Error('Tool broke'));

      const { task } = await manager.enqueue(
        { toolName: 'failing-tool', toolCallId: 'call-1', args: {}, agentId: 'agent-1', runId: 'run-1' },
        ctx(executeFn),
      );

      await tick();

      const failed = await manager.getTask(task.id);
      expect(failed?.status).toBe('failed');
      expect(failed?.error?.message).toBe('Tool broke');
    });

    it('fails with message when no executor is registered', async () => {
      const { task } = await manager.enqueue({
        toolName: 'my-tool',
        toolCallId: 'call-1',
        args: {},
        agentId: 'agent-1',
        runId: 'run-1',
      });

      await tick();

      const result = await manager.getTask(task.id);
      expect(result?.status).toBe('failed');
      expect(result?.error?.message).toContain('No executor');
    });
  });

  describe('createBackgroundTask handle', () => {
    it('returns a handle that can dispatch and wait', async () => {
      const executeFn = vi.fn().mockResolvedValue('from-handle');

      const bgTask = createBackgroundTask(manager, {
        toolName: 'tool',
        toolCallId: 'call-1',
        args: {},
        agentId: 'a1',
        runId: 'run-1',
        context: ctx(executeFn),
      });

      const { task } = await bgTask.dispatch();
      expect(task.status).toBe('pending');

      const completed = await bgTask.waitForCompletion({ timeoutMs: 2000 });
      expect(completed.status).toBe('completed');
      expect(completed.result).toBe('from-handle');
    });

    it('can cancel via handle', async () => {
      const executeFn = vi.fn().mockImplementation(
        (_args: any, opts: { abortSignal: AbortSignal }) =>
          new Promise((_resolve, reject) => {
            opts.abortSignal.addEventListener('abort', () => reject(new Error('Task cancelled')));
          }),
      );

      const bgTask = createBackgroundTask(manager, {
        toolName: 'tool',
        toolCallId: 'call-1',
        args: {},
        agentId: 'a1',
        runId: 'run-1',
        context: ctx(executeFn),
      });

      await bgTask.dispatch();
      await tick();

      await bgTask.cancel();
      await tick();

      expect((await manager.getTask(bgTask.task.id))?.status).toBe('cancelled');
    });

    it('throws if cancel/wait called before dispatch', async () => {
      const bgTask = createBackgroundTask(manager, {
        toolName: 'tool',
        toolCallId: 'call-1',
        args: {},
        agentId: 'a1',
        runId: 'run-1',
        context: ctx(vi.fn().mockResolvedValue('ok')),
      });

      await expect(bgTask.cancel()).rejects.toThrow('not been dispatched');
      await expect(bgTask.waitForCompletion()).rejects.toThrow('not been dispatched');
    });
  });

  describe('concurrency', () => {
    it('enforces global concurrency limit', async () => {
      const resolvers: Array<() => void> = [];
      const executeFn = vi.fn().mockImplementation(
        () =>
          new Promise<string>(resolve => {
            resolvers.push(() => resolve('done'));
          }),
      );

      // Enqueue 4 tasks across 2 agents (global limit=3, per-agent=2)
      await manager.enqueue(
        { toolName: 'slow-tool', toolCallId: 'c1', args: {}, agentId: 'a1', runId: 'run-1' },
        ctx(executeFn),
      );
      await manager.enqueue(
        { toolName: 'slow-tool', toolCallId: 'c2', args: {}, agentId: 'a1', runId: 'run-1' },
        ctx(executeFn),
      );
      await manager.enqueue(
        { toolName: 'slow-tool', toolCallId: 'c3', args: {}, agentId: 'a2', runId: 'run-1' },
        ctx(executeFn),
      );
      await manager.enqueue(
        { toolName: 'slow-tool', toolCallId: 'c4', args: {}, agentId: 'a2', runId: 'run-1' },
        ctx(executeFn),
      );

      await tick();

      const { tasks: running } = await manager.listTasks({ status: 'running' });
      const { tasks: pending } = await manager.listTasks({ status: 'pending' });
      expect(running.length).toBe(3);
      expect(pending.length).toBe(1);

      // Complete one task — the pending one should be dispatched
      resolvers[0]!();
      await tick();

      const { tasks: runningAfter } = await manager.listTasks({ status: 'running' });
      const { tasks: pendingAfter } = await manager.listTasks({ status: 'pending' });
      const { tasks: completedAfter } = await manager.listTasks({ status: 'completed' });
      expect(completedAfter.length).toBe(1);
      expect(runningAfter.length).toBe(3);
      expect(pendingAfter.length).toBe(0);

      resolvers.forEach(r => r());
    });

    it('enforces per-agent concurrency limit', async () => {
      const resolvers: Array<() => void> = [];
      const executeFn = vi.fn().mockImplementation(
        () =>
          new Promise<string>(resolve => {
            resolvers.push(() => resolve('done'));
          }),
      );

      await manager.enqueue(
        { toolName: 'slow-tool', toolCallId: 'c1', args: {}, agentId: 'agent-x', runId: 'run-1' },
        ctx(executeFn),
      );
      await manager.enqueue(
        { toolName: 'slow-tool', toolCallId: 'c2', args: {}, agentId: 'agent-x', runId: 'run-1' },
        ctx(executeFn),
      );
      await manager.enqueue(
        { toolName: 'slow-tool', toolCallId: 'c3', args: {}, agentId: 'agent-x', runId: 'run-1' },
        ctx(executeFn),
      );

      await tick();

      const { tasks: running } = await manager.listTasks({ status: 'running', agentId: 'agent-x' });
      const { tasks: pending } = await manager.listTasks({ status: 'pending', agentId: 'agent-x' });
      expect(running.length).toBe(2);
      expect(pending.length).toBe(1);

      resolvers.forEach(r => r());
    });

    it('backpressure reject throws on limit', async () => {
      const isolatedPubsub = new EventEmitterPubSub();
      const rejectManager = new BackgroundTaskManager({
        enabled: true,
        globalConcurrency: 1,
        perAgentConcurrency: 1,
        backpressure: 'reject',
      });
      rejectManager.__registerMastra(mastra);
      await rejectManager.init(isolatedPubsub);

      let resolver!: () => void;
      const executeFn = vi.fn().mockImplementation(
        () =>
          new Promise<string>(resolve => {
            resolver = () => resolve('done');
          }),
      );

      await rejectManager.enqueue(
        { toolName: 'tool', toolCallId: 'c1', args: {}, agentId: 'a', runId: 'run-1' },
        ctx(executeFn),
      );
      await tick();

      await expect(
        rejectManager.enqueue(
          { toolName: 'tool', toolCallId: 'c2', args: {}, agentId: 'a', runId: 'run-1' },
          ctx(executeFn),
        ),
      ).rejects.toThrow('Concurrency limit reached');

      resolver();
      await rejectManager.shutdown();
      await isolatedPubsub.close();
    });

    it('backpressure fallback-sync returns signal', async () => {
      const isolatedPubsub = new EventEmitterPubSub();
      const syncManager = new BackgroundTaskManager({
        enabled: true,
        globalConcurrency: 1,
        perAgentConcurrency: 1,
        backpressure: 'fallback-sync',
      });
      syncManager.__registerMastra(mastra);
      await syncManager.init(isolatedPubsub);

      let resolver!: () => void;
      const executeFn = vi.fn().mockImplementation(
        () =>
          new Promise<string>(resolve => {
            resolver = () => resolve('done');
          }),
      );

      await syncManager.enqueue(
        { toolName: 'tool', toolCallId: 'c1', args: {}, agentId: 'a', runId: 'run-1' },
        ctx(executeFn),
      );
      await tick();

      const result = await syncManager.enqueue(
        { toolName: 'tool', toolCallId: 'c2', args: {}, agentId: 'a', runId: 'run-1' },
        ctx(executeFn),
      );
      expect(result.fallbackToSync).toBe(true);

      resolver();
      await syncManager.shutdown();
      await isolatedPubsub.close();
    });
  });

  describe('timeout', () => {
    it('aborts tool execution on timeout', async () => {
      const executeFn = vi.fn().mockImplementation(
        (_args: any, opts: { abortSignal: AbortSignal }) =>
          new Promise((_resolve, reject) => {
            opts.abortSignal.addEventListener('abort', () => {
              reject(Object.assign(new Error('Aborted'), { name: 'AbortError' }));
            });
          }),
      );

      const { task } = await manager.enqueue(
        { toolName: 'slow-tool', toolCallId: 'call-1', args: {}, agentId: 'agent-1', timeoutMs: 100, runId: 'run-1' },
        ctx(executeFn),
      );

      await new Promise(resolve => setTimeout(resolve, 300));

      const result = await manager.getTask(task.id);
      expect(result?.status).toBe('timed_out');
      expect(result?.error?.message).toContain('timed out');
    });
  });

  describe('retry', () => {
    it('retries a failed task up to maxRetries', async () => {
      let callCount = 0;
      const executeFn = vi.fn().mockImplementation(async () => {
        callCount++;
        if (callCount < 3) throw new Error('Transient error');
        return 'success';
      });

      const isolatedPubsub = new EventEmitterPubSub();
      const retryManager = new BackgroundTaskManager({
        enabled: true,
        defaultRetries: { retryDelayMs: 0 },
      });
      retryManager.__registerMastra(mastra);
      await retryManager.init(isolatedPubsub);

      const { task } = await retryManager.enqueue(
        { toolName: 'flaky-tool', toolCallId: 'call-1', args: {}, agentId: 'agent-1', maxRetries: 3, runId: 'run-1' },
        ctx(executeFn),
      );

      await tick(200);

      const result = await retryManager.getTask(task.id);
      expect(result?.status).toBe('completed');
      expect(result?.result).toBe('success');
      expect(executeFn).toHaveBeenCalledTimes(3);

      await retryManager.shutdown();
      await isolatedPubsub.close();
    });

    it('fails after exhausting retries', async () => {
      const executeFn = vi.fn().mockRejectedValue(new Error('Always fails'));

      const isolatedPubsub = new EventEmitterPubSub();
      const retryManager = new BackgroundTaskManager({
        enabled: true,
        defaultRetries: { retryDelayMs: 0 },
      });
      retryManager.__registerMastra(mastra);
      await retryManager.init(isolatedPubsub);

      const { task } = await retryManager.enqueue(
        { toolName: 'bad-tool', toolCallId: 'call-1', args: {}, agentId: 'agent-1', maxRetries: 2, runId: 'run-1' },
        ctx(executeFn),
      );

      await tick(200);

      const result = await retryManager.getTask(task.id);
      expect(result?.status).toBe('failed');
      expect(executeFn).toHaveBeenCalledTimes(3); // initial + 2 retries

      await retryManager.shutdown();
      await isolatedPubsub.close();
    });
  });

  describe('cancel', () => {
    it('cancels a pending task', async () => {
      const resolvers: Array<() => void> = [];
      const executeFn = vi.fn().mockImplementation(
        () =>
          new Promise<string>(resolve => {
            resolvers.push(() => resolve('done'));
          }),
      );

      // Fill per-agent concurrency (limit=2)
      await manager.enqueue(
        { toolName: 'tool', toolCallId: 'c1', args: {}, agentId: 'a', runId: 'run-1' },
        ctx(executeFn),
      );
      await manager.enqueue(
        { toolName: 'tool', toolCallId: 'c2', args: {}, agentId: 'a', runId: 'run-1' },
        ctx(executeFn),
      );
      // This one should be pending
      const { task } = await manager.enqueue(
        { toolName: 'tool', toolCallId: 'c3', args: {}, agentId: 'a', runId: 'run-1' },
        ctx(executeFn),
      );

      await tick();
      expect((await manager.getTask(task.id))?.status).toBe('pending');

      await manager.cancel(task.id);
      expect((await manager.getTask(task.id))?.status).toBe('cancelled');

      resolvers.forEach(r => r());
    });

    it('cancels a running task by aborting execution', async () => {
      let capturedSignal!: AbortSignal;
      const executeFn = vi.fn().mockImplementation(
        (_args: any, opts: { abortSignal: AbortSignal }) =>
          new Promise((_resolve, reject) => {
            capturedSignal = opts.abortSignal;
            opts.abortSignal.addEventListener('abort', () => reject(new Error('Task cancelled')));
          }),
      );

      const { task } = await manager.enqueue(
        { toolName: 'tool', toolCallId: 'call-1', args: {}, agentId: 'agent-1', runId: 'run-1' },
        ctx(executeFn),
      );

      await tick();
      expect((await manager.getTask(task.id))?.status).toBe('running');

      await manager.cancel(task.id);
      await tick();

      expect((await manager.getTask(task.id))?.status).toBe('cancelled');
      expect(capturedSignal.aborted).toBe(true);
    });

    it('is a no-op for completed tasks', async () => {
      const executeFn = vi.fn().mockResolvedValue('done');

      const { task } = await manager.enqueue(
        { toolName: 'tool', toolCallId: 'call-1', args: {}, agentId: 'agent-1', runId: 'run-1' },
        ctx(executeFn),
      );

      await tick();
      expect((await manager.getTask(task.id))?.status).toBe('completed');

      await manager.cancel(task.id);
      expect((await manager.getTask(task.id))?.status).toBe('completed');
    });
  });

  describe('listTasks', () => {
    it('filters by status', async () => {
      const executeFn = vi.fn().mockResolvedValue('done');

      await manager.enqueue(
        { toolName: 'tool', toolCallId: 'c1', args: {}, agentId: 'a1', runId: 'run-1' },
        ctx(executeFn),
      );
      await tick();

      expect((await manager.listTasks({ status: 'completed' })).tasks.length).toBe(1);
      expect((await manager.listTasks({ status: 'pending' })).tasks.length).toBe(0);
    });

    it('filters by agentId', async () => {
      const executeFn = vi.fn().mockResolvedValue('done');

      await manager.enqueue(
        { toolName: 'tool', toolCallId: 'c1', args: {}, agentId: 'a1', runId: 'run-1' },
        ctx(executeFn),
      );
      await manager.enqueue(
        { toolName: 'tool', toolCallId: 'c2', args: {}, agentId: 'a2', runId: 'run-1' },
        ctx(executeFn),
      );
      await tick();

      const { tasks: a1Tasks } = await manager.listTasks({ agentId: 'a1' });
      expect(a1Tasks.length).toBe(1);
      expect(a1Tasks[0]!.agentId).toBe('a1');
    });

    it('supports page and perPage', async () => {
      const executeFn = vi.fn().mockResolvedValue('done');

      for (let i = 0; i < 5; i++) {
        await manager.enqueue(
          { toolName: 'tool', toolCallId: `c${i}`, args: {}, agentId: 'a1', runId: 'run-1' },
          ctx(executeFn),
        );
      }
      await tick();

      const { tasks: page0, total } = await manager.listTasks({ page: 0, perPage: 2 });
      expect(page0.length).toBe(2);
      expect(total).toBe(5);

      const { tasks: page1 } = await manager.listTasks({ page: 1, perPage: 2 });
      expect(page1.length).toBe(2);

      const { tasks: page2 } = await manager.listTasks({ page: 2, perPage: 2 });
      expect(page2.length).toBe(1);
    });
  });

  describe('callbacks', () => {
    it('invokes onTaskComplete callback', async () => {
      const onComplete = vi.fn();
      const isolatedPubsub = new EventEmitterPubSub();
      const mgr = new BackgroundTaskManager({ enabled: true, onTaskComplete: onComplete });
      mgr.__registerMastra(mastra);
      await mgr.init(isolatedPubsub);

      const executeFn = vi.fn().mockResolvedValue('result');
      await mgr.enqueue(
        { toolName: 'tool', toolCallId: 'c1', args: {}, agentId: 'a1', runId: 'run-1' },
        ctx(executeFn),
      );
      await tick();

      expect(onComplete).toHaveBeenCalledTimes(1);
      expect(onComplete.mock.calls[0]![0].status).toBe('completed');

      await mgr.shutdown();
      await isolatedPubsub.close();
    });

    it('invokes onTaskFailed callback', async () => {
      const onFailed = vi.fn();
      const isolatedPubsub = new EventEmitterPubSub();
      const mgr = new BackgroundTaskManager({ enabled: true, onTaskFailed: onFailed });
      mgr.__registerMastra(mastra);
      await mgr.init(isolatedPubsub);

      const executeFn = vi.fn().mockRejectedValue(new Error('oops'));
      await mgr.enqueue(
        { toolName: 'tool', toolCallId: 'c1', args: {}, agentId: 'a1', runId: 'run-1' },
        ctx(executeFn),
      );
      await tick();

      expect(onFailed).toHaveBeenCalledTimes(1);
      expect(onFailed.mock.calls[0]![0].status).toBe('failed');

      await mgr.shutdown();
      await isolatedPubsub.close();
    });

    it('invokes per-task onComplete callback', async () => {
      const onComplete = vi.fn();
      const executeFn = vi.fn().mockResolvedValue('ok');

      await manager.enqueue(
        { toolName: 'tool', toolCallId: 'c1', args: {}, agentId: 'a1', runId: 'run-1' },
        { executor: { execute: executeFn }, onComplete },
      );
      await tick();

      expect(onComplete).toHaveBeenCalledTimes(1);
      expect(onComplete.mock.calls[0]![0].status).toBe('completed');
    });

    it('invokes per-task onChunk callback', async () => {
      const onChunk = vi.fn();
      const executeFn = vi.fn().mockResolvedValue('chunk-result');

      await manager.enqueue(
        { toolName: 'tool', toolCallId: 'c1', args: {}, agentId: 'a1', runId: 'run-1' },
        { executor: { execute: executeFn }, onChunk },
      );
      await tick();

      expect(onChunk).toHaveBeenCalledTimes(1);
      expect(onChunk.mock.calls[0]![0].type).toBe('background-task-completed');
      expect(onChunk.mock.calls[0]![0].payload.result).toBe('chunk-result');
    });
  });

  describe('cleanup', () => {
    it('deletes old completed tasks', async () => {
      const isolatedPubsub = new EventEmitterPubSub();
      const mgr = new BackgroundTaskManager({
        enabled: true,
        cleanup: { completedTtlMs: 100, failedTtlMs: 200 },
      });
      mgr.__registerMastra(mastra);
      await mgr.init(isolatedPubsub);

      const executeFn = vi.fn().mockResolvedValue('ok');
      await mgr.enqueue(
        { toolName: 'tool', toolCallId: 'c1', args: {}, agentId: 'a1', runId: 'run-1' },
        ctx(executeFn),
      );
      await tick();

      const { tasks: before } = await mgr.listTasks({});
      expect(before.length).toBe(1);

      await new Promise(resolve => setTimeout(resolve, 150));
      await mgr.cleanup();

      const { tasks: after } = await mgr.listTasks({});
      expect(after.length).toBe(0);

      await mgr.shutdown();
      await isolatedPubsub.close();
    });

    it('keeps recent completed tasks', async () => {
      const isolatedPubsub = new EventEmitterPubSub();
      const mgr = new BackgroundTaskManager({
        enabled: true,
        cleanup: { completedTtlMs: 60_000 },
      });
      mgr.__registerMastra(mastra);
      await mgr.init(isolatedPubsub);

      const executeFn = vi.fn().mockResolvedValue('ok');
      await mgr.enqueue(
        { toolName: 'tool', toolCallId: 'c1', args: {}, agentId: 'a1', runId: 'run-1' },
        ctx(executeFn),
      );
      await tick();

      await mgr.cleanup();

      const { tasks: afterTasks } = await mgr.listTasks({});
      expect(afterTasks.length).toBe(1);

      await mgr.shutdown();
      await isolatedPubsub.close();
    });

    it('deletes old failed tasks with separate TTL', async () => {
      const isolatedPubsub = new EventEmitterPubSub();
      const mgr = new BackgroundTaskManager({
        enabled: true,
        cleanup: { completedTtlMs: 50, failedTtlMs: 100 },
      });
      mgr.__registerMastra(mastra);
      await mgr.init(isolatedPubsub);

      const executeFn = vi.fn().mockRejectedValue(new Error('fail'));
      await mgr.enqueue(
        { toolName: 'tool', toolCallId: 'c1', args: {}, agentId: 'a1', runId: 'run-1' },
        ctx(executeFn),
      );
      await tick();

      expect((await mgr.listTasks({})).total).toBe(1);

      await new Promise(resolve => setTimeout(resolve, 150));
      await mgr.cleanup();

      expect((await mgr.listTasks({})).total).toBe(0);

      await mgr.shutdown();
      await isolatedPubsub.close();
    });
  });

  describe('recovery on startup', () => {
    it('fails stale running tasks from a previous process', async () => {
      const isolatedPubsub = new EventEmitterPubSub();

      const mgr1 = new BackgroundTaskManager();
      mgr1.__registerMastra(mastra);
      await mgr1.init(isolatedPubsub);

      const storage = await mgr1.getStorage();
      await storage.createTask({
        id: 'stale-task',
        status: 'running',
        toolName: 'tool',
        toolCallId: 'call-1',
        args: {},
        agentId: 'a1',
        retryCount: 0,
        maxRetries: 0,
        timeoutMs: 300_000,
        createdAt: new Date(),
        startedAt: new Date(),
        runId: 'run-1',
      });

      await mgr1.shutdown();

      const mgr2 = new BackgroundTaskManager();
      mgr2.__registerMastra(mastra);
      await mgr2.init(isolatedPubsub);

      await tick();

      const task = await mgr2.getTask('stale-task');
      expect(task).toBeDefined();
      expect(task!.status).toBe('failed');
      expect(task!.error?.message).toContain('terminated');

      await mgr2.shutdown();
      await isolatedPubsub.close();
    });

    it('retries stale running tasks if retries remain', async () => {
      const isolatedPubsub = new EventEmitterPubSub();

      const mgr1 = new BackgroundTaskManager();
      mgr1.__registerMastra(mastra);
      await mgr1.init(isolatedPubsub);

      const storage = await mgr1.getStorage();
      const executeFn = vi.fn().mockResolvedValue('recovered');

      await storage.createTask({
        id: 'retry-task',
        status: 'running',
        toolName: 'tool',
        toolCallId: 'call-1',
        args: {},
        agentId: 'a1',
        retryCount: 0,
        maxRetries: 3,
        timeoutMs: 300_000,
        createdAt: new Date(),
        startedAt: new Date(),
        runId: 'run-1',
      });

      await mgr1.shutdown();

      // Restart — register context for the recovered task before init dispatches it
      const mgr2 = new BackgroundTaskManager();
      mgr2.__registerMastra(mastra);
      mgr2.registerTaskContext('retry-task', ctx(executeFn));
      await mgr2.init(isolatedPubsub);

      await tick();

      const task = await mgr2.getTask('retry-task');
      expect(task).toBeDefined();
      expect(task!.status).toBe('completed');

      await mgr2.shutdown();
      await isolatedPubsub.close();
    });

    it('re-dispatches pending tasks from a previous process', async () => {
      const isolatedPubsub = new EventEmitterPubSub();

      const mgr1 = new BackgroundTaskManager();
      mgr1.__registerMastra(mastra);
      await mgr1.init(isolatedPubsub);

      const storage = await mgr1.getStorage();
      const executeFn = vi.fn().mockResolvedValue('dispatched');

      await storage.createTask({
        id: 'pending-task',
        status: 'pending',
        toolName: 'tool',
        toolCallId: 'call-1',
        args: {},
        agentId: 'a1',
        retryCount: 0,
        maxRetries: 0,
        timeoutMs: 300_000,
        createdAt: new Date(),
        runId: 'run-1',
      });

      await mgr1.shutdown();

      const mgr2 = new BackgroundTaskManager();
      mgr2.__registerMastra(mastra);
      mgr2.registerTaskContext('pending-task', ctx(executeFn));
      await mgr2.init(isolatedPubsub);

      await tick();

      const task = await mgr2.getTask('pending-task');
      expect(task).toBeDefined();
      expect(task!.status).toBe('completed');

      await mgr2.shutdown();
      await isolatedPubsub.close();
    });
  });

  describe('stream', () => {
    it('emits dispatch event with running status then completed event', async () => {
      const abortController = new AbortController();
      const stream = manager.stream({ abortSignal: abortController.signal });
      const reader = stream.getReader();

      const executeFn = vi.fn().mockResolvedValue('streamed-result');
      await manager.enqueue(
        { toolName: 'tool', toolCallId: 'c1', args: {}, agentId: 'a1', runId: 'run-1' },
        ctx(executeFn),
      );

      await tick();

      // First event: dispatch (running)
      const first = await reader.read();
      expect(first.done).toBe(false);
      expect(first.value).toMatchObject({
        type: 'background-task-running',
        payload: { toolName: 'tool', agentId: 'a1' },
      });

      // Second event: completed
      const second = await reader.read();
      expect(second.value).toMatchObject({
        type: 'background-task-completed',
        payload: { toolName: 'tool', result: 'streamed-result' },
      });

      abortController.abort();
    });

    it('emits failed events with failed status', async () => {
      const abortController = new AbortController();
      const stream = manager.stream({ abortSignal: abortController.signal });
      const reader = stream.getReader();

      const executeFn = vi.fn().mockRejectedValue(new Error('boom'));
      await manager.enqueue(
        { toolName: 'tool', toolCallId: 'c1', args: {}, agentId: 'a1', runId: 'run-1' },
        ctx(executeFn),
      );

      await tick();

      // Skip dispatch event
      await reader.read();

      const { value } = await reader.read();
      expect(value).toMatchObject({
        type: 'background-task-failed',
        payload: { toolName: 'tool', error: expect.objectContaining({ message: 'boom' }) },
      });

      abortController.abort();
    });

    it('emits every progress output chunk by default', async () => {
      const abortController = new AbortController();
      const stream = manager.stream({ abortSignal: abortController.signal });
      const reader = stream.getReader();

      const chunk = (output: string) => ({
        type: 'tool-output',
        runId: 'run-1',
        from: 'AGENT',
        payload: { output, toolCallId: 'c1', toolName: 'tool' },
      });

      const executeFn = vi.fn().mockImplementation(async (_args: any, opts: { onProgress?: (chunk: any) => void }) => {
        await opts.onProgress?.(chunk('first'));
        await opts.onProgress?.(chunk('second'));
        await opts.onProgress?.(chunk('third'));
        return 'done';
      });

      await manager.enqueue(
        { toolName: 'tool', toolCallId: 'c1', args: {}, agentId: 'a1', runId: 'run-1' },
        ctx(executeFn),
      );

      await tick();

      await reader.read(); // running

      const firstOutput = await reader.read();
      expect(firstOutput.value).toMatchObject({
        type: 'background-task-output',
        payload: { payload: { payload: { output: 'first' } } },
      });

      const secondOutput = await reader.read();
      expect(secondOutput.value).toMatchObject({
        type: 'background-task-output',
        payload: { payload: { payload: { output: 'second' } } },
      });

      const thirdOutput = await reader.read();
      expect(thirdOutput.value).toMatchObject({
        type: 'background-task-output',
        payload: { payload: { payload: { output: 'third' } } },
      });

      const completed = await reader.read();
      expect(completed.value).toMatchObject({
        type: 'background-task-completed',
        payload: { result: 'done' },
      });

      abortController.abort();
    });

    it('throttles progress output chunks while still emitting completion', async () => {
      const isolatedPubsub = new EventEmitterPubSub();
      const mgr = new BackgroundTaskManager({ enabled: true, progressThrottleMs: 100 });
      mgr.__registerMastra(mastra);
      await mgr.init(isolatedPubsub);

      const abortController = new AbortController();
      const stream = mgr.stream({ abortSignal: abortController.signal });
      const reader = stream.getReader();
      let now = 1_000;
      const dateNow = vi.spyOn(Date, 'now').mockImplementation(() => now);

      const chunk = (output: string) => ({
        type: 'tool-output',
        runId: 'run-1',
        from: 'AGENT',
        payload: { output, toolCallId: 'c1', toolName: 'tool' },
      });

      const executeFn = vi.fn().mockImplementation(async (_args: any, opts: { onProgress?: (chunk: any) => void }) => {
        await opts.onProgress?.(chunk('first'));
        now += 50;
        await opts.onProgress?.(chunk('dropped'));
        now += 100;
        await opts.onProgress?.(chunk('third'));
        return 'done';
      });

      try {
        await mgr.enqueue(
          { toolName: 'tool', toolCallId: 'c1', args: {}, agentId: 'a1', runId: 'run-1' },
          ctx(executeFn),
        );

        await tick();

        await reader.read(); // running

        const firstOutput = await reader.read();
        expect(firstOutput.value).toMatchObject({
          type: 'background-task-output',
          payload: { payload: { payload: { output: 'first' } } },
        });

        const thirdOutput = await reader.read();
        expect(thirdOutput.value).toMatchObject({
          type: 'background-task-output',
          payload: { payload: { payload: { output: 'third' } } },
        });

        const completed = await reader.read();
        expect(completed.value).toMatchObject({
          type: 'background-task-completed',
          payload: { result: 'done' },
        });
      } finally {
        dateNow.mockRestore();
        abortController.abort();
        await mgr.shutdown();
        await isolatedPubsub.close();
      }
    });

    it('emits cancel event with cancelled status', async () => {
      const abortController = new AbortController();
      const stream = manager.stream({ abortSignal: abortController.signal });
      const reader = stream.getReader();

      // Use a tool that blocks so we can cancel while running
      const executeFn = vi.fn().mockImplementation(
        (_args: any, opts: { abortSignal: AbortSignal }) =>
          new Promise((_resolve, reject) => {
            opts.abortSignal.addEventListener('abort', () => reject(new Error('Task cancelled')));
          }),
      );

      const { task } = await manager.enqueue(
        { toolName: 'tool', toolCallId: 'c1', args: {}, agentId: 'a1', runId: 'run-1' },
        ctx(executeFn),
      );

      await tick();

      // Skip dispatch event
      await reader.read();

      // Cancel the task
      await manager.cancel(task.id);
      await tick();

      const { value } = await reader.read();
      expect(value).toMatchObject({
        type: 'background-task-cancelled',
        payload: { toolName: 'tool', taskId: task.id },
      });

      abortController.abort();
    });

    it('filters by agentId across all event types', async () => {
      const abortController = new AbortController();
      const stream = manager.stream({ agentId: 'a2', abortSignal: abortController.signal });
      const reader = stream.getReader();

      // Enqueue for a1 — should NOT appear on the stream filtered to a2
      await manager.enqueue(
        { toolName: 'tool', toolCallId: 'c1', args: {}, agentId: 'a1', runId: 'run-1' },
        ctx(vi.fn().mockResolvedValue('for-a1')),
      );
      // Enqueue for a2 — should appear
      await manager.enqueue(
        { toolName: 'tool', toolCallId: 'c2', args: {}, agentId: 'a2', runId: 'run-2' },
        ctx(vi.fn().mockResolvedValue('for-a2')),
      );

      await tick();

      // First event for a2: dispatch
      const first = await reader.read();
      expect(first.value).toMatchObject({
        type: 'background-task-running',
        payload: { toolName: 'tool', agentId: 'a2' },
      });

      // Second event for a2: completed
      const second = await reader.read();
      expect(second.value).toMatchObject({
        type: 'background-task-completed',
        payload: { toolName: 'tool', agentId: 'a2', result: 'for-a2' },
      });

      abortController.abort();
    });

    it('filters by runId', async () => {
      const abortController = new AbortController();
      const stream = manager.stream({ runId: 'run-target', abortSignal: abortController.signal });
      const reader = stream.getReader();

      await manager.enqueue(
        { toolName: 'tool', toolCallId: 'c1', args: {}, agentId: 'a1', runId: 'run-other' },
        ctx(vi.fn().mockResolvedValue('other')),
      );
      await manager.enqueue(
        { toolName: 'tool', toolCallId: 'c2', args: {}, agentId: 'a1', runId: 'run-target' },
        ctx(vi.fn().mockResolvedValue('target')),
      );

      await tick();

      // dispatch for run-target
      const first = await reader.read();
      expect(first.value).toMatchObject({
        type: 'background-task-running',
        payload: { toolName: 'tool', runId: 'run-target' },
      });

      // completed for run-target
      const second = await reader.read();
      expect(second.value).toMatchObject({
        type: 'background-task-completed',
        payload: { toolName: 'tool', runId: 'run-target', result: 'target' },
      });

      abortController.abort();
    });

    it('snapshot only includes running tasks, not already-completed ones', async () => {
      // Enqueue a blocking task (will be running) and a fast task (will be completed)
      let resolver!: (val: string) => void;
      await manager.enqueue(
        { toolName: 'slow', toolCallId: 'c1', args: {}, agentId: 'a1', runId: 'run-1' },
        ctx(
          vi.fn().mockImplementation(
            () =>
              new Promise<string>(r => {
                resolver = r;
              }),
          ),
        ),
      );
      await manager.enqueue(
        { toolName: 'fast', toolCallId: 'c2', args: {}, agentId: 'a1', runId: 'run-2' },
        ctx(vi.fn().mockResolvedValue('done')),
      );
      await tick();

      // Open stream — snapshot should only include the running task, not the completed one
      const abortController = new AbortController();
      const stream = manager.stream({ abortSignal: abortController.signal });
      const reader = stream.getReader();

      const snapshot = await reader.read();
      expect(snapshot.value).toMatchObject({
        type: 'background-task-running',
        payload: { toolName: 'slow' },
      });

      // Complete the running task — live event should come through
      resolver('late-result');
      await tick();

      const live = await reader.read();
      expect(live.value).toMatchObject({
        type: 'background-task-completed',
        payload: { toolName: 'slow', result: 'late-result' },
      });

      abortController.abort();
    });

    it('emits snapshot of running tasks then live completion', async () => {
      // Enqueue a task that blocks
      let resolver!: (val: string) => void;
      const executeFn = vi.fn().mockImplementation(
        () =>
          new Promise<string>(resolve => {
            resolver = resolve;
          }),
      );
      await manager.enqueue(
        { toolName: 'tool', toolCallId: 'c1', args: {}, agentId: 'a1', runId: 'run-1' },
        ctx(executeFn),
      );
      await tick();

      // Open stream while task is running — snapshot should show running status
      const abortController = new AbortController();
      const stream = manager.stream({ abortSignal: abortController.signal });
      const reader = stream.getReader();

      const snapshot = await reader.read();
      expect(snapshot.value).toMatchObject({
        type: 'background-task-running',
        payload: { toolName: 'tool' },
      });

      // Complete the task — should get live completion event
      resolver('late-result');
      await tick();

      const live = await reader.read();
      expect(live.value).toMatchObject({
        type: 'background-task-completed',
        payload: { toolName: 'tool', result: 'late-result' },
      });

      abortController.abort();
    });

    it('closes when abortSignal fires', async () => {
      const abortController = new AbortController();
      const stream = manager.stream({ abortSignal: abortController.signal });
      const reader = stream.getReader();

      abortController.abort();

      const { done } = await reader.read();
      expect(done).toBe(true);
    });
  });

  describe('shutdown', () => {
    it('rejects new enqueues after shutdown', async () => {
      await manager.shutdown();

      await expect(
        manager.enqueue({ toolName: 'tool', toolCallId: 'c1', args: {}, agentId: 'a1', runId: 'run-1' }),
      ).rejects.toThrow('shutting down');
    });
  });
});
