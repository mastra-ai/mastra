import type { BackgroundTask } from '@mastra/core/background-tasks';
import { Mastra } from '@mastra/core/mastra';
import { InMemoryStore } from '@mastra/core/storage';
import { afterEach, describe, expect, it } from 'vitest';
import { BackgroundTaskMCPTaskStore, projectTask, TASK_EXPIRED_MESSAGE, TASK_LOST_MESSAGE } from './background-store';
import type { BackgroundTaskEnvelope } from './background-store';
import type { MCPTaskWork } from './store';

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const envelope: BackgroundTaskEnvelope = { v: 1, principal: 'alice', ttlMs: 60_000, recover: false, usedInputKeys: [] };

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

  async function setup(work: MCPTaskWork, recover = false) {
    mastra = new Mastra({ logger: false, storage: new InMemoryStore(), backgroundTasks: { enabled: true } });
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
});
