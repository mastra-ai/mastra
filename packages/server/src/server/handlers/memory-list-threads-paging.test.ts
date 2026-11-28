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

async function setup({
  withAgentMemory,
  branching = false,
  count = 5,
  tied = false,
}: {
  withAgentMemory: boolean;
  branching?: boolean;
  count?: number;
  tied?: boolean;
}) {
  const storage = new InMemoryStore();
  const memoryStore = (await storage.getStore('memory')) as MemoryStorage;
  for (let index = 0; index < count; index++) {
    await memoryStore.saveThread({
      thread: {
        id: `thread-${index}`,
        resourceId: 'resource',
        createdAt: new Date(createdAt.getTime() + (tied ? 0 : index * 10)),
        updatedAt: new Date(createdAt.getTime() + (tied ? 0 : index * 10)),
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
    // The fallback that keeps the total right reads in batches, not the whole listing.
    for (const [args] of listThreads.mock.calls) {
      expect(args?.perPage).not.toBe(false);
    }
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

// With FGA the route filters threads in process. It reads storage in batches of 100 and keeps
// only the requested page, instead of loading every matching thread at once.
describe.each([
  { name: 'agent memory', withAgentMemory: true, branching: false },
  { name: 'branching agent memory', withAgentMemory: true, branching: true },
  { name: 'storage fallback', withAgentMemory: false, branching: false },
])('list threads paging with FGA ($name)', ({ withAgentMemory, branching }) => {
  it('authorizes in bounded batches and keeps the total exact', async () => {
    const { listThreads, mastra } = await setup({ withAgentMemory, branching, count: 250 });
    const filterAccessible = vi.fn(async (_user: unknown, threads: Array<{ id: string }>) =>
      threads.filter(thread => Number(thread.id.slice('thread-'.length)) % 2 === 0),
    );
    vi.spyOn(mastra, 'getServer').mockReturnValue({ fga: { filterAccessible, require: vi.fn() } } as any);
    const ctx = createTestServerContext({ mastra });
    ctx.requestContext.set('user', { id: 'user-1' });

    const result: any = await LIST_THREADS_ROUTE.handler({
      ...ctx,
      ...(withAgentMemory ? { agentId: 'test-agent' } : {}),
      resourceId: 'resource',
      page: 6,
      perPage: 10,
      orderBy: { field: 'createdAt', direction: 'ASC' },
    } as any);

    expect(result).toMatchObject({ total: 125, page: 6, perPage: 10, hasMore: true });
    expect(result.threads.map((thread: { id: string }) => thread.id)).toEqual(
      Array.from({ length: 10 }, (_, index) => `thread-${120 + index * 2}`),
    );
    expect(listThreads).toHaveBeenCalled();
    for (const [args] of listThreads.mock.calls) {
      expect(args?.perPage).toBe(100);
      expect(args?.filter?.resourceId).toBe('resource');
    }
    expect(filterAccessible).toHaveBeenCalledTimes(3);
    for (const [, threads] of filterAccessible.mock.calls) {
      expect(threads.length).toBeLessThanOrEqual(100);
    }
  });
});

// Adapters such as MySQL order only by the sort field, so rows that tie on it can come back in a
// different order for every OFFSET query. The mock gives each batch its own valid order of the tie.
describe.each([
  { name: 'agent memory', withAgentMemory: true, branching: false },
  { name: 'branching agent memory', withAgentMemory: true, branching: true },
  { name: 'storage fallback', withAgentMemory: false, branching: false },
])('list threads paging with FGA and tied sort keys ($name)', ({ withAgentMemory, branching }) => {
  it('returns every tied thread when a batch boundary falls inside the tie', async () => {
    const { listThreads, originalListThreads, mastra } = await setup({
      withAgentMemory,
      branching,
      count: 250,
      tied: true,
    });
    listThreads.mockImplementation(async (args: any) => {
      const all = await originalListThreads({ ...args, page: 0, perPage: false });
      if (args.perPage === false) return all;
      const rotation = (args.page * 41) % all.threads.length;
      const reordered = [...all.threads.slice(rotation), ...all.threads.slice(0, rotation)];
      const offset = args.page * args.perPage;
      return {
        ...all,
        threads: reordered.slice(offset, offset + args.perPage),
        page: args.page,
        perPage: args.perPage,
        hasMore: offset + args.perPage < all.total,
      };
    });
    const filterAccessible = vi.fn(async (_user: unknown, threads: Array<{ id: string }>) => threads);
    vi.spyOn(mastra, 'getServer').mockReturnValue({ fga: { filterAccessible, require: vi.fn() } } as any);
    const ctx = createTestServerContext({ mastra });
    ctx.requestContext.set('user', { id: 'user-1' });

    const result: any = await LIST_THREADS_ROUTE.handler({
      ...ctx,
      ...(withAgentMemory ? { agentId: 'test-agent' } : {}),
      resourceId: 'resource',
      page: 0,
      perPage: false,
      orderBy: { field: 'createdAt', direction: 'ASC' },
    } as any);

    expect(result.total).toBe(250);
    expect(new Set(result.threads.map((thread: { id: string }) => thread.id)).size).toBe(250);
    expect(listThreads.mock.calls.some(([args]) => args?.perPage === false)).toBe(true);
  });
});
