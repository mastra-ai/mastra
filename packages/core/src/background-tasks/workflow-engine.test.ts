import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Mastra } from '../mastra';
import { MockStore } from '../storage';
import type { TaskContext } from './types';

function ctx(executeFn: (args: any, opts?: any) => Promise<any>): TaskContext {
  return { executor: { execute: executeFn } };
}

const tick = (ms = 50) => new Promise(resolve => setTimeout(resolve, ms));

describe('BackgroundTaskManager [engine=workflow]', () => {
  let mastra: Mastra;

  beforeEach(async () => {
    mastra = new Mastra({
      logger: false,
      storage: new MockStore(),
      backgroundTasks: {
        enabled: true,
        engine: 'workflow',
        globalConcurrency: 3,
        perAgentConcurrency: 2,
        defaultTimeoutMs: 5000,
      },
    });
    // Wire up the workflow event processor's pubsub subscriptions.
    await mastra.startEventEngine();
    // Manager.init() is fire-and-forget from Mastra's constructor.
    await tick();
  });

  afterEach(async () => {
    await mastra.backgroundTaskManager?.shutdown();
    await mastra.stopEventEngine();
    const store = await mastra.getStorage()?.getStore('backgroundTasks');
    await store?.dangerouslyClearAll();
  });

  it('executes the task and persists the completed status', async () => {
    const manager = mastra.backgroundTaskManager!;
    const executeFn = vi.fn().mockResolvedValue({ data: 'hello' });

    const { task } = await manager.enqueue(
      { toolName: 'my-tool', toolCallId: 'call-1', args: { query: 'test' }, agentId: 'agent-1', runId: 'run-1' },
      ctx(executeFn),
    );

    await tick(150);

    const completed = await manager.getTask(task.id);
    expect(completed?.status).toBe('completed');
    expect(completed?.result).toEqual({ data: 'hello' });
    expect(executeFn).toHaveBeenCalledTimes(1);
  });

  it('marks the task failed when the executor throws', async () => {
    const manager = mastra.backgroundTaskManager!;
    const executeFn = vi.fn().mockRejectedValue(new Error('boom'));

    const { task } = await manager.enqueue(
      { toolName: 'my-tool', toolCallId: 'call-2', args: {}, agentId: 'agent-1', runId: 'run-2' },
      ctx(executeFn),
    );

    await tick(200);

    const failed = await manager.getTask(task.id);
    expect(failed?.status).toBe('failed');
    expect(failed?.error?.message).toBe('boom');
  });

  it('routes timeouts to the timed_out status', async () => {
    const manager = mastra.backgroundTaskManager!;
    const executeFn = vi.fn(async (_args, opts: any) => {
      await new Promise((_resolve, reject) => {
        opts?.abortSignal?.addEventListener('abort', () =>
          reject(Object.assign(new Error('Aborted'), { name: 'AbortError' })),
        );
      });
    });

    const { task } = await manager.enqueue(
      { toolName: 'slow-tool', toolCallId: 'call-3', args: {}, agentId: 'agent-1', runId: 'run-3', timeoutMs: 100 },
      ctx(executeFn),
    );

    await tick(300);

    const timedOut = await manager.getTask(task.id);
    expect(timedOut?.status).toBe('timed_out');
    expect(timedOut?.error?.message).toMatch(/timed out/i);
  });

  it('forwards onProgress chunks to the bg-task stream', async () => {
    const manager = mastra.backgroundTaskManager!;
    const executeFn = vi.fn(async (_args, opts: any) => {
      await opts?.onProgress?.({ type: 'tool-output', payload: { text: 'half done' } });
      await opts?.onProgress?.({ type: 'tool-output', payload: { text: 'almost there' } });
      return 'done';
    });

    const chunks: any[] = [];
    const abortController = new AbortController();
    const stream = manager.stream({ abortSignal: abortController.signal });

    const consumer = (async () => {
      for await (const chunk of stream as any) {
        chunks.push(chunk);
      }
    })();

    await manager.enqueue(
      { toolName: 'progress-tool', toolCallId: 'call-4', args: {}, agentId: 'agent-1', runId: 'run-4' },
      ctx(executeFn),
    );

    await tick(200);
    abortController.abort();
    await consumer;

    const outputs = chunks.filter(c => c.type === 'background-task-output');
    expect(outputs.length).toBe(2);
    expect(chunks.some(c => c.type === 'background-task-completed')).toBe(true);
  });

  it('retries up to maxRetries before failing', async () => {
    const manager = mastra.backgroundTaskManager!;
    let calls = 0;
    const executeFn = vi.fn(async () => {
      calls++;
      if (calls < 3) throw new Error(`transient ${calls}`);
      return 'ok';
    });

    const { task } = await manager.enqueue(
      {
        toolName: 'flaky',
        toolCallId: 'call-5',
        args: {},
        agentId: 'agent-1',
        runId: 'run-5',
        maxRetries: 2,
      },
      ctx(executeFn),
    );

    await tick(300);

    const completed = await manager.getTask(task.id);
    expect(completed?.status).toBe('completed');
    expect(completed?.result).toBe('ok');
    expect(executeFn).toHaveBeenCalledTimes(3);
  });

  it('marks the task failed after exhausting retries', async () => {
    const manager = mastra.backgroundTaskManager!;
    const executeFn = vi.fn().mockRejectedValue(new Error('always fails'));

    const { task } = await manager.enqueue(
      {
        toolName: 'always-fails',
        toolCallId: 'call-6',
        args: {},
        agentId: 'agent-1',
        runId: 'run-6',
        maxRetries: 2,
      },
      ctx(executeFn),
    );

    await tick(300);

    const failed = await manager.getTask(task.id);
    expect(failed?.status).toBe('failed');
    expect(failed?.error?.message).toBe('always fails');
    expect(executeFn).toHaveBeenCalledTimes(3); // initial + 2 retries
  });

  it('fires the global onTaskComplete callback', async () => {
    const onComplete = vi.fn();
    const local = new Mastra({
      logger: false,
      storage: new MockStore(),
      backgroundTasks: { enabled: true, engine: 'workflow', onTaskComplete: onComplete },
    });
    await local.startEventEngine();
    await tick();

    try {
      const manager = local.backgroundTaskManager!;
      await manager.enqueue(
        { toolName: 't', toolCallId: 'cc', args: {}, agentId: 'a', runId: 'r' },
        ctx(async () => 'ok'),
      );

      await tick(150);

      expect(onComplete).toHaveBeenCalledTimes(1);
      expect(onComplete.mock.calls[0]![0].status).toBe('completed');
    } finally {
      await local.backgroundTaskManager?.shutdown();
      await local.stopEventEngine();
    }
  });

  it('fires the global onTaskFailed callback', async () => {
    const onFailed = vi.fn();
    const local = new Mastra({
      logger: false,
      storage: new MockStore(),
      backgroundTasks: { enabled: true, engine: 'workflow', onTaskFailed: onFailed },
    });
    await local.startEventEngine();
    await tick();

    try {
      const manager = local.backgroundTaskManager!;
      await manager.enqueue(
        { toolName: 't', toolCallId: 'cf', args: {}, agentId: 'a', runId: 'r' },
        ctx(async () => {
          throw new Error('nope');
        }),
      );

      await tick(150);

      expect(onFailed).toHaveBeenCalledTimes(1);
      expect(onFailed.mock.calls[0]![0].status).toBe('failed');
    } finally {
      await local.backgroundTaskManager?.shutdown();
      await local.stopEventEngine();
    }
  });

  it("backpressure 'reject' throws when concurrency is full", async () => {
    const local = new Mastra({
      logger: false,
      storage: new MockStore(),
      backgroundTasks: {
        enabled: true,
        engine: 'workflow',
        globalConcurrency: 1,
        perAgentConcurrency: 1,
        backpressure: 'reject',
      },
    });
    await local.startEventEngine();
    await tick();

    try {
      const manager = local.backgroundTaskManager!;
      let resolver!: () => void;
      const slowExec = vi.fn(() => new Promise<string>(resolve => (resolver = () => resolve('done'))));

      await manager.enqueue({ toolName: 't', toolCallId: 'c1', args: {}, agentId: 'a', runId: 'r1' }, ctx(slowExec));

      await tick();

      await expect(
        manager.enqueue(
          { toolName: 't', toolCallId: 'c2', args: {}, agentId: 'a', runId: 'r2' },
          ctx(async () => 'second'),
        ),
      ).rejects.toThrow(/concurrency limit/i);

      resolver();
    } finally {
      await local.backgroundTaskManager?.shutdown();
      await local.stopEventEngine();
    }
  });

  it("backpressure 'fallback-sync' returns the fallback signal", async () => {
    const local = new Mastra({
      logger: false,
      storage: new MockStore(),
      backgroundTasks: {
        enabled: true,
        engine: 'workflow',
        globalConcurrency: 1,
        perAgentConcurrency: 1,
        backpressure: 'fallback-sync',
      },
    });
    await local.startEventEngine();
    await tick();

    try {
      const manager = local.backgroundTaskManager!;
      let resolver!: () => void;
      const slowExec = vi.fn(() => new Promise<string>(resolve => (resolver = () => resolve('done'))));

      await manager.enqueue({ toolName: 't', toolCallId: 'c1', args: {}, agentId: 'a', runId: 'r1' }, ctx(slowExec));
      await tick();

      const result = await manager.enqueue(
        { toolName: 't', toolCallId: 'c2', args: {}, agentId: 'a', runId: 'r2' },
        ctx(async () => 'second'),
      );

      expect(result.fallbackToSync).toBe(true);
      resolver();
    } finally {
      await local.backgroundTaskManager?.shutdown();
      await local.stopEventEngine();
    }
  });

  it('cancels a running task and aborts the executor', async () => {
    const manager = mastra.backgroundTaskManager!;
    let capturedSignal!: AbortSignal;
    const executeFn = vi.fn(
      (_args, opts) =>
        new Promise<string>((_resolve, reject) => {
          capturedSignal = opts!.abortSignal!;
          opts!.abortSignal!.addEventListener('abort', () => reject(new Error('Task cancelled')));
        }),
    );

    const { task } = await manager.enqueue(
      { toolName: 't', toolCallId: 'cc', args: {}, agentId: 'a', runId: 'r' },
      ctx(executeFn),
    );

    await tick();
    await manager.cancel(task.id);
    await tick(50);

    expect(capturedSignal.aborted).toBe(true);
    const cancelled = await manager.getTask(task.id);
    expect(cancelled?.status).toBe('cancelled');
  });

  it('recovers stale running tasks with retries available', async () => {
    // Pre-seed storage with a task in 'running' status as if a previous
    // process crashed mid-execution. A fresh manager.init() should flip it
    // to pending and re-dispatch via the workflow.
    const storage = new MockStore();
    const local = new Mastra({
      logger: false,
      storage,
      backgroundTasks: { enabled: true, engine: 'workflow' },
    });

    const bgStore = await storage.getStore('backgroundTasks');
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
      const manager = local.backgroundTaskManager!;

      // Recovery is async during init — give it time to flip + re-dispatch.
      await tick(200);

      const completed = await manager.getTask('stale-1');
      expect(completed?.status).toBe('completed');
      expect(completed?.result).toBe('recovered');
    } finally {
      await local.backgroundTaskManager?.shutdown();
      await local.stopEventEngine();
    }
  });

  it('re-dispatches stale pending tasks on init', async () => {
    const storage = new MockStore();
    const local = new Mastra({
      logger: false,
      storage,
      backgroundTasks: { enabled: true, engine: 'workflow' },
    });

    const bgStore = await storage.getStore('backgroundTasks');
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
      const manager = local.backgroundTaskManager!;

      await tick(200);

      const completed = await manager.getTask('pending-1');
      expect(completed?.status).toBe('completed');
      expect(completed?.result).toBe('late-pickup');
    } finally {
      await local.backgroundTaskManager?.shutdown();
      await local.stopEventEngine();
    }
  });

  it('suspends mid-execution and persists status + suspendPayload', async () => {
    const manager = mastra.backgroundTaskManager!;
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
    const manager = mastra.backgroundTaskManager!;
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
    const manager = mastra.backgroundTaskManager!;
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
    const manager = mastra.backgroundTaskManager!;
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
    const manager = mastra.backgroundTaskManager!;
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

  it('throws on resume when engine is "legacy"', async () => {
    const local = new Mastra({
      logger: false,
      storage: new MockStore(),
      backgroundTasks: { enabled: true, engine: 'legacy' },
    });
    await tick();
    try {
      const manager = local.backgroundTaskManager!;
      await expect(manager.resume('any-id', {})).rejects.toThrow(/requires engine.*workflow/);
    } finally {
      await local.backgroundTaskManager?.shutdown();
    }
  });

  it('throws when resuming a task that is not suspended', async () => {
    const manager = mastra.backgroundTaskManager!;
    const executeFn = vi.fn().mockResolvedValue('done');
    const { task } = await manager.enqueue(
      { toolName: 't', toolCallId: 'cnotsusp', args: {}, agentId: 'a1', runId: 'r6' },
      ctx(executeFn),
    );
    await tick(150);
    await expect(manager.resume(task.id)).rejects.toThrow(/Cannot resume task in status 'completed'/);
  });

  it('preserves retry counter across suspend/resume', async () => {
    const manager = mastra.backgroundTaskManager!;
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

  it('leaves suspended tasks alone on init recovery', async () => {
    // First mastra: enqueue a task that suspends.
    const store = new MockStore();
    const m1 = new Mastra({
      logger: false,
      storage: store,
      backgroundTasks: { enabled: true, engine: 'workflow' },
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

    // Second mastra over the same storage — recovery should NOT touch the
    // suspended row.
    const m2 = new Mastra({
      logger: false,
      storage: store,
      backgroundTasks: { enabled: true, engine: 'workflow' },
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

  it('throttles progress output chunks when progressThrottleMs is set', async () => {
    const local = new Mastra({
      logger: false,
      storage: new MockStore(),
      backgroundTasks: { enabled: true, engine: 'workflow', progressThrottleMs: 100 },
    });
    await local.startEventEngine();
    await tick();

    try {
      const manager = local.backgroundTaskManager!;
      const executeFn = vi.fn(async (_args, opts: any) => {
        for (let i = 0; i < 5; i++) {
          await opts?.onProgress?.({ type: 'tool-output', payload: { text: `chunk ${i}` } });
        }
        return 'done';
      });

      const chunks: any[] = [];
      const abortController = new AbortController();
      const stream = manager.stream({ abortSignal: abortController.signal });

      const consumer = (async () => {
        for await (const chunk of stream as any) chunks.push(chunk);
      })();

      await manager.enqueue(
        { toolName: 't', toolCallId: 'cthrottle', args: {}, agentId: 'a', runId: 'r' },
        ctx(executeFn),
      );

      await tick(200);
      abortController.abort();
      await consumer;

      const outputs = chunks.filter(c => c.type === 'background-task-output');
      // With throttleMs=100 and 5 immediate chunks, only the first survives.
      expect(outputs.length).toBe(1);
      expect(chunks.some(c => c.type === 'background-task-completed')).toBe(true);
    } finally {
      await local.backgroundTaskManager?.shutdown();
      await local.stopEventEngine();
    }
  });
});
