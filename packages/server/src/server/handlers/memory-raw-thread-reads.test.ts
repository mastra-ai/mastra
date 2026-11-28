import { Mastra } from '@mastra/core/mastra';
import { InMemoryStore } from '@mastra/core/storage';
import type { MemoryStorage } from '@mastra/core/storage';
import { describe, expect, it, vi } from 'vitest';
import { GET_THREAD_BY_ID_ROUTE, LIST_MESSAGES_ROUTE } from './memory';
import { createTestServerContext } from './test-utils';

const createdAt = new Date('2026-01-01T00:00:00.000Z');

async function setup() {
  const storage = new InMemoryStore();
  const memoryStore = (await storage.getStore('memory')) as MemoryStorage;
  await memoryStore.saveThread({
    thread: { id: 'root', resourceId: 'resource', title: 'Root', createdAt, updatedAt: createdAt, metadata: {} },
  });
  await memoryStore.saveThread({
    thread: { id: 'other', resourceId: 'other-resource', createdAt, updatedAt: createdAt, metadata: {} },
  });
  const listThreads = vi.spyOn(memoryStore, 'listThreads');
  const mastra = new Mastra({ logger: false, storage });
  return { memoryStore, listThreads, mastra };
}

// Storage-fallback reads (no resolvable agent memory) must find the row and its ready
// branches with targeted queries, never by listing the whole thread table.
describe('raw storage thread reads', () => {
  it('reads a thread and its messages without an unbounded thread listing', async () => {
    const { listThreads, mastra } = await setup();

    await expect(
      GET_THREAD_BY_ID_ROUTE.handler({ ...createTestServerContext({ mastra }), threadId: 'root' }),
    ).resolves.toMatchObject({ id: 'root' });
    await LIST_MESSAGES_ROUTE.handler({
      ...createTestServerContext({ mastra }),
      threadId: 'root',
      resourceId: 'resource',
      perPage: 10,
      page: 0,
    } as any);

    expect(listThreads).toHaveBeenCalled();
    for (const [args] of listThreads.mock.calls) {
      expect(args?.perPage).not.toBe(false);
      expect(args?.filter?.resourceId).toBe('resource');
    }
  });

  it('still refuses a thread that has a ready branch, found by the indexed parent key', async () => {
    const { memoryStore, mastra } = await setup();
    await memoryStore.saveThread({
      thread: {
        id: 'child',
        resourceId: 'resource',
        createdAt,
        updatedAt: createdAt,
        metadata: {
          __mastra_thread_branch: {
            parentThreadId: 'root',
            state: 'ready',
            branchPointMessageId: 'root-message',
            observationalMemoryThreadId: 'child',
          },
          __mastra_thread_branch_parent: 'root',
          __mastra_thread_branch_state: 'ready',
        },
      },
    });

    let error: { status?: number; res?: Response } | undefined;
    try {
      await GET_THREAD_BY_ID_ROUTE.handler({ ...createTestServerContext({ mastra }), threadId: 'root' });
    } catch (caught) {
      error = caught as typeof error;
    }
    await expect(error?.res?.json()).resolves.toMatchObject({ error: { code: 'BRANCHING_UNSUPPORTED' } });
  });
});
