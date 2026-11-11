import { describe, expect, it } from 'vitest';
import { Agent } from '../agent';
import type { StorageThreadType } from '../memory/types';
import { InMemoryStore } from '../storage/mock';
import { AgentController } from './agent-controller';
import { isSessionNotStartedError } from './errors';
import { createMockWorkspace } from './test-utils';

async function createController(storage: InMemoryStore) {
  const controller = new AgentController({
    workspace: createMockWorkspace(),
    id: 'test-controller',
    storage,
    modes: [
      {
        id: 'default',
        name: 'Default',
        default: true,
        agent: new Agent({ name: 'a', instructions: 'x', model: { provider: 'openai', name: 'gpt-4o' } as any }),
      },
    ],
  });
  await controller.init();
  return controller;
}

async function seed(storage: InMemoryStore, threads: Array<Partial<StorageThreadType> & { id: string }>) {
  const memory = (await storage.getStore('memory'))!;
  for (const thread of threads) {
    await memory.saveThread({
      thread: {
        resourceId: 'r',
        title: thread.id,
        metadata: {},
        createdAt: new Date(0),
        updatedAt: new Date(0),
        ...thread,
      } as StorageThreadType,
    });
  }
  return memory;
}

// What the route returned before: every thread, newest-updated first, then sliced.
async function fullRead(controller: AgentController, limit: number, metadata?: Record<string, unknown>) {
  const all = await controller.queryThreads({ resourceId: 'r', metadata });
  const time = (t: { updatedAt?: Date; createdAt?: Date }) => (t.updatedAt ?? t.createdAt)?.getTime() ?? 0;
  return [...all].sort((a, b) => time(b) - time(a)).slice(0, limit);
}

describe('AgentController.queryThreads({ limit })', () => {
  it('returns the same threads as reading everything and slicing, for every limit', async () => {
    const storage = new InMemoryStore();
    // Shuffled update times, every third thread a forked subagent, a tag on half.
    const order = [7, 2, 19, 11, 0, 15, 4, 23, 9, 13, 1, 21, 6, 17, 3, 10, 22, 5, 14, 8, 18, 12, 20, 16];
    await seed(
      storage,
      order.map((minute, i) => ({
        id: `t${i}`,
        createdAt: new Date(Date.UTC(2026, 0, 1, 0, i)),
        updatedAt: new Date(Date.UTC(2026, 0, 2, 0, minute)),
        metadata: { ...(i % 3 === 0 ? { forkedSubagent: true } : {}), ...(i % 2 === 0 ? { projectPath: '/a' } : {}) },
      })),
    );
    const controller = await createController(storage);

    for (const metadata of [undefined, { projectPath: '/a' }]) {
      for (let limit = 1; limit <= order.length + 2; limit++) {
        const limited = await controller.queryThreads({ resourceId: 'r', metadata, limit });
        expect(limited.map(t => t.id)).toEqual((await fullRead(controller, limit, metadata)).map(t => t.id));
      }
    }
  });

  it('keeps paging past pages that hold only forked subagent threads', async () => {
    const storage = new InMemoryStore();
    await seed(storage, [
      ...Array.from({ length: 9 }, (_, i) => ({
        id: `fork${i}`,
        updatedAt: new Date(Date.UTC(2026, 0, 2, 0, 50 - i)),
        metadata: { forkedSubagent: true },
      })),
      { id: 'old1', updatedAt: new Date(Date.UTC(2026, 0, 2, 0, 1)) },
      { id: 'old2', updatedAt: new Date(Date.UTC(2026, 0, 2, 0, 0)) },
    ]);
    const controller = await createController(storage);

    expect((await controller.queryThreads({ resourceId: 'r', limit: 2 })).map(t => t.id)).toEqual(['old1', 'old2']);
    expect((await controller.queryThreads({ resourceId: 'r', limit: 2, includeForkedSubagents: true })).length).toBe(2);
  });

  it('does not return a thread twice when it is updated between pages', async () => {
    const storage = new InMemoryStore();
    const memory = await seed(
      storage,
      Array.from({ length: 6 }, (_, i) => ({
        id: `t${i}`,
        updatedAt: new Date(Date.UTC(2026, 0, 2, 0, 10 - i)),
        metadata: i < 3 ? { forkedSubagent: true } : {},
      })),
    );
    const controller = await createController(storage);
    const list = memory.listThreads.bind(memory);
    let pages = 0;
    memory.listThreads = async input => {
      const result = await list(input);
      // After page 0 is read, t3 is touched and moves to the top.
      if (pages++ === 0) {
        const t3 = (await memory.getThreadById({ threadId: 't3' }))!;
        await memory.saveThread({ thread: { ...t3, updatedAt: new Date(Date.UTC(2026, 0, 3)) } });
      }
      return result;
    };

    const ids = (await controller.queryThreads({ resourceId: 'r', limit: 3 })).map(t => t.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

it('pages past a run of newer forks in one or two reads', async () => {
  const storage = new InMemoryStore();
  const memory = await seed(storage, [
    ...Array.from({ length: 60 }, (_, i) => ({
      id: `fork${i}`,
      updatedAt: new Date(Date.UTC(2026, 0, 2, 1, i)),
      metadata: { forkedSubagent: true, projectPath: '/a' },
    })),
    { id: 'parent', updatedAt: new Date(Date.UTC(2026, 0, 2)), metadata: { projectPath: '/a' } },
  ]);
  const controller = await createController(storage);
  const list = memory.listThreads.bind(memory);
  let calls = 0;
  memory.listThreads = async input => {
    calls++;
    return list(input);
  };

  const threads = await controller.queryThreads({ resourceId: 'r', metadata: { projectPath: '/a' }, limit: 1 });

  expect(threads.map(t => t.id)).toEqual(['parent']);
  expect(calls).toBeLessThanOrEqual(2);
});

describe('session recovery reads one thread when storage applies the scope', () => {
  it.each([
    { name: 'a matching thread among many others', threads: ['other', 'match'], recovers: true },
    { name: 'only non-matching threads', threads: ['other'], recovers: false },
    { name: 'a matching thread that is a forked subagent', threads: ['forked-match'], recovers: false },
  ])('$name', async ({ threads, recovers }) => {
    const storage = new InMemoryStore();
    const memory = await seed(storage, [
      ...Array.from({ length: 30 }, (_, i) => ({ id: `n${i}`, metadata: { projectPath: '/b' } })),
      ...threads.map(kind => ({
        id: kind,
        metadata:
          kind === 'other'
            ? { projectPath: '/b' }
            : { projectPath: '/a', ...(kind === 'forked-match' ? { forkedSubagent: true } : {}) },
      })),
    ]);
    const controller = await createController(storage);
    const calls: unknown[] = [];
    const list = memory.listThreads.bind(memory);
    memory.listThreads = async input => {
      calls.push(input);
      return list(input);
    };

    const result = await controller
      .createSession({ resourceId: 'r', id: 'r::/a', tags: { projectPath: '/a' }, resumeOnly: true })
      .then(
        () => true,
        error => (isSessionNotStartedError(error) ? false : Promise.reject(error)),
      );

    expect(result).toBe(recovers);
    expect(calls[0]).toMatchObject({ filter: { resourceId: 'r', metadata: { projectPath: '/a' } }, perPage: 50 });
  });
});
