import { describe, it, expect, vi, afterEach } from 'vitest';
import { EventEmitterPubSub } from '../events/event-emitter';
import { Mastra } from '../mastra';
import { MockStore } from '../storage';
import { BackgroundTaskManager } from './manager';
import type { BackgroundTaskManagerConfig, TaskContext } from './types';

// Background tasks owned by something other than an agent (for example an MCP
// server, with `agentId: 'mcp-server:<id>'`) need their own retention, their
// own concurrency budget, and a resume that can wait for a slot.

const storage = new MockStore();
const cleanups: Array<() => Promise<void>> = [];

function ctx(execute: (args: any, opts?: any) => Promise<any>): TaskContext {
  return { executor: { execute } };
}

function gate() {
  let release!: () => void;
  const promise = new Promise<void>(resolve => {
    release = resolve;
  });
  return { promise, release };
}

async function makeManager(config: Omit<BackgroundTaskManagerConfig, 'enabled'>) {
  const mastra = new Mastra({ logger: false, storage });
  await mastra.startWorkers();
  const pubsub = new EventEmitterPubSub();
  const mgr = new BackgroundTaskManager({ enabled: true, recoverStaleTasksOnStart: false, ...config });
  mgr.__registerMastra(mastra);
  await mgr.init(pubsub);
  cleanups.push(async () => {
    await mgr.shutdown();
    await pubsub.close();
    await mastra.stopWorkers();
  });
  return mgr;
}

afterEach(async () => {
  for (const cleanup of cleanups.splice(0)) await cleanup();
  const store = await storage.getStore('backgroundTasks');
  await store?.dangerouslyClearAll();
});

const payload = (agentId: string, toolCallId: string, extra: Record<string, unknown> = {}) => ({
  toolName: 'tool',
  toolCallId,
  args: {},
  agentId,
  runId: `run-${toolCallId}`,
  ...extra,
});

describe('BackgroundTaskManager: non-agent owners', () => {
  describe('cleanup honours per-row expiresAt', () => {
    it('keeps a completed result until its own expiresAt even after the global TTL has passed', async () => {
      const mgr = await makeManager({ cleanup: { completedTtlMs: 10 } });
      const { task } = await mgr.enqueue(
        payload('mcp-server:ops', 'keep', {
          expiresAt: new Date(Date.now() + 60_000),
          metadata: { ttlMs: 60_000, resumeSchema: { type: 'object' } },
        }),
        ctx(async () => 'result'),
      );
      await vi.waitFor(async () => expect((await mgr.getTask(task.id))?.status).toBe('completed'));
      await new Promise(resolve => setTimeout(resolve, 30));

      await mgr.cleanup();

      expect(await mgr.getTask(task.id)).toMatchObject({
        status: 'completed',
        result: 'result',
        metadata: { ttlMs: 60_000, resumeSchema: { type: 'object' } },
      });
    });

    it('deletes a terminal row once its expiresAt passes, even inside the global TTL', async () => {
      const mgr = await makeManager({ cleanup: { completedTtlMs: 60_000, failedTtlMs: 60_000 } });
      const expiresAt = new Date(Date.now() + 100);
      const { task: done } = await mgr.enqueue(
        payload('mcp-server:ops', 'done', { expiresAt }),
        ctx(async () => 'ok'),
      );
      const { task: failed } = await mgr.enqueue(
        payload('mcp-server:ops', 'failed', { expiresAt }),
        ctx(async () => {
          throw new Error('boom');
        }),
      );
      const { task: agentTask } = await mgr.enqueue(
        payload('agent-a', 'agent'),
        ctx(async () => 'ok'),
      );
      await vi.waitFor(async () => {
        expect((await mgr.getTask(done.id))?.status).toBe('completed');
        expect((await mgr.getTask(failed.id))?.status).toBe('failed');
        expect((await mgr.getTask(agentTask.id))?.status).toBe('completed');
      });
      await new Promise(resolve => setTimeout(resolve, 150));

      await mgr.cleanup();

      expect(await mgr.getTask(done.id)).toBeNull();
      expect(await mgr.getTask(failed.id)).toBeNull();
      // Rows without expiresAt still follow the global TTL.
      expect((await mgr.getTask(agentTask.id))?.status).toBe('completed');
    });

    it('never deletes a suspended row whose expiresAt has passed', async () => {
      const mgr = await makeManager({ cleanup: { completedTtlMs: 10, failedTtlMs: 10 } });
      const { task } = await mgr.enqueue(
        payload('mcp-server:ops', 'waiting', { expiresAt: new Date(Date.now() + 20) }),
        ctx(async (_args, opts) => opts.suspend({ needs: 'input' })),
      );
      await vi.waitFor(async () => expect((await mgr.getTask(task.id))?.status).toBe('suspended'));
      await new Promise(resolve => setTimeout(resolve, 50));

      await mgr.cleanup();

      expect((await mgr.getTask(task.id))?.status).toBe('suspended');
    });
  });

  describe('perOwnerConcurrency', () => {
    it('lets an owner run beyond perAgentConcurrency while agents keep their limit (in-process executors)', async () => {
      const mgr = await makeManager({
        globalConcurrency: 10,
        perAgentConcurrency: 1,
        perOwnerConcurrency: { 'mcp-server:ops': 3 },
      });
      const g = gate();
      const slow = ctx(async () => {
        await g.promise;
        return 'ok';
      });
      const owner = await Promise.all(['o1', 'o2', 'o3'].map(id => mgr.enqueue(payload('mcp-server:ops', id), slow)));
      const agent = await Promise.all(['a1', 'a2'].map(id => mgr.enqueue(payload('agent-a', id), slow)));

      await vi.waitFor(async () => {
        for (const { task } of owner) expect((await mgr.getTask(task.id))?.status).toBe('running');
        expect((await mgr.getTask(agent[0]!.task.id))?.status).toBe('running');
      });
      expect((await mgr.getTask(agent[1]!.task.id))?.status).toBe('pending');
      g.release();
    });

    it('applies the owner limit to portable tasks run by a static executor', async () => {
      const mgr = await makeManager({
        globalConcurrency: 10,
        perAgentConcurrency: 1,
        perOwnerConcurrency: { 'mcp-server:ops': 3 },
      });
      const g = gate();
      mgr.registerStaticExecutor('mcp-server:ops:slow', {
        execute: async () => {
          await g.promise;
          return 'ok';
        },
      });
      const tasks = [];
      for (const id of ['p1', 'p2', 'p3', 'p4']) {
        const { task } = await mgr.enqueue({ ...payload('mcp-server:ops', id), toolName: 'mcp-server:ops:slow' });
        tasks.push(task);
        // Storage-wide admission counts `running` rows; let each one start first.
        if (id !== 'p4') await vi.waitFor(async () => expect((await mgr.getTask(task.id))?.status).toBe('running'));
      }

      expect((await mgr.getTask(tasks[3]!.id))?.status).toBe('pending');
      g.release();
      await vi.waitFor(async () => {
        for (const task of tasks) expect((await mgr.getTask(task.id))?.status).toBe('completed');
      });
    });

    it('still counts owner tasks toward globalConcurrency', async () => {
      const mgr = await makeManager({
        globalConcurrency: 2,
        perAgentConcurrency: 1,
        perOwnerConcurrency: { 'mcp-server:ops': 5 },
      });
      const g = gate();
      const slow = ctx(async () => {
        await g.promise;
        return 'ok';
      });
      const results = await Promise.all(['o1', 'o2', 'o3'].map(id => mgr.enqueue(payload('mcp-server:ops', id), slow)));

      await vi.waitFor(async () => expect((await mgr.listTasks({ status: 'running' })).total).toBe(2));
      expect((await mgr.getTask(results[2]!.task.id))?.status).toBe('pending');
      g.release();
    });
  });

  describe("resume with onNoSlot: 'queue'", () => {
    async function suspendedBehindBusySlot() {
      const mgr = await makeManager({ globalConcurrency: 1, perAgentConcurrency: 1 });
      const order: string[] = [];
      const suspendable = vi.fn(async (_args: any, opts: any) => {
        if (!opts.resumeData) return opts.suspend({ needs: 'input' });
        order.push('resumed');
        return opts.resumeData;
      });
      const { task: suspended } = await mgr.enqueue(payload('mcp-server:ops', 'suspend'), ctx(suspendable));
      await vi.waitFor(async () => expect((await mgr.getTask(suspended.id))?.status).toBe('suspended'));

      const busy = gate();
      const { task: blocker } = await mgr.enqueue(
        payload('mcp-server:ops', 'blocker'),
        ctx(async () => {
          await busy.promise;
          return 'blocker';
        }),
      );
      await vi.waitFor(async () => expect((await mgr.getTask(blocker.id))?.status).toBe('running'));

      const { task: fresh } = await mgr.enqueue(
        payload('mcp-server:ops', 'fresh'),
        ctx(async () => {
          order.push('fresh');
          return 'fresh';
        }),
      );
      expect((await mgr.getTask(fresh.id))?.status).toBe('pending');
      return { mgr, suspended, fresh, busy, order, suspendable };
    }

    it('waits for a slot instead of throwing and resumes before newer pending work', async () => {
      const { mgr, suspended, fresh, busy, order } = await suspendedBehindBusySlot();

      const returned = await mgr.resume(suspended.id, { answer: 42 }, { onNoSlot: 'queue' });
      expect(returned.status).toBe('suspended');
      expect((await mgr.getTask(suspended.id))?.status).toBe('suspended');

      busy.release();
      await vi.waitFor(async () => {
        expect(await mgr.getTask(suspended.id)).toMatchObject({ status: 'completed', result: { answer: 42 } });
        expect((await mgr.getTask(fresh.id))?.status).toBe('completed');
      });
      expect(order).toEqual(['resumed', 'fresh']);
    });

    it('drops a queued resume when the task is cancelled', async () => {
      const { mgr, suspended, fresh, busy, suspendable } = await suspendedBehindBusySlot();

      await mgr.resume(suspended.id, { answer: 42 }, { onNoSlot: 'queue' });
      await mgr.cancel(suspended.id);
      busy.release();

      await vi.waitFor(async () => expect((await mgr.getTask(fresh.id))?.status).toBe('completed'));
      expect((await mgr.getTask(suspended.id))?.status).toBe('cancelled');
      expect(suspendable).toHaveBeenCalledTimes(1);
    });

    it('still throws by default when no slot is free', async () => {
      const { mgr, suspended, busy } = await suspendedBehindBusySlot();

      await expect(mgr.resume(suspended.id, { answer: 42 })).rejects.toThrow('Concurrency limit reached');
      expect((await mgr.getTask(suspended.id))?.status).toBe('suspended');
      busy.release();
    });

    it('dispatches a queued portable resume when another worker frees the slot', async () => {
      // Portable tasks are admitted on storage-wide running counts. A slot freed
      // by another process sends no local completion event, so the queued
      // resume has to be retried on a timer (the lease heartbeat, ~1s here).
      const mgr = await makeManager({ globalConcurrency: 1, perAgentConcurrency: 1, leaseDurationMs: 3_000 });
      mgr.registerStaticExecutor('mcp-server:ops:ask', {
        execute: async (_args, opts) => {
          if (!opts?.resumeData) return opts?.suspend?.({ needs: 'input' });
          return opts.resumeData;
        },
      });
      const { task } = await mgr.enqueue({ ...payload('mcp-server:ops', 'ask'), toolName: 'mcp-server:ops:ask' });
      await vi.waitFor(async () => expect((await mgr.getTask(task.id))?.status).toBe('suspended'));

      const store = (await storage.getStore('backgroundTasks'))!;
      await store.createTask({
        id: 'other-worker-task',
        status: 'running',
        toolName: 'remote',
        toolCallId: 'remote',
        args: {},
        agentId: 'agent-elsewhere',
        runId: 'remote',
        retryCount: 0,
        maxRetries: 0,
        timeoutMs: 60_000,
        createdAt: new Date(),
        startedAt: new Date(),
      });

      await mgr.resume(task.id, { answer: 'yes' }, { onNoSlot: 'queue' });
      expect((await mgr.getTask(task.id))?.status).toBe('suspended');

      await store.updateTask('other-worker-task', { status: 'completed', completedAt: new Date() });

      await vi.waitFor(
        async () =>
          expect(await mgr.getTask(task.id)).toMatchObject({ status: 'completed', result: { answer: 'yes' } }),
        { timeout: 4_000, interval: 100 },
      );
    });
  });
});
