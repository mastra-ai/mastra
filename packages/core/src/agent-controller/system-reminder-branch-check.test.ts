import { describe, expect, it, vi } from 'vitest';
import { Agent } from '../agent';
import {
  MASTRA_THREAD_BRANCH_METADATA_KEY,
  MASTRA_THREAD_BRANCH_PARENT_METADATA_KEY,
  MASTRA_THREAD_BRANCH_STATE_METADATA_KEY,
} from '../memory/branching';
import type { StorageListThreadsInput } from '../storage';
import { InMemoryStore } from '../storage/mock';
import { AgentController } from './agent-controller';
import { createMockWorkspace } from './test-utils';

const createdAt = new Date('2026-01-01T00:00:00.000Z');

async function createSession(storage: InMemoryStore) {
  const controller = new AgentController({
    workspace: createMockWorkspace(),
    id: 'test-controller',
    storage,
    modes: [
      {
        id: 'default',
        name: 'Default',
        default: true,
        agent: new Agent({
          name: 'test-agent',
          instructions: 'You are a test agent.',
          model: { provider: 'openai', name: 'gpt-4o', toolChoice: 'auto' },
        }),
      },
    ],
  });
  await controller.init();
  return controller.createSession({ id: 'session-1', ownerId: 'owner-1', resourceId: 'resource', threadId: 'root' });
}

async function spyOnListThreads(storage: InMemoryStore) {
  const memoryStore = (await storage.getStore('memory'))!;
  const calls: StorageListThreadsInput[] = [];
  const listThreads = memoryStore.listThreads.bind(memoryStore);
  vi.spyOn(memoryStore, 'listThreads').mockImplementation(async input => {
    calls.push(input);
    return listThreads(input);
  });
  return { memoryStore, calls };
}

describe('AgentController system reminders on branch-tree threads', () => {
  it('saves a reminder on an ordinary thread without listing threads', async () => {
    const storage = new InMemoryStore();
    const session = await createSession(storage);
    const { calls } = await spyOnListThreads(storage);

    await expect(session.saveSystemReminderMessage({ message: 'hi', reminderType: 'test' })).resolves.toMatchObject({
      threadId: 'root',
    });
    expect(calls.filter(call => !call.filter?.metadata?.[MASTRA_THREAD_BRANCH_PARENT_METADATA_KEY])).toEqual([]);
  });

  it('refuses a reminder on a thread with a ready branch, found by its indexed parent key', async () => {
    const storage = new InMemoryStore();
    const session = await createSession(storage);
    const { memoryStore, calls } = await spyOnListThreads(storage);
    await memoryStore.saveThread({
      thread: {
        id: 'child',
        resourceId: 'resource',
        createdAt,
        updatedAt: createdAt,
        metadata: {
          [MASTRA_THREAD_BRANCH_METADATA_KEY]: { parentThreadId: 'root', state: 'ready' },
          [MASTRA_THREAD_BRANCH_PARENT_METADATA_KEY]: 'root',
          [MASTRA_THREAD_BRANCH_STATE_METADATA_KEY]: 'ready',
        },
      },
    });

    await expect(session.saveSystemReminderMessage({ message: 'hi', reminderType: 'test' })).rejects.toMatchObject({
      id: 'BRANCHING_UNSUPPORTED',
    });
    expect(calls.map(call => call.filter)).toEqual([
      {
        resourceId: 'resource',
        metadata: {
          [MASTRA_THREAD_BRANCH_PARENT_METADATA_KEY]: 'root',
          [MASTRA_THREAD_BRANCH_STATE_METADATA_KEY]: 'ready',
        },
      },
    ]);
  });
});

describe('AgentController raw storage thread reads', () => {
  it('reads, lists messages for, and updates a thread without listing every thread', async () => {
    const storage = new InMemoryStore();
    const session = await createSession(storage);
    const { id: threadId } = await session.thread.create({ title: 'Ordinary' });
    const { calls } = await spyOnListThreads(storage);

    await expect(session.thread.getById({ threadId })).resolves.toMatchObject({ id: threadId });
    await expect(session.thread.listMessages({ threadId })).resolves.toEqual([]);
    await session.thread.rename({ title: 'Renamed' });
    await expect(session.thread.getById({ threadId })).resolves.toMatchObject({ title: 'Renamed' });

    expect(calls.length).toBeGreaterThan(0);
    expect(calls.filter(call => call.perPage === false)).toEqual([]);
  });

  it('refuses to read a thread with a ready branch, found by its indexed parent key', async () => {
    const storage = new InMemoryStore();
    const session = await createSession(storage);
    const { id: threadId } = await session.thread.create({ title: 'Parent' });
    const { memoryStore } = await spyOnListThreads(storage);
    await memoryStore.saveThread({
      thread: {
        id: 'child',
        resourceId: 'resource',
        createdAt,
        updatedAt: createdAt,
        metadata: {
          [MASTRA_THREAD_BRANCH_METADATA_KEY]: { parentThreadId: threadId, state: 'ready' },
          [MASTRA_THREAD_BRANCH_PARENT_METADATA_KEY]: threadId,
          [MASTRA_THREAD_BRANCH_STATE_METADATA_KEY]: 'ready',
        },
      },
    });

    await expect(session.thread.getById({ threadId })).rejects.toMatchObject({ id: 'BRANCHING_UNSUPPORTED' });
  });
});
