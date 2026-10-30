import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { BackgroundTask } from '@mastra/core/background-tasks';
import { Mastra } from '@mastra/core/mastra';
import { InMemoryStore } from '@mastra/core/storage';
import { LibSQLStore } from '@mastra/libsql';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { taskKeyOf } from '../../shared/tasks';
import { BackgroundTaskMCPTaskStore, projectTask, TASK_EXPIRED_MESSAGE, TASK_LOST_MESSAGE } from './background-store';
import type { BackgroundTaskEnvelope } from './background-store';
import type { MCPTaskAttempt, MCPTaskWork } from './store';

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const envelope: BackgroundTaskEnvelope = {
  v: 1,
  principalKey: 'alice-key',
  ttlMs: 60_000,
  recover: false,
  usedInputKeys: [],
};

function row(overrides: Partial<BackgroundTask>): BackgroundTask {
  return {
    id: 'row',
    status: 'running',
    toolName: 'tool',
    toolCallId: 'key',
    args: {},
    agentId: 'mcp-server:s',
    runId: 'key',
    createdAt: new Date(1_000),
    retryCount: 0,
    maxRetries: 0,
    timeoutMs: 60_000,
    expiresAt: new Date(61_000),
    ...overrides,
  };
}

describe('projectTask', () => {
  it('reports a task still running past its TTL as failed before the sweep reaches it', () => {
    expect(projectTask(row({ status: 'running' }), envelope, 't', 61_000)).toMatchObject({
      status: 'failed',
      error: { code: -32603, message: TASK_EXPIRED_MESSAGE },
    });
    expect(projectTask(row({ status: 'running' }), envelope, 't', 60_999).status).toBe('working');
  });

  it('reports an attempt lost with a crashed server as task lost', () => {
    const lost = row({ status: 'failed', error: { message: 'Worker process terminated before task completed' } });
    expect(projectTask(lost, envelope, 't', 2_000)).toMatchObject({
      status: 'failed',
      error: { message: TASK_LOST_MESSAGE },
    });
  });

  it('shows only unanswered input requests, and working once all are answered', () => {
    const asking: BackgroundTaskEnvelope = {
      ...envelope,
      inputRequests: { a: { method: 'elicitation/create' }, b: { method: 'elicitation/create' } },
      inputResponses: { a: { action: 'accept' } },
    };
    expect(projectTask(row({ status: 'suspended' }), asking, 't', 2_000)).toMatchObject({
      status: 'input_required',
      inputRequests: { b: { method: 'elicitation/create' } },
    });
    const answered = { ...asking, inputResponses: { a: { action: 'accept' }, b: { action: 'accept' } } };
    expect(projectTask(row({ status: 'suspended' }), answered, 't', 2_000)).toMatchObject({ status: 'working' });
    expect(projectTask(row({ status: 'suspended' }), answered, 't', 2_000)).not.toHaveProperty('inputRequests');
  });

  it('dates lastUpdatedAt from the latest change to the row', () => {
    const done = row({ status: 'completed', startedAt: new Date(2_000), completedAt: new Date(5_000), result: {} });
    expect(projectTask(done, envelope, 't', 6_000)).toMatchObject({
      createdAt: new Date(1_000).toISOString(),
      lastUpdatedAt: new Date(5_000).toISOString(),
    });
  });
});

describe('BackgroundTaskMCPTaskStore', () => {
  let mastra: Mastra | undefined;
  afterEach(async () => {
    await mastra?.shutdown();
    mastra = undefined;
  });

  it('fails a task whose work asks for an input key it already used, without asking again', async () => {
    mastra = new Mastra({ logger: false, storage: new InMemoryStore(), backgroundTasks: { enabled: true } });
    const store = new BackgroundTaskMCPTaskStore({
      manager: mastra.backgroundTaskManager!,
      serverId: 's',
      workFor: () => work,
      recoverFor: () => false,
    });
    const work: MCPTaskWork = async () => ({
      status: 'input_required',
      inputRequests: { same: { method: 'elicitation/create', params: {} } },
    });
    const access = { principal: 'alice' };
    const task = await store.create({ ttlMs: 60_000, principal: 'alice', context: { toolName: 'tool' } });
    store.run(task.taskId, work);

    let current = await store.get(task.taskId, access);
    for (let i = 0; i < 100 && current?.status !== 'input_required'; i++) {
      await sleep(20);
      current = await store.get(task.taskId, access);
    }
    expect(current).toMatchObject({ status: 'input_required', inputRequests: { same: {} } });

    expect(await store.update(task.taskId, { same: { action: 'accept', content: {} } }, access)).toBe(true);
    for (let i = 0; i < 100 && current?.status !== 'failed'; i++) {
      await sleep(20);
      current = await store.get(task.taskId, access);
    }
    expect(current).toMatchObject({
      status: 'failed',
      error: { message: 'Input request key "same" was already used by this task' },
    });
    store.close();
  });

  async function setup(work: MCPTaskWork, recover = false, backgroundTasks: Record<string, unknown> = {}) {
    mastra = new Mastra({
      logger: false,
      storage: new InMemoryStore(),
      backgroundTasks: { enabled: true, ...backgroundTasks },
    });
    const manager = mastra.backgroundTaskManager!;
    const store = new BackgroundTaskMCPTaskStore({
      manager,
      serverId: 's',
      workFor: () => work,
      recoverFor: () => recover,
    });
    store.registerTool('tool');
    return { manager, store, storage: await manager.getStorage() };
  }

  it('lists a full page of tasks when newer rows are not readable as tasks', async () => {
    const work: MCPTaskWork = async () => ({
      status: 'input_required',
      inputRequests: { who: { method: 'elicitation/create', params: {} } },
    });
    const { store, storage, manager } = await setup(work);
    const keys: string[] = [];
    for (let i = 0; i < 4; i++) {
      const task = await store.create({ ttlMs: 60_000, principal: 'alice', context: { toolName: 'tool' } });
      keys.push(taskKeyOf(task.taskId));
      await new Promise(resolve => setTimeout(resolve, 5));
    }
    // The two newest rows lose their envelope, like rows written before the principal was hashed.
    const { tasks: rows } = await manager.listTasks({ agentId: 'mcp-server:s' });
    for (const row of rows.filter(row => row.toolCallId === keys[2] || row.toolCallId === keys[3])) {
      const { principalKey: _dropped, ...metadata } = row.metadata as Record<string, unknown>;
      await storage.updateTask(row.id, { metadata });
    }

    const { listings: listed } = await store.list({ limit: 2 });

    expect(listed.map(listing => listing.taskKey)).toEqual([keys[1], keys[0]]);
    store.close();
  });

  describe('listing by status', () => {
    const hang: MCPTaskWork = ({ signal }) =>
      new Promise((_, reject) => signal.addEventListener('abort', () => reject(signal.reason)));

    async function rowsOf(manager: Awaited<ReturnType<typeof setup>>['manager']) {
      return (await manager.listTasks({ agentId: 'mcp-server:s' })).tasks;
    }

    it('reads only rows that can have the status, not every row on the server', async () => {
      const { store, storage, manager } = await setup(hang);
      for (let i = 0; i < 12; i++) {
        await store.create({ ttlMs: 60_000, principal: 'alice', context: { toolName: 'tool' } });
      }
      for (const row of await rowsOf(manager)) await storage.updateTask(row.id, { status: 'completed' });
      const listTasks = vi.spyOn(manager, 'listTasks');

      const { listings } = await store.list({ status: 'cancelled', limit: 2 });

      expect(listings).toEqual([]);
      // Pages of the listing itself (limit + 1 rows each), not the sweep's.
      const pages = listTasks.mock.calls.filter(([query]) => query?.perPage === 3);
      expect(pages).toHaveLength(1);
      expect(pages[0]![0]).toMatchObject({ status: ['cancelled'] });
      store.close();
    });

    it('still lists an expired running row as failed, and an answered suspended row as working', async () => {
      const { store, storage, manager } = await setup(hang);
      const expired = await store.create({ ttlMs: 60_000, principal: 'alice', context: { toolName: 'tool' } });
      const answered = await store.create({ ttlMs: 60_000, principal: 'alice', context: { toolName: 'tool' } });
      for (const row of await rowsOf(manager)) {
        if (row.toolCallId === taskKeyOf(expired.taskId)) {
          await storage.updateTask(row.id, { status: 'running', expiresAt: new Date(Date.now() - 1_000) });
        } else {
          const metadata = {
            ...(row.metadata as Record<string, unknown>),
            inputRequests: { who: { method: 'elicitation/create' } },
            inputResponses: { who: { action: 'accept' } },
          };
          await storage.updateTask(row.id, { status: 'suspended', metadata });
        }
      }

      const failed = await store.list({ status: 'failed' });
      expect(failed.listings.map(listing => listing.taskKey)).toEqual([taskKeyOf(expired.taskId)]);
      const working = await store.list({ status: 'working' });
      expect(working.listings.map(listing => listing.taskKey)).toEqual([taskKeyOf(answered.taskId)]);
      store.close();
    });
  });

  it("gives a task's trace only to its caller, and each attempt its number", async () => {
    const attempts: MCPTaskAttempt[] = [];
    const work: MCPTaskWork = async attempt => {
      attempts.push(attempt);
      return attempts.length === 1
        ? { status: 'input_required', inputRequests: { who: { method: 'elicitation/create', params: {} } } }
        : { status: 'completed', result: { content: [] } };
    };
    const { store } = await setup(work);
    const trace = { traceId: 't'.repeat(32), spanId: 's'.repeat(16) };
    const task = await store.create({ ttlMs: 60_000, principal: 'alice', context: { toolName: 'tool' }, trace });
    store.run(task.taskId, work);
    expect(await store.traceOf(task.taskId, { principal: 'alice' })).toEqual(trace);
    expect(await store.traceOf(task.taskId, { principal: 'bob' })).toBeUndefined();
    expect(await store.traceOf('unknown', { principal: 'alice' })).toBeUndefined();

    await until(
      () => store.get(task.taskId, { principal: 'alice' }),
      t => t?.status === 'input_required',
    );
    await store.update(task.taskId, { who: { action: 'accept', content: {} } }, { principal: 'alice' });
    await until(
      () => store.get(task.taskId, { principal: 'alice' }),
      t => t?.status === 'completed',
    );
    expect(attempts.map(attempt => attempt.trace)).toEqual([
      { ...trace, taskKey: taskKeyOf(task.taskId), attempt: 1, resumed: false, recovered: false },
      { ...trace, taskKey: taskKeyOf(task.taskId), attempt: 2, resumed: true, recovered: false },
    ]);
  });

  it('does not acknowledge an answer that storage would not store', async () => {
    const work: MCPTaskWork = async () => ({
      status: 'input_required',
      inputRequests: { who: { method: 'elicitation/create', params: {} } },
    });
    const { store, storage } = await setup(work);
    const access = { principal: 'alice' };
    const task = await store.create({ ttlMs: 60_000, principal: 'alice', context: { toolName: 'tool' } });
    store.run(task.taskId, work);
    await until(
      () => store.get(task.taskId, access),
      t => t?.status === 'input_required',
    );
    // Every metadata write is refused, as a storage that keeps failing would.
    const update = storage.updateTask.bind(storage);
    vi.spyOn(storage, 'updateTask').mockImplementation((id, change, options) =>
      'metadata' in change ? Promise.resolve(false) : update(id, change, options),
    );

    await expect(store.update(task.taskId, { who: { action: 'accept', content: {} } }, access)).rejects.toThrow(
      'Could not store the input responses',
    );
    expect(await store.get(task.taskId, access)).toMatchObject({
      status: 'input_required',
      inputRequests: { who: {} },
    });
    // Answers for keys that aren't open are ignored, as before.
    expect(await store.update(task.taskId, { other: { action: 'accept', content: {} } }, access)).toBe(true);
    store.close();
  });

  it('drops an answer whose suspension ended before it was written, instead of storing it on the next one', async () => {
    const work: MCPTaskWork = async () => ({
      status: 'input_required',
      inputRequests: { first: { method: 'elicitation/create', params: {} } },
    });
    const { store, storage, manager } = await setup(work);
    const access = { principal: 'alice' };
    const task = await store.create({ ttlMs: 60_000, principal: 'alice', context: { toolName: 'tool' } });
    store.run(task.taskId, work);
    await until(
      () => store.get(task.taskId, access),
      t => t?.status === 'input_required',
    );

    // Between this update's read and its write, the tool resumes and suspends again asking `second`.
    const update = storage.updateTask.bind(storage);
    const writes: boolean[] = [];
    vi.spyOn(storage, 'updateTask').mockImplementation(async (id, change, options) => {
      if ('metadata' in change && writes.length === 0) {
        const row = (await storage.getTask(id))!;
        await update(id, {
          suspendedAt: new Date(row.suspendedAt!.getTime() + 1000),
          metadata: {
            ...row.metadata,
            inputRequests: { second: { method: 'elicitation/create', params: {} } },
            inputResponses: {},
            usedInputKeys: ['first', 'second'],
          },
        });
      }
      const written = await update(id, change, options);
      if ('metadata' in change) writes.push(written);
      return written;
    });

    // `first` is no longer open once the write is refused, so the answer is ignored rather than retried.
    expect(await store.update(task.taskId, { first: { action: 'accept', content: { stale: true } } }, access)).toBe(
      true,
    );
    expect(writes).toEqual([false]);
    const row = await rowOf(manager);
    expect(row).toMatchObject({ status: 'suspended' });
    expect(row.metadata).toMatchObject({ inputRequests: { second: {} }, inputResponses: {} });
    expect(await store.get(task.taskId, access)).toMatchObject({
      status: 'input_required',
      inputRequests: { second: {} },
    });
    store.close();
  });

  async function rowOf(manager: NonNullable<Mastra['backgroundTaskManager']>) {
    const { tasks } = await manager.listTasks({ agentId: 'mcp-server:s' });
    return tasks[0]!;
  }

  async function until<T>(read: () => Promise<T>, done: (value: T) => boolean): Promise<T> {
    let value = await read();
    for (let i = 0; i < 150 && !done(value); i++) {
      await sleep(20);
      value = await read();
    }
    return value;
  }

  const access = { principal: 'alice' };

  it('aborts a task still running at its TTL and reports it expired', async () => {
    const aborted: unknown[] = [];
    const hang: MCPTaskWork = ({ signal }) =>
      new Promise((_, reject) =>
        signal.addEventListener('abort', () => {
          aborted.push(signal.reason);
          reject(signal.reason);
        }),
      );
    const { store } = await setup(hang);
    const task = await store.create({ ttlMs: 150, principal: 'alice', context: { toolName: 'tool' } });
    store.run(task.taskId, hang);
    const done = await until(
      () => store.get(task.taskId, access),
      t => t?.status !== 'working',
    );
    expect(done).toMatchObject({ status: 'failed', error: { code: -32603, message: TASK_EXPIRED_MESSAGE } });
    // Reported expired as soon as the TTL passes; the attempt's timeout aborts the work right after.
    await until(
      async () => aborted.length,
      n => n > 0,
    );
    expect(aborted).toHaveLength(1);
    store.close();
  });

  it('sweeps a task waiting for input past its TTL to failed', async () => {
    const ask: MCPTaskWork = async () => ({
      status: 'input_required',
      inputRequests: { k: { method: 'elicitation/create', params: {} } },
    });
    const { store, manager } = await setup(ask);
    const task = await store.create({ ttlMs: 150, principal: 'alice', context: { toolName: 'tool' } });
    store.run(task.taskId, ask);
    await until(
      () => rowOf(manager),
      row => row.status === 'suspended',
    );
    await sleep(160);
    expect(await store.get(task.taskId, access)).toMatchObject({ status: 'failed' });
    expect((await rowOf(manager)).status).toBe('suspended');

    await store.sweep();
    const row = await rowOf(manager);
    expect(row).toMatchObject({ status: 'failed', error: { message: TASK_EXPIRED_MESSAGE } });
    // Kept for a while so the failure stays readable; cleanup deletes it after that.
    expect(row.expiresAt!.getTime()).toBeGreaterThan(Date.now());
    expect(await store.get(task.taskId, access)).toMatchObject({
      status: 'failed',
      error: { message: TASK_EXPIRED_MESSAGE },
    });
    // An answer arriving now is not taken.
    expect(await store.update(task.taskId, { k: { action: 'accept', content: {} } }, access)).toBe(true);
    expect((await rowOf(manager)).status).toBe('failed');
    store.close();
  });

  it('stops counting a task waiting for input once its TTL passes, before the sweep fails it', async () => {
    const ask: MCPTaskWork = async () => ({
      status: 'input_required',
      inputRequests: { k: { method: 'elicitation/create', params: {} } },
    });
    const { store, manager } = await setup(ask);
    const limits = { perPrincipal: 1, total: 1 };
    const task = await store.create({ ttlMs: 150, principal: 'alice', context: { toolName: 'tool' }, limits });
    store.run(task.taskId, ask);
    await until(
      () => rowOf(manager),
      row => row.status === 'suspended',
    );
    await expect(
      store.create({ ttlMs: 60_000, principal: 'bob', context: { toolName: 'tool' }, limits }),
    ).rejects.toMatchObject({ scope: 'total', limit: 1 });
    await sleep(160);
    expect((await rowOf(manager)).status).toBe('suspended');
    const next = await store.create({ ttlMs: 60_000, principal: 'alice', context: { toolName: 'tool' }, limits });
    store.run(next.taskId, ask);
    expect(next.status).toBe('working');
    store.close();
  });

  it.each([
    { recover: false, status: 'failed', runs: 1 },
    { recover: true, status: 'completed', runs: 2 },
  ])(
    'settles a running task whose worker stopped renewing its lease (recover: $recover)',
    async ({ recover, status, runs }) => {
      let attempts = 0;
      const release: Array<() => void> = [];
      const work: MCPTaskWork = async () => {
        attempts++;
        // The first attempt stands in for the dead worker's: it never finishes.
        if (attempts === 1) await new Promise<void>(resolve => release.push(resolve));
        return { status: 'completed', result: { content: [{ type: 'text', text: `attempt ${attempts}` }] } };
      };
      const { store, manager, storage } = await setup(work, recover);
      const task = await store.create({ ttlMs: 60_000, principal: 'alice', context: { toolName: 'tool' } });
      store.run(task.taskId, work);
      const running = await until(
        () => rowOf(manager),
        row => row.status === 'running',
      );
      // Another worker owned it and stopped renewing.
      await storage.updateTask(running.id, { ownerId: 'dead-worker', leaseExpiresAt: new Date(Date.now() - 1) });

      await store.sweep();
      const settled = await until(
        () => store.get(task.taskId, access),
        t => t?.status === status,
      );
      expect(settled?.status).toBe(status);
      if (!recover) expect(settled).toMatchObject({ error: { code: -32603, message: TASK_LOST_MESSAGE } });
      // A second sweep, as another instance would run, settles nothing twice.
      await store.sweep();
      await sleep(100);
      expect(attempts).toBe(runs);
      release.forEach(resolve => resolve());
      store.close();
    },
  );

  /** Rows queued by an instance that died before dispatching them: pending, unowned, a while old. */
  async function abandon(
    storage: Awaited<ReturnType<NonNullable<Mastra['backgroundTaskManager']>['getStorage']>>,
    n: number,
  ) {
    const createdAt = new Date(Date.now() - 10 * 60_000);
    for (let i = 0; i < n; i++) {
      const taskKey = `abandoned-${i}`;
      await storage.createTask(
        row({
          id: taskKey,
          status: 'pending',
          toolName: 'mcp-server:s:tool',
          toolCallId: taskKey,
          runId: taskKey,
          resourceId: `mcp-server:s:${envelope.principalKey}`,
          args: { taskKey, context: { toolName: 'tool' } },
          createdAt: new Date(createdAt.getTime() + i),
          expiresAt: new Date(Date.now() + 60_000),
          metadata: { ...envelope } as unknown as Record<string, unknown>,
        }),
      );
    }
  }

  it('restarts abandoned rows a batch per sweep, and drains them over sweeps', async () => {
    const work: MCPTaskWork = async () => ({ status: 'completed', result: { content: [] } });
    const { store, manager, storage } = await setup(work, false, {
      globalConcurrency: 1_000,
      perAgentConcurrency: 1_000,
    });
    await abandon(storage, 250);
    const restart = vi.spyOn(manager, 'restart');

    const perSweep: number[] = [];
    for (let i = 0; i < 20; i++) {
      const { total } = await manager.listTasks({ agentId: 'mcp-server:s', status: ['pending', 'running'] });
      if (total === 0) break;
      const before = restart.mock.calls.length;
      await store.sweep();
      perSweep.push(restart.mock.calls.length - before);
      await sleep(100);
    }
    expect(Math.max(...perSweep)).toBeLessThanOrEqual(100);
    const { total: done } = await manager.listTasks({ agentId: 'mcp-server:s', status: 'completed' });
    expect(done).toBe(250);
    store.close();
  });

  it('restarts only as many abandoned rows as there are free slots', async () => {
    const release: Array<() => void> = [];
    const work: MCPTaskWork = async () => {
      await new Promise<void>(resolve => release.push(resolve));
      return { status: 'completed', result: { content: [] } };
    };
    const { store, manager, storage } = await setup(work, false, { perAgentConcurrency: 3 });
    await abandon(storage, 20);
    const restart = vi.spyOn(manager, 'restart');

    await store.sweep();
    expect(restart).toHaveBeenCalledTimes(3);
    await until(
      async () => release.length,
      n => n === 3,
    );
    // Every slot is taken: the next sweep restarts nothing.
    await store.sweep();
    expect(restart).toHaveBeenCalledTimes(3);
    release.forEach(resolve => resolve());
    store.close();
  });

  /** A task waiting for input whose TTL has passed, so the next sweep would fail it. */
  async function expiredWaiting(
    store: BackgroundTaskMCPTaskStore,
    storage: Awaited<ReturnType<typeof setup>>['storage'],
  ) {
    const task = await store.create({ ttlMs: 60_000, principal: 'alice', context: { toolName: 'tool' } });
    store.run(task.taskId, async () => ({
      status: 'input_required',
      inputRequests: { k: { method: 'elicitation/create', params: {} } },
    }));
    const key = taskKeyOf(task.taskId);
    const waiting = await until(
      async () => (await storage.listTasks({ agentId: store.owner, toolCallId: key })).tasks[0],
      row => row?.status === 'suspended',
    );
    expect(await storage.updateTask(waiting!.id, { expiresAt: new Date(Date.now() - 1_000) })).toBe(true);
    return waiting!;
  }

  it('stops a sweep already running when it closes, and waits for it before closing', async () => {
    const { store, storage } = await setup(async () => ({ status: 'completed', result: { content: [] } }));
    const waiting = await expiredWaiting(store, storage);
    let release!: () => void;
    const held = new Promise<void>(resolve => (release = resolve));
    const deleteTasks = storage.deleteTasks.bind(storage);
    const reached = vi.spyOn(storage, 'deleteTasks').mockImplementation(async filter => {
      await held;
      return deleteTasks(filter);
    });

    const sweeping = store.sweep();
    await until(
      async () => reached.mock.calls.length,
      n => n === 1,
    );
    let closed = false;
    const closing = Promise.resolve(store.close()).then(() => (closed = true));
    await sleep(20);
    expect(closed).toBe(false);

    release();
    await sweeping;
    await closing;
    // The sweep stopped at close: the task past its TTL was not failed by this instance.
    expect(await storage.getTask(waiting.id)).toMatchObject({ status: 'suspended' });
  });

  it('sweeps no more once closed, even when asked about a task', async () => {
    const { store, storage } = await setup(async () => ({ status: 'completed', result: { content: [] } }), false, {
      leaseDurationMs: 3_000,
    });
    const waiting = await expiredWaiting(store, storage);
    const sweeps = vi.spyOn(storage, 'deleteTasks');
    await store.close();

    // Requests start the sweep timer; a closed store must not start it again.
    const timers = vi.spyOn(globalThis, 'setInterval');
    await store.get(waiting.toolCallId, { principal: 'alice' }).catch(() => undefined);
    expect(timers).not.toHaveBeenCalled();
    timers.mockRestore();
    await store.sweep();
    expect(sweeps).not.toHaveBeenCalled();
    // Past one sweep interval: no timer runs either.
    await sleep(3_300);
    expect(sweeps).not.toHaveBeenCalled();
    expect(await storage.getTask(waiting.id)).toMatchObject({ status: 'suspended' });
  });
});

// Without `backgroundTasks.cleanup`, the manager never deletes finished rows; the sweep deletes this
// server's own once their TTL and retention have passed.
describe.each([
  { storage: 'in-memory', make: () => new InMemoryStore() },
  {
    storage: 'libsql',
    make: (dir: string) => new LibSQLStore({ id: 'purge', url: `file:${join(dir, 'tasks.db')}` }),
  },
])('BackgroundTaskMCPTaskStore deleting finished rows ($storage)', ({ make }) => {
  const RETENTION_MS = 60_000;
  let mastra: Mastra | undefined;
  let dir: string | undefined;
  afterEach(async () => {
    await mastra?.shutdown();
    mastra = undefined;
    if (dir) rmSync(dir, { recursive: true, force: true });
    dir = undefined;
  });

  const done: MCPTaskWork = async () => ({ status: 'completed', result: { content: [] } });

  async function setup() {
    dir = mkdtempSync(join(tmpdir(), 'mcp-purge-'));
    mastra = new Mastra({ logger: false, storage: make(dir), backgroundTasks: { enabled: true } });
    const manager = mastra.backgroundTaskManager!;
    const store = new BackgroundTaskMCPTaskStore({
      manager,
      serverId: 's',
      workFor: () => done,
      recoverFor: () => false,
    });
    store.registerTool('tool');
    return { manager, store, storage: await manager.getStorage() };
  }

  async function finished(store: BackgroundTaskMCPTaskStore, storage: Awaited<ReturnType<typeof setup>>['storage']) {
    const task = await store.create({ ttlMs: 60_000, principal: 'alice', context: { toolName: 'tool' } });
    store.run(task.taskId, done);
    const key = taskKeyOf(task.taskId);
    for (let i = 0; i < 150; i++) {
      const { tasks } = await storage.listTasks({ agentId: store.owner, toolCallId: key });
      if (tasks[0]?.status === 'completed') return tasks[0];
      await sleep(20);
    }
    throw new Error('task never completed');
  }

  /** Moves a row's deadline into the past, as if that much time had gone by. */
  async function expiredAgo(storage: Awaited<ReturnType<typeof setup>>['storage'], id: string, ms: number) {
    expect(await storage.updateTask(id, { expiresAt: new Date(Date.now() - ms) })).toBe(true);
  }

  it('deletes a finished task once its TTL and retention have passed', async () => {
    const { store, storage } = await setup();
    const row = await finished(store, storage);
    await expiredAgo(storage, row.id, RETENTION_MS + 1_000);

    await store.sweep();
    expect(await storage.getTask(row.id)).toBeNull();
    store.close();
  });

  it('keeps a finished task inside its TTL, and through the retention after it', async () => {
    const { store, storage } = await setup();
    const fresh = await finished(store, storage);
    const retained = await finished(store, storage);
    await expiredAgo(storage, retained.id, RETENTION_MS - 10_000);

    await store.sweep();
    expect(await storage.getTask(fresh.id)).toMatchObject({ status: 'completed' });
    expect(await storage.getTask(retained.id)).toMatchObject({ status: 'completed' });
    store.close();
  });

  it("leaves another server's rows and an agent's rows alone", async () => {
    const { store, storage } = await setup();
    const long = new Date(Date.now() - RETENTION_MS - 60_000);
    const theirs = (id: string, agentId: string): BackgroundTask =>
      row({ id, agentId, toolCallId: id, runId: id, status: 'completed', completedAt: long, expiresAt: long });
    await storage.createTask(theirs('other-server', 'mcp-server:other'));
    await storage.createTask(theirs('agent', 'agent-1'));
    // The same row of this server's is deleted, so the sweep did run its delete.
    await storage.createTask(theirs('mine', store.owner));

    await store.sweep();
    expect(await storage.getTask('mine')).toBeNull();
    expect(await storage.getTask('other-server')).toMatchObject({ status: 'completed' });
    expect(await storage.getTask('agent')).toMatchObject({ status: 'completed' });
    store.close();
  });

  it('keeps sweeping when the delete fails', async () => {
    const { store, storage } = await setup();
    vi.spyOn(storage, 'deleteTasks').mockRejectedValue(new Error('storage down'));
    const first = await store.create({ ttlMs: 60_000, principal: 'alice', context: { toolName: 'tool' } });
    const row = (await storage.listTasks({ agentId: store.owner, toolCallId: taskKeyOf(first.taskId) })).tasks[0]!;
    await expiredAgo(storage, row.id, 1_000);

    await expect(store.sweep()).resolves.toBeUndefined();
    // The later step of the same sweep still ran: the open task past its TTL is failed.
    expect(await storage.getTask(row.id)).toMatchObject({ status: 'failed', error: { message: TASK_EXPIRED_MESSAGE } });
    store.close();
  });

  it('fails an open task past its TTL instead of deleting it', async () => {
    const { store, storage } = await setup();
    const ask: MCPTaskWork = async () => ({
      status: 'input_required',
      inputRequests: { k: { method: 'elicitation/create', params: {} } },
    });
    const task = await store.create({ ttlMs: 60_000, principal: 'alice', context: { toolName: 'tool' } });
    store.run(task.taskId, ask);
    const key = taskKeyOf(task.taskId);
    let open: BackgroundTask | undefined;
    for (let i = 0; i < 150 && open?.status !== 'suspended'; i++) {
      await sleep(20);
      open = (await storage.listTasks({ agentId: store.owner, toolCallId: key })).tasks[0];
    }
    expect(open?.status).toBe('suspended');
    await expiredAgo(storage, open!.id, RETENTION_MS + 1_000);

    await store.sweep();
    expect(await storage.getTask(open!.id)).toMatchObject({
      status: 'failed',
      error: { message: TASK_EXPIRED_MESSAGE },
    });
    // Its new deadline keeps the failure readable through the retention, sweep after sweep.
    await store.sweep();
    expect(await storage.getTask(open!.id)).toMatchObject({ status: 'failed' });
    store.close();
  });
});
