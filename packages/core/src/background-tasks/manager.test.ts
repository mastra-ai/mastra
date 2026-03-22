import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { EventEmitterPubSub } from '../events/event-emitter';
import { BackgroundTaskManager } from './manager';
import type { ToolResolver } from './types';

function createResolver(implementations: Record<string, (args: any, opts?: any) => Promise<any>>): ToolResolver {
  return (toolName: string) => {
    const impl = implementations[toolName];
    if (!impl) throw new Error(`Unknown tool: ${toolName}`);
    return { execute: impl };
  };
}

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
    });
    await manager.init(pubsub);
  });

  afterEach(async () => {
    await manager.shutdown();
    await pubsub.close();
  });

  describe('enqueue and execute', () => {
    it('enqueues a task, executes it, and completes', async () => {
      const executeFn = vi.fn().mockResolvedValue({ data: 'hello' });
      manager.setToolResolver(createResolver({ 'my-tool': executeFn }));

      const { task } = await manager.enqueue({
        toolName: 'my-tool',
        toolCallId: 'call-1',
        args: { query: 'test' },
        agentId: 'agent-1',
      });

      // With EventEmitter, fast tools complete synchronously during enqueue.
      // The task object is mutated in-place.
      await tick();

      const completed = manager.getTask(task.id);
      expect(completed?.status).toBe('completed');
      expect(completed?.result).toEqual({ data: 'hello' });
      expect(executeFn).toHaveBeenCalledWith(
        { query: 'test' },
        expect.objectContaining({ abortSignal: expect.any(AbortSignal) }),
      );
    });

    it('passes args correctly to the tool', async () => {
      const executeFn = vi.fn().mockResolvedValue('ok');
      manager.setToolResolver(createResolver({ 'my-tool': executeFn }));

      await manager.enqueue({
        toolName: 'my-tool',
        toolCallId: 'call-1',
        args: { foo: 'bar', num: 42 },
        agentId: 'agent-1',
      });

      await tick();
      expect(executeFn).toHaveBeenCalledWith({ foo: 'bar', num: 42 }, expect.anything());
    });

    it('sets failed status when tool throws', async () => {
      const executeFn = vi.fn().mockRejectedValue(new Error('Tool broke'));
      manager.setToolResolver(createResolver({ 'failing-tool': executeFn }));

      const { task } = await manager.enqueue({
        toolName: 'failing-tool',
        toolCallId: 'call-1',
        args: {},
        agentId: 'agent-1',
      });

      await tick();

      const failed = manager.getTask(task.id);
      expect(failed?.status).toBe('failed');
      expect(failed?.error?.message).toBe('Tool broke');
    });

    it('fails with message when no tool resolver is set', async () => {
      const { task } = await manager.enqueue({
        toolName: 'my-tool',
        toolCallId: 'call-1',
        args: {},
        agentId: 'agent-1',
      });

      await tick();

      const result = manager.getTask(task.id);
      expect(result?.status).toBe('failed');
      expect(result?.error?.message).toBe('No tool resolver configured');
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
      manager.setToolResolver(createResolver({ 'slow-tool': executeFn }));

      // Enqueue 4 tasks across 2 agents (global limit=3, per-agent=2)
      await manager.enqueue({ toolName: 'slow-tool', toolCallId: 'c1', args: {}, agentId: 'a1' });
      await manager.enqueue({ toolName: 'slow-tool', toolCallId: 'c2', args: {}, agentId: 'a1' });
      await manager.enqueue({ toolName: 'slow-tool', toolCallId: 'c3', args: {}, agentId: 'a2' });
      await manager.enqueue({ toolName: 'slow-tool', toolCallId: 'c4', args: {}, agentId: 'a2' });

      await tick();

      // a1 runs 2 (at per-agent limit), a2 runs 1 (global limit = 3 hit), 1 pending
      const running = manager.listTasks({ status: 'running' });
      const pending = manager.listTasks({ status: 'pending' });
      expect(running.length).toBe(3);
      expect(pending.length).toBe(1);

      // Complete one task — the pending one should be dispatched
      resolvers[0]!();
      await tick();

      const runningAfter = manager.listTasks({ status: 'running' });
      const pendingAfter = manager.listTasks({ status: 'pending' });
      const completedAfter = manager.listTasks({ status: 'completed' });
      expect(completedAfter.length).toBe(1);
      expect(runningAfter.length).toBe(3);
      expect(pendingAfter.length).toBe(0);

      // Cleanup
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
      manager.setToolResolver(createResolver({ 'slow-tool': executeFn }));

      await manager.enqueue({ toolName: 'slow-tool', toolCallId: 'c1', args: {}, agentId: 'agent-x' });
      await manager.enqueue({ toolName: 'slow-tool', toolCallId: 'c2', args: {}, agentId: 'agent-x' });
      await manager.enqueue({ toolName: 'slow-tool', toolCallId: 'c3', args: {}, agentId: 'agent-x' });

      await tick();

      const running = manager.listTasks({ status: 'running', agentId: 'agent-x' });
      const pending = manager.listTasks({ status: 'pending', agentId: 'agent-x' });
      expect(running.length).toBe(2);
      expect(pending.length).toBe(1);

      resolvers.forEach(r => r());
    });

    it('backpressure reject throws on limit', async () => {
      // Use a separate pubsub to avoid group round-robin with the beforeEach manager
      const isolatedPubsub = new EventEmitterPubSub();
      const rejectManager = new BackgroundTaskManager({
        globalConcurrency: 1,
        perAgentConcurrency: 1,
        backpressure: 'reject',
      });
      await rejectManager.init(isolatedPubsub);

      let resolver!: () => void;
      const executeFn = vi.fn().mockImplementation(
        () =>
          new Promise<string>(resolve => {
            resolver = () => resolve('done');
          }),
      );
      rejectManager.setToolResolver(createResolver({ tool: executeFn }));

      await rejectManager.enqueue({ toolName: 'tool', toolCallId: 'c1', args: {}, agentId: 'a' });
      await tick();

      await expect(
        rejectManager.enqueue({ toolName: 'tool', toolCallId: 'c2', args: {}, agentId: 'a' }),
      ).rejects.toThrow('Concurrency limit reached');

      resolver();
      await rejectManager.shutdown();
      await isolatedPubsub.close();
    });

    it('backpressure fallback-sync returns signal', async () => {
      const isolatedPubsub = new EventEmitterPubSub();
      const syncManager = new BackgroundTaskManager({
        globalConcurrency: 1,
        perAgentConcurrency: 1,
        backpressure: 'fallback-sync',
      });
      await syncManager.init(isolatedPubsub);

      let resolver!: () => void;
      const executeFn = vi.fn().mockImplementation(
        () =>
          new Promise<string>(resolve => {
            resolver = () => resolve('done');
          }),
      );
      syncManager.setToolResolver(createResolver({ tool: executeFn }));

      await syncManager.enqueue({ toolName: 'tool', toolCallId: 'c1', args: {}, agentId: 'a' });
      await tick();

      const result = await syncManager.enqueue({ toolName: 'tool', toolCallId: 'c2', args: {}, agentId: 'a' });
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
      manager.setToolResolver(createResolver({ 'slow-tool': executeFn }));

      const { task } = await manager.enqueue({
        toolName: 'slow-tool',
        toolCallId: 'call-1',
        args: {},
        agentId: 'agent-1',
        timeoutMs: 100,
      });

      await new Promise(resolve => setTimeout(resolve, 300));

      const result = manager.getTask(task.id);
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
        defaultRetries: { retryDelayMs: 0 },
      });
      await retryManager.init(isolatedPubsub);
      retryManager.setToolResolver(createResolver({ 'flaky-tool': executeFn }));

      const { task } = await retryManager.enqueue({
        toolName: 'flaky-tool',
        toolCallId: 'call-1',
        args: {},
        agentId: 'agent-1',
        maxRetries: 3,
      });

      await tick(200);

      const result = retryManager.getTask(task.id);
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
        defaultRetries: { retryDelayMs: 0 },
      });
      await retryManager.init(isolatedPubsub);
      retryManager.setToolResolver(createResolver({ 'bad-tool': executeFn }));

      const { task } = await retryManager.enqueue({
        toolName: 'bad-tool',
        toolCallId: 'call-1',
        args: {},
        agentId: 'agent-1',
        maxRetries: 2,
      });

      await tick(200);

      const result = retryManager.getTask(task.id);
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
      manager.setToolResolver(createResolver({ tool: executeFn }));

      // Fill per-agent concurrency (limit=2)
      await manager.enqueue({ toolName: 'tool', toolCallId: 'c1', args: {}, agentId: 'a' });
      await manager.enqueue({ toolName: 'tool', toolCallId: 'c2', args: {}, agentId: 'a' });
      // This one should be pending
      const { task } = await manager.enqueue({ toolName: 'tool', toolCallId: 'c3', args: {}, agentId: 'a' });

      await tick();
      expect(manager.getTask(task.id)?.status).toBe('pending');

      await manager.cancel(task.id);
      expect(manager.getTask(task.id)?.status).toBe('cancelled');

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
      manager.setToolResolver(createResolver({ tool: executeFn }));

      const { task } = await manager.enqueue({
        toolName: 'tool',
        toolCallId: 'call-1',
        args: {},
        agentId: 'agent-1',
      });

      await tick();
      expect(manager.getTask(task.id)?.status).toBe('running');

      await manager.cancel(task.id);
      await tick();

      expect(manager.getTask(task.id)?.status).toBe('cancelled');
      expect(capturedSignal.aborted).toBe(true);
    });

    it('is a no-op for completed tasks', async () => {
      const executeFn = vi.fn().mockResolvedValue('done');
      manager.setToolResolver(createResolver({ tool: executeFn }));

      const { task } = await manager.enqueue({
        toolName: 'tool',
        toolCallId: 'call-1',
        args: {},
        agentId: 'agent-1',
      });

      await tick();
      expect(manager.getTask(task.id)?.status).toBe('completed');

      await manager.cancel(task.id);
      expect(manager.getTask(task.id)?.status).toBe('completed');
    });
  });

  describe('listTasks', () => {
    it('filters by status', async () => {
      const executeFn = vi.fn().mockResolvedValue('done');
      manager.setToolResolver(createResolver({ tool: executeFn }));

      await manager.enqueue({ toolName: 'tool', toolCallId: 'c1', args: {}, agentId: 'a1' });
      await tick();

      expect(manager.listTasks({ status: 'completed' }).length).toBe(1);
      expect(manager.listTasks({ status: 'pending' }).length).toBe(0);
    });

    it('filters by agentId', async () => {
      const executeFn = vi.fn().mockResolvedValue('done');
      manager.setToolResolver(createResolver({ tool: executeFn }));

      await manager.enqueue({ toolName: 'tool', toolCallId: 'c1', args: {}, agentId: 'a1' });
      await manager.enqueue({ toolName: 'tool', toolCallId: 'c2', args: {}, agentId: 'a2' });
      await tick();

      const a1Tasks = manager.listTasks({ agentId: 'a1' });
      expect(a1Tasks.length).toBe(1);
      expect(a1Tasks[0]!.agentId).toBe('a1');
    });

    it('supports limit and offset', async () => {
      const executeFn = vi.fn().mockResolvedValue('done');
      manager.setToolResolver(createResolver({ tool: executeFn }));

      for (let i = 0; i < 5; i++) {
        await manager.enqueue({ toolName: 'tool', toolCallId: `c${i}`, args: {}, agentId: 'a1' });
      }
      await tick();

      const page = manager.listTasks({ limit: 2, offset: 1 });
      expect(page.length).toBe(2);
    });
  });

  describe('callbacks', () => {
    it('invokes onTaskComplete callback', async () => {
      const onComplete = vi.fn();
      const isolatedPubsub = new EventEmitterPubSub();
      const mgr = new BackgroundTaskManager({ onTaskComplete: onComplete });
      await mgr.init(isolatedPubsub);
      mgr.setToolResolver(createResolver({ tool: vi.fn().mockResolvedValue('result') }));

      await mgr.enqueue({ toolName: 'tool', toolCallId: 'c1', args: {}, agentId: 'a1' });
      await tick();

      expect(onComplete).toHaveBeenCalledTimes(1);
      expect(onComplete.mock.calls[0]![0].status).toBe('completed');

      await mgr.shutdown();
      await isolatedPubsub.close();
    });

    it('invokes onTaskFailed callback', async () => {
      const onFailed = vi.fn();
      const isolatedPubsub = new EventEmitterPubSub();
      const mgr = new BackgroundTaskManager({ onTaskFailed: onFailed });
      await mgr.init(isolatedPubsub);
      mgr.setToolResolver(createResolver({ tool: vi.fn().mockRejectedValue(new Error('oops')) }));

      await mgr.enqueue({ toolName: 'tool', toolCallId: 'c1', args: {}, agentId: 'a1' });
      await tick();

      expect(onFailed).toHaveBeenCalledTimes(1);
      expect(onFailed.mock.calls[0]![0].status).toBe('failed');

      await mgr.shutdown();
      await isolatedPubsub.close();
    });
  });

  describe('shutdown', () => {
    it('rejects new enqueues after shutdown', async () => {
      manager.setToolResolver(createResolver({ tool: vi.fn().mockResolvedValue('ok') }));
      await manager.shutdown();

      await expect(manager.enqueue({ toolName: 'tool', toolCallId: 'c1', args: {}, agentId: 'a1' })).rejects.toThrow(
        'shutting down',
      );
    });
  });
});
