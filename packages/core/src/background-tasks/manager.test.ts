import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { EventEmitterPubSub } from '../events/event-emitter';
import { Mastra } from '../mastra';
import { MockStore } from '../storage';
import { createBackgroundTask } from './create';
import { BackgroundTaskManager } from './manager';
import type { BackgroundTaskManagerConfig, TaskContext } from './types';

/** Create a per-task context with the given execute function */
function ctx(executeFn: (args: any, opts?: any) => Promise<any>): TaskContext {
  return { executor: { execute: executeFn } };
}

const testStorage = new MockStore();

/** Wait for async microtasks/timers to settle */
const tick = (ms = 50) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Spin up a private Mastra + bg-task manager scoped to a single test. Tests
 * that need a different manager config than the shared `manager` from
 * `beforeEach` must use this — reusing the shared `mastra` causes the bg-task
 * workflow registration on Mastra to bind to the *first* manager that called
 * `init()`. Subsequent managers registering against the same Mastra see
 * `__hasInternalWorkflow(...) === true` and skip re-registration, so their
 * dispatches actually run through the first manager's workflow and fail to
 * find the executor in `taskContexts`.
 */
async function makeLocalManager(config: BackgroundTaskManagerConfig) {
  const localMastra = new Mastra({ logger: false, storage: testStorage });
  await localMastra.startEventEngine();
  const isolatedPubsub = new EventEmitterPubSub();
  const mgr = new BackgroundTaskManager(config);
  mgr.__registerMastra(localMastra);
  await mgr.init(isolatedPubsub);
  return {
    mgr,
    localMastra,
    isolatedPubsub,
    cleanup: async () => {
      await mgr.shutdown();
      await isolatedPubsub.close();
      await localMastra.stopEventEngine();
    },
  };
}

describe('BackgroundTaskManager', () => {
  let pubsub: EventEmitterPubSub;
  let manager: BackgroundTaskManager;
  let mastra: Mastra;

  beforeEach(async () => {
    // Fresh Mastra per test so the workflow engine's per-Mastra processor +
    // internal-workflow registry stays clean between tests.
    mastra = new Mastra({
      logger: false,
      storage: testStorage,
    });
    await mastra.startEventEngine();
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
    await mastra.stopEventEngine();
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
      const { mgr: rejectManager, cleanup } = await makeLocalManager({
        enabled: true,
        globalConcurrency: 1,
        perAgentConcurrency: 1,
        backpressure: 'reject',
      });

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
      await cleanup();
    });

    it('backpressure fallback-sync returns signal', async () => {
      const { mgr: syncManager, cleanup } = await makeLocalManager({
        enabled: true,
        globalConcurrency: 1,
        perAgentConcurrency: 1,
        backpressure: 'fallback-sync',
      });

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
      await cleanup();
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

      const { mgr: retryManager, cleanup } = await makeLocalManager({
        enabled: true,
        defaultRetries: { retryDelayMs: 0 },
      });

      const { task } = await retryManager.enqueue(
        { toolName: 'flaky-tool', toolCallId: 'call-1', args: {}, agentId: 'agent-1', maxRetries: 3, runId: 'run-1' },
        ctx(executeFn),
      );

      await tick(200);

      const result = await retryManager.getTask(task.id);
      expect(result?.status).toBe('completed');
      expect(result?.result).toBe('success');
      expect(executeFn).toHaveBeenCalledTimes(3);

      await cleanup();
    });

    it('fails after exhausting retries', async () => {
      const executeFn = vi.fn().mockRejectedValue(new Error('Always fails'));

      const { mgr: retryManager, cleanup } = await makeLocalManager({
        enabled: true,
        defaultRetries: { retryDelayMs: 0 },
      });

      const { task } = await retryManager.enqueue(
        { toolName: 'bad-tool', toolCallId: 'call-1', args: {}, agentId: 'agent-1', maxRetries: 2, runId: 'run-1' },
        ctx(executeFn),
      );

      await tick(200);

      const result = await retryManager.getTask(task.id);
      expect(result?.status).toBe('failed');
      expect(executeFn).toHaveBeenCalledTimes(3); // initial + 2 retries

      await cleanup();
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
      const { mgr, cleanup } = await makeLocalManager({ enabled: true, onTaskComplete: onComplete });

      const executeFn = vi.fn().mockResolvedValue('result');
      await mgr.enqueue(
        { toolName: 'tool', toolCallId: 'c1', args: {}, agentId: 'a1', runId: 'run-1' },
        ctx(executeFn),
      );
      await tick();

      expect(onComplete).toHaveBeenCalledTimes(1);
      expect(onComplete.mock.calls[0]![0].status).toBe('completed');

      await cleanup();
    });

    it('invokes onTaskFailed callback', async () => {
      const onFailed = vi.fn();
      const { mgr, cleanup } = await makeLocalManager({ enabled: true, onTaskFailed: onFailed });

      const executeFn = vi.fn().mockRejectedValue(new Error('oops'));
      await mgr.enqueue(
        { toolName: 'tool', toolCallId: 'c1', args: {}, agentId: 'a1', runId: 'run-1' },
        ctx(executeFn),
      );
      await tick();

      expect(onFailed).toHaveBeenCalledTimes(1);
      expect(onFailed.mock.calls[0]![0].status).toBe('failed');

      await cleanup();
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
      const { mgr, cleanup } = await makeLocalManager({
        enabled: true,
        cleanup: { completedTtlMs: 100, failedTtlMs: 200 },
      });

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

      await cleanup();
    });

    it('keeps recent completed tasks', async () => {
      const { mgr, cleanup } = await makeLocalManager({
        enabled: true,
        cleanup: { completedTtlMs: 60_000 },
      });

      const executeFn = vi.fn().mockResolvedValue('ok');
      await mgr.enqueue(
        { toolName: 'tool', toolCallId: 'c1', args: {}, agentId: 'a1', runId: 'run-1' },
        ctx(executeFn),
      );
      await tick();

      await mgr.cleanup();

      const { tasks: afterTasks } = await mgr.listTasks({});
      expect(afterTasks.length).toBe(1);

      await cleanup();
    });

    it('deletes old failed tasks with separate TTL', async () => {
      const { mgr, cleanup } = await makeLocalManager({
        enabled: true,
        cleanup: { completedTtlMs: 50, failedTtlMs: 100 },
      });

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

      await cleanup();
    });
  });

  describe('suspend/resume', () => {
    it('suspends mid-execution and persists status + suspendPayload', async () => {
      const executeFn = vi.fn(async (_args, opts: any) => {
        await opts.suspend({ awaiting: 'human-approval' });
        // Code after suspend runs but its return value is discarded.
        return 'should-be-ignored';
      });

      const { task } = await manager.enqueue(
        { toolName: 't', toolCallId: 'csusp1', args: { ask: 'go?' }, agentId: 'a1', runId: 'r1' },
        ctx(executeFn),
      );

      await tick(200);

      const suspended = await manager.getTask(task.id);
      expect(suspended?.status).toBe('suspended');
      expect(suspended?.suspendPayload).toEqual({ awaiting: 'human-approval' });
      expect(suspended?.result).toBeUndefined();
      expect(executeFn).toHaveBeenCalledTimes(1);
    });

    it('emits a background-task-suspended chunk on the manager stream', async () => {
      const executeFn = vi.fn(async (_args, opts: any) => {
        await opts.suspend({ ask: 'pause' });
      });

      const chunks: any[] = [];
      const abortController = new AbortController();
      const stream = manager.stream({ abortSignal: abortController.signal });
      const consumer = (async () => {
        for await (const chunk of stream as any) chunks.push(chunk);
      })();

      const { task } = await manager.enqueue(
        { toolName: 't', toolCallId: 'csusp2', args: {}, agentId: 'a1', runId: 'r2' },
        ctx(executeFn),
      );

      await tick(200);
      abortController.abort();
      await consumer;

      const suspendedChunk = chunks.find(c => c.type === 'background-task-suspended');
      expect(suspendedChunk).toBeDefined();
      expect(suspendedChunk.payload.taskId).toBe(task.id);
      expect(suspendedChunk.payload.suspendPayload).toEqual({ ask: 'pause' });
    });

    it('resumes a suspended task with resumeData and completes', async () => {
      const executeFn = vi.fn(async (_args, opts: any) => {
        if (!opts.resumeData) {
          await opts.suspend({ awaiting: 'approval' });
          return undefined;
        }
        return { approvedBy: (opts.resumeData as { user: string }).user };
      });

      const { task } = await manager.enqueue(
        { toolName: 't', toolCallId: 'cres1', args: {}, agentId: 'a1', runId: 'r3' },
        ctx(executeFn),
      );
      await tick(200);
      expect((await manager.getTask(task.id))?.status).toBe('suspended');

      await manager.resume(task.id, { user: 'alice' });
      await tick(200);

      const completed = await manager.getTask(task.id);
      expect(completed?.status).toBe('completed');
      expect(completed?.result).toEqual({ approvedBy: 'alice' });
      expect(completed?.suspendPayload).toBeUndefined();
      expect(executeFn).toHaveBeenCalledTimes(2);
    });

    it('emits background-task-resumed on the stream when resumed', async () => {
      const executeFn = vi.fn(async (_args, opts: any) => {
        if (!opts.resumeData) {
          await opts.suspend({ awaiting: 'go' });
          return undefined;
        }
        return 'ok';
      });

      const chunks: any[] = [];
      const abortController = new AbortController();
      const stream = manager.stream({ abortSignal: abortController.signal });
      const consumer = (async () => {
        for await (const chunk of stream as any) chunks.push(chunk);
      })();

      const { task } = await manager.enqueue(
        { toolName: 't', toolCallId: 'cres2', args: {}, agentId: 'a1', runId: 'r4' },
        ctx(executeFn),
      );
      await tick(200);
      await manager.resume(task.id, { go: true });
      await tick(200);
      abortController.abort();
      await consumer;

      expect(chunks.some(c => c.type === 'background-task-suspended' && c.payload.taskId === task.id)).toBe(true);
      expect(chunks.some(c => c.type === 'background-task-resumed' && c.payload.taskId === task.id)).toBe(true);
      expect(chunks.some(c => c.type === 'background-task-completed' && c.payload.taskId === task.id)).toBe(true);
    });

    it('cancels a suspended task and publishes task.cancelled', async () => {
      const executeFn = vi.fn(async (_args, opts: any) => {
        await opts.suspend({});
      });

      const { task } = await manager.enqueue(
        { toolName: 't', toolCallId: 'ccsusp', args: {}, agentId: 'a1', runId: 'r5' },
        ctx(executeFn),
      );
      await tick(200);
      expect((await manager.getTask(task.id))?.status).toBe('suspended');

      await manager.cancel(task.id);
      await tick(50);

      const cancelled = await manager.getTask(task.id);
      expect(cancelled?.status).toBe('cancelled');
    });

    it('throws when resuming a task that is not suspended', async () => {
      const executeFn = vi.fn().mockResolvedValue('done');
      const { task } = await manager.enqueue(
        { toolName: 't', toolCallId: 'cnotsusp', args: {}, agentId: 'a1', runId: 'r6' },
        ctx(executeFn),
      );
      await tick(150);
      await expect(manager.resume(task.id)).rejects.toThrow(/Cannot resume task in status 'completed'/);
    });

    it('preserves retry counter across suspend/resume', async () => {
      let calls = 0;
      const executeFn = vi.fn(async (_args, opts: any) => {
        calls++;
        if (calls === 1) {
          // First attempt: throw to record a retry.
          throw new Error('first-attempt-fails');
        }
        if (calls === 2) {
          // Second attempt (retry): suspend.
          await opts.suspend({ at: 'attempt-2' });
          return undefined;
        }
        // Resume: complete.
        return { resumeData: opts.resumeData };
      });

      const { task } = await manager.enqueue(
        { toolName: 't', toolCallId: 'cretry', args: {}, agentId: 'a1', runId: 'r7', maxRetries: 3 },
        ctx(executeFn),
      );
      await tick(300);

      const suspended = await manager.getTask(task.id);
      expect(suspended?.status).toBe('suspended');
      // After the first failed attempt, retryCount was bumped to 1; suspending
      // mid-attempt-2 leaves it at 1 (not bumped — only failures bump).
      expect(suspended?.retryCount).toBe(1);

      await manager.resume(task.id, { ok: true });
      await tick(300);

      const completed = await manager.getTask(task.id);
      expect(completed?.status).toBe('completed');
      expect(completed?.result).toEqual({ resumeData: { ok: true } });
      // Resume re-entered the step at attempt = task.retryCount = 1, did NOT
      // re-run the failed attempt 0. Total executor calls: 1 (failed) +
      // 1 (suspended) + 1 (resumed) = 3, not 4.
      expect(calls).toBe(3);
    });
  });

  describe('recovery on startup', () => {
    it('recovers stale running tasks with retries available', async () => {
      // Pre-seed storage with a task in 'running' status as if a previous
      // process crashed mid-execution. A fresh manager.init() should flip
      // it to pending and re-dispatch via the workflow.
      const seedStorage = new MockStore();
      const local = new Mastra({
        logger: false,
        storage: seedStorage,
        backgroundTasks: { enabled: true },
      });

      const bgStore = await seedStorage.getStore('backgroundTasks');
      await bgStore!.createTask({
        id: 'stale-1',
        status: 'running',
        toolName: 't',
        toolCallId: 'c',
        args: {},
        agentId: 'a',
        runId: 'r',
        retryCount: 0,
        maxRetries: 1,
        timeoutMs: 5000,
        createdAt: new Date(),
        startedAt: new Date(Date.now() - 60_000),
      });

      // Register the context BEFORE init's recoverStaleTasks fires. The
      // backgroundTaskManager is set synchronously by Mastra's constructor;
      // init() is fire-and-forget after.
      local.backgroundTaskManager!.registerTaskContext(
        'stale-1',
        ctx(async () => 'recovered'),
      );
      await local.startEventEngine();

      try {
        const mgr = local.backgroundTaskManager!;

        // Recovery is async during init — give it time to flip + re-dispatch.
        await tick(200);

        const completed = await mgr.getTask('stale-1');
        expect(completed?.status).toBe('completed');
        expect(completed?.result).toBe('recovered');
      } finally {
        await local.backgroundTaskManager?.shutdown();
        await local.stopEventEngine();
      }
    });

    it('re-dispatches stale pending tasks on init', async () => {
      const seedStorage = new MockStore();
      const local = new Mastra({
        logger: false,
        storage: seedStorage,
        backgroundTasks: { enabled: true },
      });

      const bgStore = await seedStorage.getStore('backgroundTasks');
      await bgStore!.createTask({
        id: 'pending-1',
        status: 'pending',
        toolName: 't',
        toolCallId: 'c',
        args: {},
        agentId: 'a',
        runId: 'r',
        retryCount: 0,
        maxRetries: 0,
        timeoutMs: 5000,
        createdAt: new Date(),
      });

      local.backgroundTaskManager!.registerTaskContext(
        'pending-1',
        ctx(async () => 'late-pickup'),
      );
      await local.startEventEngine();

      try {
        const mgr = local.backgroundTaskManager!;

        await tick(200);

        const completed = await mgr.getTask('pending-1');
        expect(completed?.status).toBe('completed');
        expect(completed?.result).toBe('late-pickup');
      } finally {
        await local.backgroundTaskManager?.shutdown();
        await local.stopEventEngine();
      }
    });

    it('leaves suspended tasks alone on init recovery', async () => {
      // First mastra: enqueue a task that suspends.
      const seedStorage = new MockStore();
      const m1 = new Mastra({
        logger: false,
        storage: seedStorage,
        backgroundTasks: { enabled: true },
      });
      await m1.startEventEngine();
      await tick();
      const mgr1 = m1.backgroundTaskManager!;
      const executeFn = vi.fn(async (_args, opts: any) => {
        await opts.suspend({ checkpoint: 1 });
      });
      const { task } = await mgr1.enqueue(
        { toolName: 't', toolCallId: 'crec', args: {}, agentId: 'a1', runId: 'r8' },
        ctx(executeFn),
      );
      await tick(200);
      expect((await mgr1.getTask(task.id))?.status).toBe('suspended');
      await mgr1.shutdown();
      await m1.stopEventEngine();

      // Second mastra over the same storage — recovery should NOT touch
      // the suspended row.
      const m2 = new Mastra({
        logger: false,
        storage: seedStorage,
        backgroundTasks: { enabled: true },
      });
      await m2.startEventEngine();
      await tick(150);
      try {
        const mgr2 = m2.backgroundTaskManager!;
        const stillSuspended = await mgr2.getTask(task.id);
        expect(stillSuspended?.status).toBe('suspended');
        expect(stillSuspended?.suspendPayload).toEqual({ checkpoint: 1 });
      } finally {
        await m2.backgroundTaskManager?.shutdown();
        await m2.stopEventEngine();
      }
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
      const { mgr, cleanup } = await makeLocalManager({ enabled: true, progressThrottleMs: 100 });

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
        await cleanup();
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
