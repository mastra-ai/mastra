import { Agent } from '@mastra/core/agent';
import { Mastra } from '@mastra/core/mastra';
import { MockMemory } from '@mastra/core/memory';
import { InMemoryStore } from '@mastra/core/storage';
import type { MemoryStorage } from '@mastra/core/storage';
import { describe, expect, it, vi } from 'vitest';
import { LIST_THREADS_ROUTE } from './memory';
import { createTestServerContext } from './test-utils';

const createdAt = new Date('2026-01-01T00:00:00.000Z');

function branchMetadata(parentThreadId: string, state: 'ready' | 'pending') {
  return {
    __mastra_thread_branch: {
      parentThreadId,
      state,
      branchPointMessageId: 'root-message',
      observationalMemoryThreadId: 'child',
    },
    __mastra_thread_branch_parent: parentThreadId,
    __mastra_thread_branch_state: state,
  };
}

async function setup({ withAgentMemory, branching = false }: { withAgentMemory: boolean; branching?: boolean }) {
  const storage = new InMemoryStore();
  const memoryStore = (await storage.getStore('memory')) as MemoryStorage;
  for (let index = 0; index < 5; index++) {
    await memoryStore.saveThread({
      thread: {
        id: `thread-${index}`,
        resourceId: 'resource',
        createdAt: new Date(createdAt.getTime() + index * 10),
        updatedAt: new Date(createdAt.getTime() + index * 10),
        metadata: {},
      },
    });
  }
  await memoryStore.saveThread({
    thread: { id: 'other', resourceId: 'other-resource', createdAt, updatedAt: createdAt, metadata: {} },
  });

  const memory = new MockMemory({ storage });
  if (branching) {
    Object.defineProperty(memory, 'supportsThreadBranching', { configurable: true, value: true });
    vi.spyOn(memory, 'getBranchHistory').mockImplementation(async ({ threadId }) => {
      const thread = await memoryStore.getThreadById({ threadId });
      return { history: thread ? [{ thread, branch: null }] : [] };
    });
    Object.defineProperty(memory, '__mastraGetThreadBranchAuthorizationCandidates', {
      configurable: true,
      value: vi.fn(async (threadId: string) => {
        const thread = await memoryStore.getThreadById({ threadId });
        return thread ? [thread] : [];
      }),
    });
  }
  const agent = new Agent({
    id: 'test-agent',
    name: 'test-agent',
    instructions: 'test',
    model: {} as any,
    memory,
  });
  const mastra = new Mastra({
    logger: false,
    storage,
    ...(withAgentMemory ? { agents: { 'test-agent': agent } } : {}),
  });
  const listTarget = withAgentMemory ? memory : memoryStore;
  const originalListThreads = listTarget.listThreads.bind(listTarget);
  const listThreads = vi.spyOn(listTarget, 'listThreads');
  return { memoryStore, listThreads, originalListThreads, mastra };
}

function listPage(mastra: Mastra, withAgentMemory: boolean) {
  return LIST_THREADS_ROUTE.handler({
    ...createTestServerContext({ mastra }),
    ...(withAgentMemory ? { agentId: 'test-agent' } : {}),
    resourceId: 'resource',
    page: 1,
    perPage: 2,
    orderBy: { field: 'createdAt', direction: 'ASC' },
  } as any);
}

// Without FGA the list route pages in storage, as it does on main, instead of loading every
// matching thread and slicing in process.
describe.each([
  { name: 'agent memory', withAgentMemory: true },
  { name: 'storage fallback', withAgentMemory: false },
])('list threads paging ($name)', ({ withAgentMemory }) => {
  it('asks storage for one page only', async () => {
    const { listThreads, mastra } = await setup({ withAgentMemory });

    const result = await listPage(mastra, withAgentMemory);

    expect(result).toMatchObject({ total: 5, page: 1, perPage: 2, hasMore: true });
    expect((result as any).threads.map((thread: { id: string }) => thread.id)).toEqual(['thread-2', 'thread-3']);
    expect(listThreads).toHaveBeenCalled();
    for (const [args] of listThreads.mock.calls) {
      expect(args?.perPage).not.toBe(false);
      expect(args?.filter?.resourceId).toBe('resource');
    }
  });

  it('refuses the listing when the scope has a ready branch', async () => {
    const { memoryStore, mastra } = await setup({ withAgentMemory });
    await memoryStore.saveThread({
      thread: {
        id: 'child',
        resourceId: 'resource',
        createdAt,
        updatedAt: createdAt,
        metadata: branchMetadata('thread-0', 'ready'),
      },
    });

    let error: { res?: Response } | undefined;
    try {
      await listPage(mastra, withAgentMemory);
    } catch (caught) {
      error = caught as typeof error;
    }
    await expect(error?.res?.json()).resolves.toMatchObject({ error: { code: 'BRANCHING_UNSUPPORTED' } });
  });

  it('hides a pending branch and keeps the total right', async () => {
    const { memoryStore, mastra } = await setup({ withAgentMemory });
    await memoryStore.saveThread({
      thread: {
        id: 'child',
        resourceId: 'resource',
        createdAt,
        updatedAt: createdAt,
        metadata: branchMetadata('thread-0', 'pending'),
      },
    });

    const result = await listPage(mastra, withAgentMemory);

    expect(result).toMatchObject({ total: 5, page: 1, perPage: 2 });
    expect((result as any).threads.map((thread: { id: string }) => thread.id)).toEqual(['thread-2', 'thread-3']);
  });

  // A branch committed after the one-row probes but before the page read must still be caught.
  it.each([
    { state: 'ready' as const, expectRefusal: true },
    { state: 'pending' as const, expectRefusal: false },
  ])('checks the page rows for a $state branch committed after the probes', async ({ state, expectRefusal }) => {
    const { memoryStore, listThreads, originalListThreads, mastra } = await setup({ withAgentMemory });
    listThreads.mockImplementation(async (args: Parameters<typeof originalListThreads>[0]) => {
      if (args?.perPage === 2) {
        await memoryStore.saveThread({
          thread: {
            id: 'child',
            resourceId: 'resource',
            // Sorts between thread-2 and thread-3, so it lands on the requested page.
            createdAt: new Date(createdAt.getTime() + 25),
            updatedAt: createdAt,
            metadata: branchMetadata('thread-0', state),
          },
        });
      }
      return originalListThreads(args);
    });

    let error: { res?: Response } | undefined;
    let result: any;
    try {
      result = await listPage(mastra, withAgentMemory);
    } catch (caught) {
      error = caught as typeof error;
    }

    if (expectRefusal) {
      await expect(error?.res?.json()).resolves.toMatchObject({ error: { code: 'BRANCHING_UNSUPPORTED' } });
      return;
    }
    expect(error).toBeUndefined();
    expect(result).toMatchObject({ total: 5, page: 1, perPage: 2 });
    expect(result.threads.map((thread: { id: string }) => thread.id)).toEqual(['thread-2', 'thread-3']);
  });
});

describe('list threads paging (branching memory)', () => {
  it('asks memory for one page only and checks ancestry on that page', async () => {
    const { listThreads, mastra } = await setup({ withAgentMemory: true, branching: true });

    const result = await listPage(mastra, true);

    expect(result).toMatchObject({ total: 5, page: 1, perPage: 2, hasMore: true });
    expect((result as any).threads.map((thread: { id: string }) => thread.id)).toEqual(['thread-2', 'thread-3']);
    expect(listThreads).toHaveBeenCalledTimes(1);
    expect(listThreads.mock.calls[0]?.[0]).toMatchObject({ page: 1, perPage: 2 });
  });
});
