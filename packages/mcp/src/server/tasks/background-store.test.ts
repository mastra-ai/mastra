import type { BackgroundTask } from '@mastra/core/background-tasks';
import { Mastra } from '@mastra/core/mastra';
import { InMemoryStore } from '@mastra/core/storage';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { taskKeyOf } from '../../shared/tasks';
import { BackgroundTaskMCPTaskStore, projectTask, TASK_EXPIRED_MESSAGE, TASK_LOST_MESSAGE } from './background-store';
import type { BackgroundTaskEnvelope } from './background-store';
import type { MCPTaskAttempt, MCPTaskWork } from './store';

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
const elicitRequest = { method: 'elicitation/create', params: {} };

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

  it('acknowledges a cancel without waiting for onCancel, and calls it with the task context', async () => {
    mastra = new Mastra({ logger: false, storage: new InMemoryStore(), backgroundTasks: { enabled: true } });
    const contexts: unknown[] = [];
    const store = new BackgroundTaskMCPTaskStore({
      manager: mastra.backgroundTaskManager!,
      serverId: 's',
      workFor: () => async () => ({ status: 'input_required', inputRequests: { who: elicitRequest } }),
      recoverFor: () => false,
      // Never settles, like a hook stuck on a slow storage.
      onCancel: context => (contexts.push(context), new Promise(() => {})),
    });
    store.registerTool('tool');
    const access = { principal: 'alice' };
    const task = await store.create({ ttlMs: 60_000, principal: 'alice', context: { toolName: 'tool', id: 1 } });
    store.run(task.taskId, async () => ({ status: 'input_required', inputRequests: { who: elicitRequest } }));
    let current = await store.get(task.taskId, access);
    for (let i = 0; i < 100 && current?.status !== 'input_required'; i++) {
      await sleep(20);
      current = await store.get(task.taskId, access);
    }

    expect(await store.cancel(task.taskId, access)).toBe(true);
    expect(await store.get(task.taskId, access)).toMatchObject({ status: 'cancelled' });
    await vi.waitFor(() => expect(contexts).toEqual([{ toolName: 'tool', id: 1 }]));
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
});
