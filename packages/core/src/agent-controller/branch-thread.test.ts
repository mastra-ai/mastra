import { describe, expect, it, vi } from 'vitest';
import { Agent } from '../agent';
import { MockMemory } from '../memory/mock';
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

/** Memory mock: a real MockMemory over the store, plus the branching surface each test needs. */
async function mockMemory(storage: InMemoryStore, extra: Record<string, unknown>) {
  const memory = new MockMemory({ storage });
  // supportsThreadBranching is a getter on MastraMemory, so a fake that claims
  // support has to override the property rather than assign to it.
  const { supportsThreadBranching, ...rest } = extra as { supportsThreadBranching?: boolean } & Record<string, unknown>;
  if (supportsThreadBranching !== undefined) {
    Object.defineProperty(memory, 'supportsThreadBranching', { value: supportsThreadBranching, configurable: true });
  }
  return Object.assign(memory, rest);
}

async function saveThread(
  storage: InMemoryStore,
  id: string,
  resourceId = 'controller-resource',
  metadata: Record<string, unknown> = {},
) {
  const memoryStore = await storage.getStore('memory');
  await memoryStore.saveThread({
    thread: { id, resourceId, title: `Thread ${id}`, createdAt: now, updatedAt: now, metadata },
  });
}

/** A thread row carrying ready shared-history lineage, as AgentController writes it after a branch is created. */
const READY_BRANCH_METADATA = {
  __mastra_thread_branch: { state: 'ready', parentThreadId: 'source-thread-id' },
};

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

  it("rejects branch and lineage reads on another resource's thread when the controller has only memory", async () => {
    const memoryStorage = new InMemoryStore();
    const branchThread = vi.fn();
    const getThreadParent = vi.fn().mockResolvedValue(null);
    const listThreadBranches = vi
      .fn()
      .mockResolvedValue({ total: 0, page: 0, perPage: false, hasMore: false, branches: [] });
    const memoryFactory = vi.fn().mockResolvedValue(
      await mockMemory(memoryStorage, {
        supportsThreadBranching: true,
        branchThread,
        getThreadParent,
        listThreadBranches,
      }),
    );
    const controller = createController({ memory: memoryFactory });

    await controller.init();
    await saveThread(memoryStorage, 'foreign-thread-id', 'other-resource');
    const session = await controller.createSession({ id: 'test-session', ownerId: 'test-owner' });

    await expect(
      session.thread.branch({ sourceThreadId: 'foreign-thread-id', branchPointMessageId: 'fork-message-id' }),
    ).rejects.toThrow('Thread not found: foreign-thread-id');
    await expect(session.thread.getParent({ threadId: 'foreign-thread-id' })).rejects.toThrow(
      'Thread not found: foreign-thread-id',
    );
    await expect(session.thread.listBranches({ threadId: 'foreign-thread-id' })).rejects.toThrow(
      'Thread not found: foreign-thread-id',
    );
    expect(branchThread).not.toHaveBeenCalled();
    expect(getThreadParent).not.toHaveBeenCalled();
    expect(listThreadBranches).not.toHaveBeenCalled();
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

  it('reads messages and switches to an owned branch thread when controller storage refuses branch rows', async () => {
    const storage = new InMemoryStore();
    const memoryFactory = vi.fn().mockResolvedValue(await mockMemory(storage, { getById: undefined }));
    const controller = createController({ memory: memoryFactory, storage });

    await controller.init();
    await saveThread(storage, 'source-thread-id');
    // The branch row lives only behind memory: controller storage refuses it as a
    // raw-fallback branch row, which used to abort the ownership read outright.
    await saveThread(storage, 'branch-thread-id', 'controller-resource', READY_BRANCH_METADATA);
    const memory = await storage.getStore('memory');
    await memory.saveMessages({
      messages: [
        {
          id: 'branch-message-id',
          threadId: 'branch-thread-id',
          resourceId: 'controller-resource',
          role: 'user',
          createdAt: now,
          content: { format: 2, parts: [{ type: 'text', text: 'hello from the branch' }] },
        } as never,
      ],
    });
    const session = await controller.createSession({ id: 'test-session', ownerId: 'test-owner' });

    await expect(session.thread.listMessages({ threadId: 'branch-thread-id' })).resolves.toHaveLength(1);
    await expect(session.thread.switch({ threadId: 'branch-thread-id' })).resolves.toBeUndefined();
    expect(session.thread.getId()).toBe('branch-thread-id');
  });

  it('still rejects a branch thread owned by another resource', async () => {
    const storage = new InMemoryStore();
    const memoryFactory = vi.fn().mockResolvedValue(await mockMemory(storage, { getById: undefined }));
    const controller = createController({ memory: memoryFactory, storage });

    await controller.init();
    await saveThread(storage, 'foreign-branch-thread-id', 'someone-else', READY_BRANCH_METADATA);
    const session = await controller.createSession({ id: 'test-session', ownerId: 'test-owner' });

    await expect(session.thread.listMessages({ threadId: 'foreign-branch-thread-id' })).rejects.toThrow(
      'Thread not found: foreign-branch-thread-id',
    );
  });

  it('keeps reporting BRANCHING_UNSUPPORTED when neither controller storage nor memory serves the branch row', async () => {
    const storage = new InMemoryStore();
    const controller = createController({ storage });

    await controller.init();
    await saveThread(storage, 'orphan-branch-thread-id', 'controller-resource', READY_BRANCH_METADATA);
    const session = await controller.createSession({ id: 'test-session', ownerId: 'test-owner' });

    await expect(session.thread.listMessages({ threadId: 'orphan-branch-thread-id' })).rejects.toMatchObject({
      id: 'BRANCHING_UNSUPPORTED',
    });
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
