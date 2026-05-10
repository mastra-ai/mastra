import { describe, expect, it, beforeEach } from 'vitest';

import type { MastraUnion } from '../../../action';
import { RequestContext } from '../../../request-context';
import { InMemoryStore } from '../../../storage/mock';
import type { ToolExecutionContext } from '../../types';
import { isValidationError } from '../../validation';
import { TASK_METADATA_KEY, TASK_METADATA_NAMESPACE, taskWrite } from '../index';
import type { TaskItem } from '../index';

async function runTaskWrite(input: Parameters<NonNullable<typeof taskWrite.execute>>[0], ctx: TaskWriteCtx) {
  const result = await taskWrite.execute!(input, ctx);
  if (isValidationError(result)) throw new Error(`unexpected validation error: ${result.message ?? 'unknown'}`);
  return result;
}

type TaskWriteCtx = ToolExecutionContext<unknown, unknown>;

function makeCtx(opts: { threadId?: string; storage?: InMemoryStore }): TaskWriteCtx {
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

async function seedThread(store: InMemoryStore, threadId: string, resourceId = 'r') {
  const memory = (await store.getStore('memory'))!;
  await memory.saveThread({
    thread: {
      id: threadId,
      resourceId,
      title: 'Test',
      createdAt: new Date(),
      updatedAt: new Date(),
      metadata: { existing: 'preserve me' },
    },
  });
  return memory;
}

const sampleTasks: TaskItem[] = [
  { content: 'A', activeForm: 'Doing A', status: 'pending' },
  { content: 'B', activeForm: 'Doing B', status: 'in_progress' },
  { content: 'C', activeForm: 'Doing C', status: 'completed' },
];

describe('taskWrite tool (standalone)', () => {
  let store: InMemoryStore;

  beforeEach(() => {
    store = new InMemoryStore();
  });

  it('persists tasks at thread.metadata.mastra.tasks (preserving sibling metadata)', async () => {
    const memory = await seedThread(store, 'thread-1');
    const result = await taskWrite.execute!({ tasks: sampleTasks }, makeCtx({ threadId: 'thread-1', storage: store }));

    expect(result).toMatchObject({
      written: 3,
      pending: 1,
      inProgress: 1,
      completed: 1,
    });

    const thread = await memory.getThreadById({ threadId: 'thread-1' });
    expect(thread).not.toBeNull();
    expect(thread!.metadata).toEqual({
      existing: 'preserve me',
      [TASK_METADATA_NAMESPACE]: {
        [TASK_METADATA_KEY]: sampleTasks,
      },
    });
  });

  it('replaces an existing task list on subsequent writes', async () => {
    const memory = await seedThread(store, 'thread-1');
    await taskWrite.execute!({ tasks: sampleTasks }, makeCtx({ threadId: 'thread-1', storage: store }));

    const next: TaskItem[] = [{ content: 'D', activeForm: 'Doing D', status: 'completed' }];
    await taskWrite.execute!({ tasks: next }, makeCtx({ threadId: 'thread-1', storage: store }));

    const thread = await memory.getThreadById({ threadId: 'thread-1' });
    const namespace = (thread!.metadata as any)[TASK_METADATA_NAMESPACE];
    expect(namespace[TASK_METADATA_KEY]).toEqual(next);
  });

  it('reports no-thread when threadId is missing (does not throw)', async () => {
    const result = await runTaskWrite({ tasks: sampleTasks }, makeCtx({ storage: store }));
    expect(result.written).toBe(3);
    expect(result.summary).toMatch(/no thread context/);
  });

  it('reports no-storage when mastra/getStorage is unavailable', async () => {
    const result = await runTaskWrite({ tasks: sampleTasks }, makeCtx({ threadId: 'thread-1' }));
    expect(result.written).toBe(3);
    expect(result.summary).toMatch(/no memory storage configured/);
  });
});
