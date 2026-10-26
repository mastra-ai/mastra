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
});
