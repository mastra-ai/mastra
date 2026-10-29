import { describe, it, expect, vi, afterEach } from 'vitest';
import { EventEmitterPubSub } from '../events/event-emitter';
import { Mastra } from '../mastra';
import { MastraCompositeStore, MockStore } from '../storage';
import { BackgroundTasksInMemory } from '../storage/domains/background-tasks/inmemory';
import { InMemoryDB } from '../storage/domains/inmemory-db';
import { BackgroundTaskManager } from './manager';
import type { BackgroundTask, BackgroundTaskManagerConfig, TaskContext, TaskFilter } from './types';

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

// Delivers each event after a delay, like a networked broker, so a published
// event is not handled before `publish()` returns.
class DelayedPubSub extends EventEmitterPubSub {
  override async publish(...args: Parameters<EventEmitterPubSub['publish']>): Promise<void> {
    setTimeout(() => void super.publish(...args), 50);
  }
}

async function makeManager(
  config: Omit<BackgroundTaskManagerConfig, 'enabled'>,
  pubsub: EventEmitterPubSub = new EventEmitterPubSub(),
  mastraStorage: MastraCompositeStore = storage,
) {
  const mastra = new Mastra({ logger: false, storage: mastraStorage });
  await mastra.startWorkers();
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

function foreignRunningRow(id = 'other-worker-task'): BackgroundTask {
  return {
    id,
    status: 'running',
    toolName: 'remote',
    toolCallId: id,
    args: {},
    agentId: 'agent-elsewhere',
    runId: id,
    retryCount: 0,
    maxRetries: 0,
    timeoutMs: 60_000,
    createdAt: new Date(),
    startedAt: new Date(),
  };
}

// Mimics an adapter released before `expiresAt` existed: it inherits
// `supportsTaskExpiry: false`, ignores `hasExpiresAt`, and treats an unknown
// `dateFilterBy` as `createdAt` (what pg/libsql/mysql/mssql/d1/mongodb/spanner
// did on main).
class PreExpiryAdapter extends BackgroundTasksInMemory {
  override readonly supportsTaskExpiry = false;
  readonly deleteFilters: TaskFilter[] = [];

  override async listTasks(filter: TaskFilter) {
    const { hasExpiresAt: _ignored, ...rest } = filter;
    const known = ['startedAt', 'suspendedAt', 'completedAt'];
    return super.listTasks({
      ...rest,
      dateFilterBy: rest.dateFilterBy && known.includes(rest.dateFilterBy) ? rest.dateFilterBy : 'createdAt',
    });
  }

  override async deleteTasks(filter: TaskFilter) {
    this.deleteFilters.push(filter);
    return super.deleteTasks(filter);
  }
}

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
    // Both tests go through a composite store handed to Mastra, the same path
    // the manager uses in an app, so the capability flag must survive it.
    const composite = (backgroundTasks: BackgroundTasksInMemory) =>
      new MastraCompositeStore({ id: 'composite', default: new MockStore(), domains: { backgroundTasks } });

    it('falls back to global-TTL cleanup on an adapter without expiry support', async () => {
      const old = new PreExpiryAdapter({ db: new InMemoryDB() });
      const mgr = await makeManager(
        { cleanup: { completedTtlMs: 1_000, failedTtlMs: 5_000 } },
        undefined,
        composite(old),
      );
      const now = Date.now();
      const ago = (ms: number) => new Date(now - ms);
      const row = (id: string, status: BackgroundTask['status'], at: Date) =>
        old.createTask({ ...foreignRunningRow(id), status, createdAt: at, completedAt: at });
      await row('completed-old', 'completed', ago(2_000));
      await row('completed-fresh', 'completed', ago(0));
      await row('failed-recent', 'failed', ago(2_000));
      await row('failed-old', 'failed', ago(10_000));
      await old.createTask({ ...foreignRunningRow('running-old'), createdAt: ago(60_000) });

      vi.spyOn(Date, 'now').mockReturnValue(now);
      try {
        await mgr.cleanup();
      } finally {
        vi.mocked(Date.now).mockRestore();
      }

      const remaining = (await old.listTasks({})).tasks.map(t => t.id).sort();
      expect(remaining).toEqual(['completed-fresh', 'failed-recent', 'running-old']);
      // Exactly the filters `cleanup()` sends on main.
      expect(old.deleteFilters).toEqual([
        { status: ['completed'], toDate: new Date(now - 1_000), dateFilterBy: 'completedAt' },
        { status: ['failed', 'cancelled', 'timed_out'], toDate: new Date(now - 5_000), dateFilterBy: 'completedAt' },
      ]);
    });

    it('honours expiresAt when the adapter comes from a composite store', async () => {
      const domain = new BackgroundTasksInMemory({ db: new InMemoryDB() });
      const mgr = await makeManager({ cleanup: { completedTtlMs: 1_000 } }, undefined, composite(domain));
      const now = Date.now();
      const old = new Date(now - 60_000);
      await domain.createTask({
        ...foreignRunningRow('kept'),
        status: 'completed',
        completedAt: old,
        expiresAt: new Date(now + 60_000),
      });
      await domain.createTask({
        ...foreignRunningRow('expired'),
        status: 'completed',
        completedAt: new Date(now),
        expiresAt: new Date(now - 1_000),
      });

      await mgr.cleanup();

      expect(await domain.getTask('kept')).not.toBeNull();
      expect(await domain.getTask('expired')).toBeNull();
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
    it('rejects owner limits that are not positive finite numbers', () => {
      for (const bad of [0, -1, Number.NaN, Number.POSITIVE_INFINITY]) {
        expect(
          () => new BackgroundTaskManager({ enabled: true, perOwnerConcurrency: { 'mcp-server:ops': bad } }),
        ).toThrow(/perOwnerConcurrency/);
      }
    });

    it('ignores inherited object keys when looking up an owner limit', async () => {
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
      const [first, second] = await Promise.all(['c1', 'c2'].map(id => mgr.enqueue(payload('constructor', id), slow)));

      await vi.waitFor(async () => expect((await mgr.getTask(first!.task.id))?.status).toBe('running'));
      expect((await mgr.getTask(second!.task.id))?.status).toBe('pending');
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
    it('drops a queued resume once another worker has resumed the task and it suspended again', async () => {
      const a = await makeManager({ globalConcurrency: 1, perAgentConcurrency: 1, leaseDurationMs: 3_000 });
      const b = await makeManager({ globalConcurrency: 10, perAgentConcurrency: 10, leaseDurationMs: 3_000 });
      const executor = {
        execute: async (_args: any, opts?: any) => {
          if (!opts?.resumeData) return opts?.suspend?.({ question: 1 });
          if (opts.resumeData.from === 'b') return opts.suspend?.({ question: 2 });
          return opts.resumeData;
        },
      };
      a.registerStaticExecutor('mcp-server:ops:ask', executor);
      b.registerStaticExecutor('mcp-server:ops:ask', executor);
      const { task } = await a.enqueue({ ...payload('mcp-server:ops', 'ask'), toolName: 'mcp-server:ops:ask' });
      await vi.waitFor(async () => expect((await a.getTask(task.id))?.status).toBe('suspended'));
      const firstSuspension = (await a.getTask(task.id))!.suspendedAt!.getTime();

      const store = (await storage.getStore('backgroundTasks'))!;
      await store.createTask(foreignRunningRow());
      await a.resume(task.id, { from: 'a-stale' }, { onNoSlot: 'queue' });

      await b.resume(task.id, { from: 'b' });
      await vi.waitFor(async () => {
        const t = await b.getTask(task.id);
        expect(t?.status).toBe('suspended');
        expect(t?.suspendedAt?.getTime()).not.toBe(firstSuspension);
      });

      await store.updateTask('other-worker-task', { status: 'completed', completedAt: new Date() });
      // Give a's heartbeat (~1s) a few chances to drain.
      await new Promise(resolve => setTimeout(resolve, 2_500));

      expect(await a.getTask(task.id)).toMatchObject({ status: 'suspended', suspendPayload: { question: 2 } });
    });

    it('frees the slot once another worker has handled a published portable resume', async () => {
      // a's resume events are delivered only to b, so a never sees the resume
      // handled and has to learn it from storage.
      const toB = new EventEmitterPubSub();
      class ResumeGoesToB extends EventEmitterPubSub {
        override async publish(...args: Parameters<EventEmitterPubSub['publish']>): Promise<void> {
          if (args[1].type === 'task.resume') return toB.publish(...args);
          return super.publish(...args);
        }
      }
      const a = await makeManager(
        { globalConcurrency: 1, perAgentConcurrency: 1, backpressure: 'reject', leaseDurationMs: 3_000 },
        new ResumeGoesToB(),
      );
      const b = await makeManager({ globalConcurrency: 10, perAgentConcurrency: 10, leaseDurationMs: 3_000 }, toB);
      const executor = {
        execute: async (_args: any, opts?: any) => opts?.resumeData ?? opts?.suspend?.({ needs: 'input' }),
      };
      a.registerStaticExecutor('mcp-server:ops:ask', executor);
      b.registerStaticExecutor('mcp-server:ops:ask', executor);
      const { task } = await a.enqueue({ ...payload('mcp-server:ops', 'ask'), toolName: 'mcp-server:ops:ask' });
      await vi.waitFor(async () => expect((await a.getTask(task.id))?.status).toBe('suspended'));

      await a.resume(task.id, { answer: 'yes' });
      await vi.waitFor(async () => expect((await a.getTask(task.id))?.status).toBe('completed'));

      // Nothing is running, so the next portable task must get the slot.
      const next = await a.enqueue({ ...payload('mcp-server:ops', 'next'), toolName: 'mcp-server:ops:ask' });
      expect(next.task.status).not.toBe('failed');
    });

    it('does not admit more queued portable resumes than there are free slots', async () => {
      const mgr = await makeManager(
        { globalConcurrency: 1, perAgentConcurrency: 5, leaseDurationMs: 3_000 },
        new DelayedPubSub(),
      );
      const g = gate();
      mgr.registerStaticExecutor('mcp-server:ops:ask', {
        execute: async (_args, opts) => {
          if (!opts?.resumeData) return opts?.suspend?.({ needs: 'input' });
          await g.promise;
          return opts.resumeData;
        },
      });
      const tasks = [];
      for (const id of ['q1', 'q2']) {
        const { task } = await mgr.enqueue({ ...payload('mcp-server:ops', id), toolName: 'mcp-server:ops:ask' });
        await vi.waitFor(async () => expect((await mgr.getTask(task.id))?.status).toBe('suspended'));
        tasks.push(task);
      }

      const store = (await storage.getStore('backgroundTasks'))!;
      await store.createTask(foreignRunningRow());
      for (const task of tasks) await mgr.resume(task.id, { ok: true }, { onNoSlot: 'queue' });
      await store.updateTask('other-worker-task', { status: 'completed', completedAt: new Date() });

      await vi.waitFor(async () => expect((await mgr.listTasks({ status: 'running' })).total).toBe(1), {
        timeout: 4_000,
      });
      await new Promise(resolve => setTimeout(resolve, 2_500));
      expect((await mgr.listTasks({ status: 'running' })).total).toBe(1);
      expect((await mgr.listTasks({ status: 'suspended' })).total).toBe(1);

      g.release();
      await vi.waitFor(
        async () => {
          for (const task of tasks) expect((await mgr.getTask(task.id))?.status).toBe('completed');
        },
        { timeout: 6_000 },
      );
    });
  });

  describe('stale resume events', () => {
    // A resume event answers one suspension. If it is delivered late — after
    // the task was resumed some other way, ran, and suspended again — it must
    // not answer the new suspension with the old data.
    class HoldFirstResume extends EventEmitterPubSub {
      held?: () => Promise<void>;
      override async publish(...args: Parameters<EventEmitterPubSub['publish']>): Promise<void> {
        if (args[1].type === 'task.resume' && !this.held) {
          this.held = () => super.publish(...args);
          return;
        }
        return super.publish(...args);
      }
    }

    const executor = {
      execute: async (_args: any, opts?: any) => {
        if (!opts?.resumeData) return opts?.suspend?.({ question: 1 });
        if (opts.resumeData.answer === 'for question 1') return opts.suspend?.({ question: 2 });
        return opts.resumeData;
      },
    };

    async function suspendedAgainAfterHeldResume(processAffine: boolean) {
      const pubsub = new HoldFirstResume();
      const mgr = await makeManager({ leaseDurationMs: 3_000 }, pubsub);
      let taskId: string;
      if (processAffine) {
        ({
          task: { id: taskId },
        } = await mgr.enqueue(payload('mcp-server:ops', 'ask'), ctx(executor.execute)));
      } else {
        mgr.registerStaticExecutor('mcp-server:ops:ask', executor);
        ({
          task: { id: taskId },
        } = await mgr.enqueue({ ...payload('mcp-server:ops', 'ask'), toolName: 'mcp-server:ops:ask' }));
      }
      await vi.waitFor(async () => expect((await mgr.getTask(taskId))?.status).toBe('suspended'));
      const firstSuspension = (await mgr.getTask(taskId))!.suspendedAt!.getTime();

      // Held by the broker: this answer for question 1 is not delivered yet.
      await mgr.resume(taskId, { answer: 'stale answer for question 1' });
      expect(pubsub.held).toBeDefined();

      await mgr.resume(taskId, { answer: 'for question 1' });
      await vi.waitFor(async () => {
        const t = await mgr.getTask(taskId);
        expect(t?.status).toBe('suspended');
        expect(t?.suspendedAt?.getTime()).not.toBe(firstSuspension);
      });

      await pubsub.held!();
      await new Promise(resolve => setTimeout(resolve, 200));
      return { mgr, taskId };
    }

    it.each([
      ['portable', false],
      ['process-affine', true],
    ])('does not let a late %s resume answer the next suspension', async (_kind, processAffine) => {
      const { mgr, taskId } = await suspendedAgainAfterHeldResume(processAffine);

      expect(await mgr.getTask(taskId)).toMatchObject({ status: 'suspended', suspendPayload: { question: 2 } });

      // The current suspension can still be answered.
      await mgr.resume(taskId, { answer: 'for question 2' });
      await vi.waitFor(async () =>
        expect(await mgr.getTask(taskId)).toMatchObject({
          status: 'completed',
          result: { answer: 'for question 2' },
        }),
      );
    });

    it('rejects the resume when the task suspends again between its read and its claim', async () => {
      // Another worker resumes and re-suspends the row right after this
      // worker's read, so only the storage-level fence can catch it.
      class ResuspendAfterRead extends BackgroundTasksInMemory {
        armed = false;
        override async getTask(id: string) {
          const task = await super.getTask(id);
          if (this.armed && task?.status === 'suspended') {
            this.armed = false;
            await super.updateTask(id, {
              suspendedAt: new Date(task.suspendedAt!.getTime() + 1_000),
              suspendPayload: { question: 2 },
            });
          }
          return task;
        }
      }
      const backgroundTasks = new ResuspendAfterRead({ db: new InMemoryDB() });
      const mgr = await makeManager(
        { leaseDurationMs: 3_000 },
        new DelayedPubSub(),
        new MastraCompositeStore({ id: 'composite', default: new MockStore(), domains: { backgroundTasks } }),
      );
      mgr.registerStaticExecutor('mcp-server:ops:ask', executor);
      const { task } = await mgr.enqueue({ ...payload('mcp-server:ops', 'ask'), toolName: 'mcp-server:ops:ask' });
      await vi.waitFor(async () => expect((await mgr.getTask(task.id))?.status).toBe('suspended'));

      await mgr.resume(task.id, { answer: 'stale answer for question 1' });
      backgroundTasks.armed = true;
      await vi.waitFor(() => expect(backgroundTasks.armed).toBe(false));
      await new Promise(resolve => setTimeout(resolve, 200));

      expect(await mgr.getTask(task.id)).toMatchObject({ status: 'suspended', suspendPayload: { question: 2 } });
    });
  });

  describe('pinToWorker', () => {
    // Two workers on one store and one broker. A holds a single slot, so a
    // pinned task waits in A's local queue: the window in which a peer could
    // otherwise pick the pending row up and run it a second time.
    async function pinnedOnBusyWorker(maxRetries: number, pubsub = new EventEmitterPubSub()) {
      const a = await makeManager({ globalConcurrency: 1, perAgentConcurrency: 1, leaseDurationMs: 3_000 }, pubsub);
      const busy = gate();
      const { task: blocker } = await a.enqueue(
        payload('mcp-server:ops', 'blocker'),
        ctx(async () => {
          await busy.promise;
          return 'blocker';
        }),
      );
      await vi.waitFor(async () => expect((await a.getTask(blocker.id))?.status).toBe('running'));

      const onA = vi.fn(async () => 'from-a');
      const { task } = await a.enqueue(payload('mcp-server:ops', 'pinned', { maxRetries }), ctx(onA), {
        pinToWorker: true,
      });
      return { pubsub, a, busy, onA, task };
    }

    async function peer(pubsub: EventEmitterPubSub) {
      const b = await makeManager(
        { globalConcurrency: 10, perAgentConcurrency: 10, leaseDurationMs: 3_000, recoverStaleTasksOnStart: true },
        pubsub,
      );
      const onB = vi.fn(async () => 'from-b');
      b.registerStaticExecutor('tool', { execute: onB });
      return { b, onB };
    }

    // Takes A off the broker and stops its lease heartbeat without a graceful
    // shutdown, like a crashed process.
    async function crash(mgr: BackgroundTaskManager, pubsub: EventEmitterPubSub) {
      const internals = mgr as any;
      clearInterval(internals.heartbeatInterval);
      await pubsub.unsubscribe('background-tasks', internals.workerCallback);
      await pubsub.unsubscribe(internals.processAffineDispatchTopic, internals.workerCallback);
    }

    it('keeps a queued pinned row away from other workers until its owner runs it', async () => {
      const { pubsub, a, busy, onA, task } = await pinnedOnBusyWorker(1);
      expect(await a.getTask(task.id)).toMatchObject({ status: 'pending', ownerId: a.ownerId });

      // B starts up and recovers stale tasks, then is also handed a dispatch
      // for the row, as if it arrived on the shared topic.
      const { b, onB } = await peer(pubsub);
      await expect(
        (b as any).handleDispatch({ type: 'task.dispatch', data: { taskId: task.id }, runId: task.id }),
      ).resolves.toBe(true);

      // Outlive the original lease: A's heartbeat keeps the pin alive, so B's
      // rescheduled recovery pass still leaves the row alone.
      await new Promise(resolve => setTimeout(resolve, 4_000));
      expect(onB).not.toHaveBeenCalled();
      const waiting = await b.getTask(task.id);
      expect(waiting).toMatchObject({ status: 'pending', ownerId: a.ownerId });
      expect(waiting!.leaseExpiresAt!.getTime()).toBeGreaterThan(Date.now());

      busy.release();
      await vi.waitFor(async () => expect(await a.getTask(task.id)).toMatchObject({ status: 'completed' }), {
        timeout: 3_000,
      });
      expect((await a.getTask(task.id))?.result).toBe('from-a');
      expect(onA).toHaveBeenCalledTimes(1);
      expect(onB).not.toHaveBeenCalled();
    }, 15_000);

    it('recovers a pinned row as a lost attempt once its owner dies, running it once on a peer', async () => {
      const { pubsub, a, busy, onA, task } = await pinnedOnBusyWorker(1);
      await crash(a, pubsub);
      const { b, onB } = await peer(pubsub);

      await vi.waitFor(async () => expect(await b.getTask(task.id)).toMatchObject({ status: 'completed' }), {
        timeout: 8_000,
        interval: 100,
      });
      const done = await b.getTask(task.id);
      expect(done).toMatchObject({ result: 'from-b', retryCount: 1 });
      expect(done!.ownerId).toBeUndefined();
      expect(onB).toHaveBeenCalledTimes(1);
      expect(onA).not.toHaveBeenCalled();
      busy.release();
    }, 15_000);

    it('fails a pinned row with no retries once its owner dies, without running it on a peer', async () => {
      const { pubsub, a, busy, onA, task } = await pinnedOnBusyWorker(0);
      await crash(a, pubsub);
      const { b, onB } = await peer(pubsub);

      await vi.waitFor(async () => expect((await b.getTask(task.id))?.status).toBe('failed'), {
        timeout: 8_000,
        interval: 100,
      });
      const failed = await b.getTask(task.id);
      expect(failed?.error?.message).toBe('Worker process terminated before task completed');
      expect(failed!.ownerId).toBeUndefined();
      expect(failed!.leaseExpiresAt).toBeUndefined();
      // Give any stray dispatch a chance to run.
      await new Promise(resolve => setTimeout(resolve, 300));
      expect(onB).not.toHaveBeenCalled();
      expect(onA).not.toHaveBeenCalled();
      busy.release();
    }, 15_000);

    it('recovers a lapsed pin on a peer that was already running before the row was enqueued', async () => {
      // B's startup recovery pass finds nothing, so only a later sweep can see A's pin lapse.
      const pubsub = new EventEmitterPubSub();
      const { b, onB } = await peer(pubsub);
      const { a, busy, onA, task } = await pinnedOnBusyWorker(1, pubsub);
      await crash(a, pubsub);

      await vi.waitFor(async () => expect(await b.getTask(task.id)).toMatchObject({ status: 'completed' }), {
        timeout: 10_000,
        interval: 100,
      });
      expect(await b.getTask(task.id)).toMatchObject({ result: 'from-b', retryCount: 1 });
      expect(onB).toHaveBeenCalledTimes(1);
      expect(onA).not.toHaveBeenCalled();
      busy.release();
    }, 15_000);

    it('reaches a lapsed pin behind a page of older pending rows on a later sweep', async () => {
      const pubsub = new EventEmitterPubSub();
      const { b, onB } = await peer(pubsub);
      const store = (await storage.getStore('backgroundTasks'))!;
      const old = Date.now() - 60_000;
      for (let i = 0; i < 100; i++) {
        await store.createTask({
          ...foreignRunningRow(`queued-${i}`),
          status: 'pending',
          createdAt: new Date(old + i),
        });
      }
      await store.createTask({
        ...foreignRunningRow('lapsed-pin'),
        status: 'pending',
        toolName: 'tool',
        agentId: 'mcp-server:ops',
        maxRetries: 1,
        ownerId: 'dead-worker',
        leaseExpiresAt: new Date(Date.now() - 1_000),
        createdAt: new Date(),
      });

      await vi.waitFor(async () => expect(await b.getTask('lapsed-pin')).toMatchObject({ status: 'completed' }), {
        timeout: 12_000,
        interval: 100,
      });
      expect(onB).toHaveBeenCalledTimes(1);
    }, 15_000);

    it('keeps a lapsed pin pinned until a slot is free, so its retry is not spent without a dispatch', async () => {
      const pubsub = new EventEmitterPubSub();
      const b = await makeManager(
        { globalConcurrency: 1, perAgentConcurrency: 1, leaseDurationMs: 3_000, recoverStaleTasksOnStart: true },
        pubsub,
      );
      const onB = vi.fn(async () => 'from-b');
      b.registerStaticExecutor('tool', { execute: onB });
      const busy = gate();
      const { task: blocker } = await b.enqueue(
        payload('mcp-server:ops', 'blocker'),
        ctx(async () => {
          await busy.promise;
          return 'blocker';
        }),
      );
      await vi.waitFor(async () => expect((await b.getTask(blocker.id))?.status).toBe('running'));
      const store = (await storage.getStore('backgroundTasks'))!;
      await store.createTask({
        ...foreignRunningRow('lapsed-pin'),
        status: 'pending',
        toolName: 'tool',
        agentId: 'mcp-server:ops',
        maxRetries: 1,
        ownerId: 'dead-worker',
        leaseExpiresAt: new Date(Date.now() - 1_000),
        createdAt: new Date(),
      });

      // Two sweeps run while B has no free slot.
      await new Promise(resolve => setTimeout(resolve, 6_500));
      expect(await b.getTask('lapsed-pin')).toMatchObject({ status: 'pending', ownerId: 'dead-worker', retryCount: 0 });

      busy.release();
      await vi.waitFor(async () => expect(await b.getTask('lapsed-pin')).toMatchObject({ status: 'completed' }), {
        timeout: 5_000,
        interval: 100,
      });
      expect(await b.getTask('lapsed-pin')).toMatchObject({ result: 'from-b', retryCount: 1 });
    }, 20_000);

    it('retries the dispatch of a recovered pin when publishing it fails', async () => {
      let failNextDispatch = false;
      class FlakyPubSub extends EventEmitterPubSub {
        override async publish(...args: Parameters<EventEmitterPubSub['publish']>): Promise<void> {
          if (failNextDispatch && (args[1] as { type?: string })?.type === 'task.dispatch') {
            failNextDispatch = false;
            throw new Error('broker unavailable');
          }
          return super.publish(...args);
        }
      }
      const { b, onB } = await peer(new FlakyPubSub());
      const store = (await storage.getStore('backgroundTasks'))!;
      failNextDispatch = true;
      await store.createTask({
        ...foreignRunningRow('lapsed-pin'),
        status: 'pending',
        toolName: 'tool',
        agentId: 'mcp-server:ops',
        maxRetries: 1,
        ownerId: 'dead-worker',
        leaseExpiresAt: new Date(Date.now() - 1_000),
        createdAt: new Date(),
      });

      await vi.waitFor(async () => expect(await b.getTask('lapsed-pin')).toMatchObject({ status: 'completed' }), {
        timeout: 12_000,
        interval: 100,
      });
      expect(failNextDispatch).toBe(false);
      expect(await b.getTask('lapsed-pin')).toMatchObject({ result: 'from-b', retryCount: 1 });
      expect(onB).toHaveBeenCalledTimes(1);
    }, 15_000);

    it('hands a pinned row to peers as a lost attempt on graceful shutdown', async () => {
      const { pubsub, a, busy, onA, task } = await pinnedOnBusyWorker(0);
      // `shutdown()` stops dispatch synchronously, so the freed slot never runs the pinned row.
      busy.release();
      await a.shutdown();
      const { b, onB } = await peer(pubsub);

      await vi.waitFor(async () => expect((await b.getTask(task.id))?.status).toBe('failed'), { timeout: 2_000 });
      expect(onB).not.toHaveBeenCalled();
      expect(onA).not.toHaveBeenCalled();
    });

    it('releases the pin when the owner claims a row it can run immediately', async () => {
      const mgr = await makeManager({ globalConcurrency: 1, perAgentConcurrency: 1, leaseDurationMs: 3_000 });
      const { task } = await mgr.enqueue(
        payload('mcp-server:ops', 'free'),
        ctx(async () => 'done'),
        { pinToWorker: true },
      );
      await vi.waitFor(async () => expect(await mgr.getTask(task.id)).toMatchObject({ status: 'completed' }));
      const done = await mgr.getTask(task.id);
      expect(done).toMatchObject({ result: 'done', retryCount: 0 });
      expect(done!.ownerId).toBeUndefined();
    });

    it('leaves rows unpinned by default, even with a task context', async () => {
      const mgr = await makeManager({ globalConcurrency: 1, perAgentConcurrency: 1 });
      const busy = gate();
      await mgr.enqueue(
        payload('agent-1', 'blocker'),
        ctx(async () => {
          await busy.promise;
          return 'blocker';
        }),
      );
      const { task } = await mgr.enqueue(
        payload('agent-1', 'queued'),
        ctx(async () => 'queued'),
      );
      const stored = await mgr.getTask(task.id);
      expect(stored?.status).toBe('pending');
      expect(stored?.ownerId).toBeUndefined();
      expect(stored?.leaseExpiresAt).toBeUndefined();
      busy.release();
    });

    it('rejects pinToWorker without a task context', async () => {
      const mgr = await makeManager({});
      await expect(
        mgr.enqueue(payload('mcp-server:ops', 'portable'), undefined, { pinToWorker: true }),
      ).rejects.toThrow('pinToWorker requires a task context');
      expect((await mgr.listTasks({})).total).toBe(0);
    });
  });
});
