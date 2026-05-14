import { describe, expect, it, beforeEach } from 'vitest';

import type { MastraUnion } from '../../../action';
import { RequestContext } from '../../../request-context';
import { InMemoryStore } from '../../../storage/mock';
import type { ToolExecutionContext } from '../../types';
import { isValidationError } from '../../validation';
import { taskCheck, taskWrite } from '../index';
import type { TaskItem } from '../index';

async function runTaskCheck(ctx: TaskCtx) {
  const result = await taskCheck.execute!({}, ctx);
  if (isValidationError(result)) throw new Error(`unexpected validation error`);
  return result;
}

type TaskCtx = ToolExecutionContext<unknown, unknown>;

function makeCtx(opts: { threadId?: string; storage?: InMemoryStore }): TaskCtx {
  const mastraStub = opts.storage
    ? ({ getStorage: () => opts.storage } as unknown as MastraUnion)
    : (undefined as unknown as MastraUnion | undefined);

  return {
    requestContext: new RequestContext(),
    mastra: mastraStub,
    agent: {
      agentId: 'a',
      toolCallId: 't',
      messages: [],
      suspend: async () => {},
      threadId: opts.threadId,
    },
  };
}

async function seedThread(store: InMemoryStore, threadId: string) {
  const memory = (await store.getStore('memory'))!;
  await memory.saveThread({
    thread: {
      id: threadId,
      resourceId: 'r',
      title: '',
      createdAt: new Date(),
      updatedAt: new Date(),
      metadata: {},
    },
  });
}

describe('taskCheck tool (standalone)', () => {
  let store: InMemoryStore;

  beforeEach(() => {
    store = new InMemoryStore();
  });

  it('returns empty state when nothing has been written', async () => {
    await seedThread(store, 'thread-1');
    const result = await taskCheck.execute!({}, makeCtx({ threadId: 'thread-1', storage: store }));
    expect(result).toEqual({
      total: 0,
      pending: 0,
      inProgress: 0,
      completed: 0,
      allComplete: false,
      tasks: [],
    });
  });

  it('reads tasks previously written by taskWrite (round-trip)', async () => {
    await seedThread(store, 'thread-1');
    const tasks: TaskItem[] = [
      { content: 'A', activeForm: 'Doing A', status: 'in_progress' },
      { content: 'B', activeForm: 'Doing B', status: 'pending' },
    ];
    await taskWrite.execute!({ tasks }, makeCtx({ threadId: 'thread-1', storage: store }));
    const result = await runTaskCheck(makeCtx({ threadId: 'thread-1', storage: store }));
    expect(result.total).toBe(2);
    expect(result.pending).toBe(1);
    expect(result.inProgress).toBe(1);
    expect(result.completed).toBe(0);
    expect(result.allComplete).toBe(false);
    expect(result.tasks).toEqual(tasks);
  });

  it('reports allComplete only when every task is completed', async () => {
    await seedThread(store, 'thread-1');
    const tasks: TaskItem[] = [
      { content: 'A', activeForm: 'Doing A', status: 'completed' },
      { content: 'B', activeForm: 'Doing B', status: 'completed' },
    ];
    await taskWrite.execute!({ tasks }, makeCtx({ threadId: 'thread-1', storage: store }));
    const result = await runTaskCheck(makeCtx({ threadId: 'thread-1', storage: store }));
    expect(result.allComplete).toBe(true);
  });

  it('returns empty state when threadId / storage is missing (no throw)', async () => {
    const noThread = await runTaskCheck(makeCtx({ storage: store }));
    expect(noThread.total).toBe(0);
    expect(noThread.allComplete).toBe(false);

    const noStorage = await runTaskCheck(makeCtx({ threadId: 'thread-1' }));
    expect(noStorage.total).toBe(0);
    expect(noStorage.allComplete).toBe(false);
  });

  it('returns empty state when stored value fails schema validation', async () => {
    const memory = (await store.getStore('memory'))!;
    await memory.saveThread({
      thread: {
        id: 'thread-1',
        resourceId: 'r',
        title: '',
        createdAt: new Date(),
        updatedAt: new Date(),
        metadata: { mastra: { tasks: 'not-an-array' } },
      },
    });
    const result = await runTaskCheck(makeCtx({ threadId: 'thread-1', storage: store }));
    expect(result.total).toBe(0);
    expect(result.tasks).toEqual([]);
  });
});
