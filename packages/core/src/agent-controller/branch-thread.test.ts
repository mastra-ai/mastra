import { describe, expect, it, vi } from 'vitest';
import { Agent } from '../agent';
import { InMemoryStore } from '../storage/mock';
import { AgentController } from './agent-controller';
import { createMockWorkspace } from './test-utils';

const now = new Date('2026-01-01T00:00:00.000Z');

function createController({ memory, storage }: { memory?: unknown; storage?: InMemoryStore } = {}) {
  return new AgentController({
    workspace: createMockWorkspace(),
    id: 'test-controller',
    resourceId: 'controller-resource',
    storage,
    memory: memory as never,
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
}

/** Memory mock with ordinary thread reads/writes delegated to the raw store. */
async function mockMemory(storage: InMemoryStore, extra: Record<string, unknown>) {
  const memoryStore = await storage.getStore('memory');
  return {
    getThreadById: ({ threadId }: { threadId: string }) => memoryStore.getThreadById({ threadId }),
    saveThread: ({ thread }: { thread: any }) => memoryStore.saveThread({ thread }),
    updateThread: ({ id, title, metadata }: { id: string; title?: string; metadata?: Record<string, unknown> }) =>
      memoryStore.updateThread({ id, title, metadata }),
    ...extra,
  };
}

async function saveThread(storage: InMemoryStore, id: string, resourceId = 'controller-resource') {
  const memoryStore = await storage.getStore('memory');
  await memoryStore.saveThread({
    thread: { id, resourceId, title: `Thread ${id}`, createdAt: now, updatedAt: now, metadata: {} },
  });
}

describe('AgentController thread branching', () => {
  it('branches via configured memory, binds the session to the branch, and returns fork metadata', async () => {
    const storage = new InMemoryStore();
    const branchThread = vi.fn().mockResolvedValue({
      thread: {
        id: 'branch-thread-id',
        resourceId: 'controller-resource',
        title: 'Branch title',
        createdAt: now,
        updatedAt: now,
        metadata: {},
      },
      branch: {
        parentThreadId: 'source-thread-id',
        branchPointMessageId: 'fork-message-id',
        branchPointCreatedAt: now,
        branchCreatedAt: now,
      },
    });
    const memoryFactory = vi
      .fn()
      .mockResolvedValue(await mockMemory(storage, { supportsThreadBranching: true, branchThread }));
    const controller = createController({ memory: memoryFactory, storage });

    await controller.init();
    await saveThread(storage, 'source-thread-id');
    const session = await controller.createSession({ id: 'test-session', ownerId: 'test-owner' });

    const result = await session.thread.branch({
      sourceThreadId: 'source-thread-id',
      branchPointMessageId: 'fork-message-id',
      title: 'Branch title',
    });

    expect(branchThread).toHaveBeenCalledWith({
      threadId: 'source-thread-id',
      branchPointMessageId: 'fork-message-id',
      title: 'Branch title',
    });
    expect(result.thread.id).toBe('branch-thread-id');
    expect(result.branch).toMatchObject({
      parentThreadId: 'source-thread-id',
      branchPointMessageId: 'fork-message-id',
    });
    expect(session.thread.getId()).toBe('branch-thread-id');
  });

  it('rejects branching a thread owned by another resource', async () => {
    const storage = new InMemoryStore();
    const branchThread = vi.fn();
    const memoryFactory = vi
      .fn()
      .mockResolvedValue(await mockMemory(storage, { supportsThreadBranching: true, branchThread }));
    const controller = createController({ memory: memoryFactory, storage });

    await controller.init();
    await saveThread(storage, 'foreign-thread-id', 'other-resource');
    const session = await controller.createSession({ id: 'test-session', ownerId: 'test-owner' });

    await expect(
      session.thread.branch({ sourceThreadId: 'foreign-thread-id', branchPointMessageId: 'fork-message-id' }),
    ).rejects.toThrow('Thread not found: foreign-thread-id');
    expect(branchThread).not.toHaveBeenCalled();
  });

  it('throws BRANCHING_UNSUPPORTED when the configured memory has no branch support', async () => {
    const storage = new InMemoryStore();
    const memoryFactory = vi.fn().mockResolvedValue(await mockMemory(storage, { cloneThread: vi.fn() }));
    const controller = createController({ memory: memoryFactory, storage });

    await controller.init();
    await saveThread(storage, 'source-thread-id');
    const session = await controller.createSession({ id: 'test-session', ownerId: 'test-owner' });

    await expect(
      session.thread.branch({ sourceThreadId: 'source-thread-id', branchPointMessageId: 'fork-message-id' }),
    ).rejects.toMatchObject({ id: 'BRANCHING_UNSUPPORTED' });
  });

  it('throws BRANCHING_UNSUPPORTED on the raw storage fallback path', async () => {
    const storage = new InMemoryStore();
    const controller = createController({ storage });

    await controller.init();
    await saveThread(storage, 'source-thread-id');
    const session = await controller.createSession({ id: 'test-session', ownerId: 'test-owner' });

    await expect(
      session.thread.branch({ sourceThreadId: 'source-thread-id', branchPointMessageId: 'fork-message-id' }),
    ).rejects.toMatchObject({ id: 'BRANCHING_UNSUPPORTED' });
  });

  it('resolves parent, own fork metadata, and direct branches through the gateway', async () => {
    const storage = new InMemoryStore();
    const parentThread = {
      id: 'parent-thread-id',
      resourceId: 'controller-resource',
      title: 'Parent',
      createdAt: now,
      updatedAt: now,
      metadata: {},
    };
    const branch = {
      parentThreadId: 'parent-thread-id',
      branchPointMessageId: 'fork-message-id',
      branchPointCreatedAt: now,
      branchCreatedAt: now,
    };
    const getParentThread = vi.fn().mockResolvedValue(parentThread);
    const listBranches = vi.fn().mockResolvedValue({
      total: 1,
      page: 0,
      perPage: 100,
      hasMore: false,
      branches: [
        {
          thread: {
            id: 'child-thread-id',
            resourceId: 'controller-resource',
            title: 'Child',
            createdAt: now,
            updatedAt: now,
            metadata: {},
          },
          branch,
        },
      ],
    });
    const memoryFactory = vi
      .fn()
      .mockResolvedValue(await mockMemory(storage, { supportsThreadBranching: true, getParentThread, listBranches }));
    const controller = createController({ memory: memoryFactory, storage });

    await controller.init();
    await saveThread(storage, 'parent-thread-id');
    await saveThread(storage, 'child-thread-id');
    const session = await controller.createSession({ id: 'test-session', ownerId: 'test-owner' });

    const parent = await session.thread.getParent({ threadId: 'child-thread-id' });
    expect(parent?.id).toBe('parent-thread-id');
    expect(getParentThread).toHaveBeenCalledWith({ threadId: 'child-thread-id' });

    const info = await session.thread.getBranchInfo({ threadId: 'child-thread-id' });
    expect(info).toMatchObject({
      parentThreadId: 'parent-thread-id',
      branchPointMessageId: 'fork-message-id',
    });

    const children = await session.thread.listBranches({ threadId: 'parent-thread-id' });
    expect(children.total).toBe(1);
    expect(children.branches[0]?.thread.id).toBe('child-thread-id');
    expect(children.branches[0]?.branch.branchPointMessageId).toBe('fork-message-id');
  });

  it('returns empty lineage reads when branching is unsupported', async () => {
    const storage = new InMemoryStore();
    const memoryFactory = vi.fn().mockResolvedValue(await mockMemory(storage, { cloneThread: vi.fn() }));
    const controller = createController({ memory: memoryFactory, storage });

    await controller.init();
    await saveThread(storage, 'source-thread-id');
    const session = await controller.createSession({ id: 'test-session', ownerId: 'test-owner' });

    await expect(session.thread.getParent({ threadId: 'source-thread-id' })).resolves.toBeNull();
    await expect(session.thread.getBranchInfo({ threadId: 'source-thread-id' })).resolves.toBeNull();
    await expect(session.thread.listBranches({ threadId: 'source-thread-id' })).resolves.toMatchObject({
      total: 0,
      branches: [],
    });
  });
});
