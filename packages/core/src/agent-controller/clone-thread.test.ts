import { describe, expect, it, vi } from 'vitest';
import { Agent } from '../agent';
import { MockMemory } from '../memory/mock';
import { RequestContext } from '../request-context';
import { InMemoryStore } from '../storage/mock';
import { AgentController } from './agent-controller';
import { createMockWorkspace } from './test-utils';

describe('AgentController cloneThread', () => {
  it('prefers session-aware dynamic memory over configured storage when cloning', async () => {
    const now = new Date('2026-01-01T00:00:00.000Z');
    const storage = new InMemoryStore();
    const cloneThread = vi.fn().mockResolvedValue({
      thread: {
        id: 'cloned-thread-id',
        resourceId: 'target-resource',
        title: 'Cloned title',
        createdAt: now,
        updatedAt: now,
        metadata: {},
      },
      clonedMessages: [],
      messageIdMap: {},
    });
    let resolvedControllerContext: any;
    const memoryFactory = vi.fn().mockImplementation(({ requestContext }) => {
      resolvedControllerContext = requestContext.get('controller');
      return Object.assign(new MockMemory(), { cloneThread });
    });

    const controller = new AgentController({
      workspace: createMockWorkspace(),
      id: 'test-controller',
      resourceId: 'controller-resource',
      storage,
      initialState: { memoryProfile: 'session-profile' },
      memory: memoryFactory as any,
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
    const memoryStore = await storage.getStore('memory');
    await memoryStore.saveThread({
      thread: {
        id: 'source-thread-id',
        resourceId: 'controller-resource',
        title: 'Source title',
        createdAt: now,
        updatedAt: now,
        metadata: {},
      },
    });
    const storageCloneThread = vi.spyOn(memoryStore, 'cloneThread');
    const session = await controller.createSession({ id: 'test-session', ownerId: 'test-owner' });
    // The new session's history subscription resolves memory once.
    expect(memoryFactory).toHaveBeenCalledTimes(1);

    const cloned = await session.thread.clone({
      sourceThreadId: 'source-thread-id',
      title: 'New title',
      resourceId: 'target-resource',
    });

    // Once for the clone, and once per history subscription: the new session's thread and the clone.
    expect(memoryFactory).toHaveBeenCalledTimes(3);
    expect(resolvedControllerContext).toMatchObject({
      controllerId: 'test-controller',
      state: { memoryProfile: 'session-profile' },
      session: { id: 'test-session', ownerId: 'test-owner' },
    });
    expect(cloneThread).toHaveBeenCalledWith({
      sourceThreadId: 'source-thread-id',
      resourceId: 'target-resource',
      title: 'New title',
      metadata: { ownerId: 'test-owner', createdBy: 'test-owner' },
    });
    expect(storageCloneThread).not.toHaveBeenCalled();
    expect(cloned.id).toBe('cloned-thread-id');
    expect(cloned.resourceId).toBe('target-resource');
  });

  it("resolves dynamic memory with the caller's request context when cloning", async () => {
    const now = new Date('2026-01-01T00:00:00.000Z');
    const storage = new InMemoryStore();
    // The caller's copy of the clone lives only in that caller's store, so the
    // post-clone history subscription finds it only when it resolves memory
    // with the same caller.
    const callerStorage = new InMemoryStore();
    let cloningUser: unknown;
    const recalled: Promise<{ messages: { id: string }[] }>[] = [];
    const memoryFactory = vi.fn().mockImplementation(({ requestContext }) => {
      const user = requestContext.get('user') as { id: string } | undefined;
      const memory = new MockMemory({ storage: user?.id === 'user-1' ? callerStorage : storage });
      const recall = memory.recall.bind(memory);
      return Object.assign(memory, {
        recall: (args: Parameters<typeof recall>[0]) => {
          const result = recall(args);
          if (args.threadId === 'c') recalled.push(result as any);
          return result;
        },
        cloneThread: vi.fn().mockImplementation(async () => {
          cloningUser = user;
          return {
            thread: { id: 'c', resourceId: 'controller-resource', createdAt: now, updatedAt: now, metadata: {} },
            clonedMessages: [],
            messageIdMap: {},
          };
        }),
      });
    });
    const controller = new AgentController({
      workspace: createMockWorkspace(),
      id: 'test-controller',
      resourceId: 'controller-resource',
      storage,
      memory: memoryFactory as any,
      modes: [
        {
          id: 'default',
          name: 'Default',
          default: true,
          agent: new Agent({
            id: 'a',
            name: 'a',
            instructions: 'x',
            model: { provider: 'openai', name: 'gpt-4o' } as any,
          }),
        },
      ],
    });
    await controller.init();
    const memoryStore = await storage.getStore('memory');
    await memoryStore!.saveThread({
      thread: { id: 'src', resourceId: 'controller-resource', createdAt: now, updatedAt: now, metadata: {} },
    });
    const callerStore = await callerStorage.getStore('memory');
    await callerStore!.saveThread({
      thread: { id: 'c', resourceId: 'controller-resource', createdAt: now, updatedAt: now, metadata: {} },
    });
    await callerStore!.saveMessages({
      messages: [
        {
          id: 'copied-message',
          threadId: 'c',
          resourceId: 'controller-resource',
          role: 'user',
          createdAt: now,
          content: { format: 2, parts: [{ type: 'text', text: 'copied' }] },
        },
      ],
    });
    const session = await controller.createSession({ id: 's', ownerId: 'o' });

    const requestContext = new RequestContext();
    requestContext.set('user', { id: 'user-1' });
    await session.thread.clone({ sourceThreadId: 'src', requestContext });

    expect(cloningUser).toEqual({ id: 'user-1' });
    // The subscription opened on the clone loaded the copied history.
    expect(recalled).toHaveLength(1);
    expect((await recalled[0]!).messages.map(m => m.id)).toEqual(['copied-message']);
    // The clone row is visible to controller-side thread reads, so the caller
    // can switch back to it after leaving.
    expect(await session.thread.getById({ threadId: 'c' })).toMatchObject({ id: 'c' });
    await session.thread.create({ requestContext });
    await expect(session.thread.switch({ threadId: 'c', requestContext })).resolves.not.toThrow();

    // Deleting the clone removes it from the caller's store too, so its
    // messages are not orphaned there.
    await session.thread.delete({ threadId: 'c', requestContext });
    expect(await memoryStore!.getThreadById({ threadId: 'c' })).toBeNull();
    expect(await callerStore!.getThreadById({ threadId: 'c' })).toBeNull();
    expect((await callerStore!.listMessages({ threadId: 'c' })).messages).toEqual([]);
  });

  it('removes the caller-side clone when mirroring its row to controller storage fails', async () => {
    const now = new Date('2026-01-01T00:00:00.000Z');
    const storage = new InMemoryStore();
    const callerStorage = new InMemoryStore();
    const controller = new AgentController({
      workspace: createMockWorkspace(),
      id: 'test-controller',
      resourceId: 'controller-resource',
      storage,
      memory: (() => new MockMemory({ storage: callerStorage })) as any,
      modes: [
        {
          id: 'default',
          name: 'Default',
          default: true,
          agent: new Agent({
            id: 'a',
            name: 'a',
            instructions: 'x',
            model: { provider: 'openai', name: 'gpt-4o' } as any,
          }),
        },
      ],
    });
    await controller.init();
    const memoryStore = await storage.getStore('memory');
    const callerStore = await callerStorage.getStore('memory');
    for (const store of [memoryStore!, callerStore!]) {
      await store.saveThread({
        thread: { id: 'src', resourceId: 'controller-resource', createdAt: now, updatedAt: now, metadata: {} },
      });
    }
    const session = await controller.createSession({ id: 's', ownerId: 'o' });
    vi.spyOn(memoryStore!, 'saveThread').mockRejectedValue(new Error('controller write failed'));

    await expect(session.thread.clone({ sourceThreadId: 'src' })).rejects.toThrow('controller write failed');

    const { threads } = await callerStore!.listThreads({ filter: { resourceId: 'controller-resource' } });
    expect(threads.map(t => t.id)).toEqual(['src']);
  });

  it('uses the raw memory storage clone when configured memory is absent', async () => {
    const now = new Date('2026-01-01T00:00:00.000Z');
    const storage = new InMemoryStore();
    const controller = new AgentController({
      workspace: createMockWorkspace(),
      id: 'test-controller',
      resourceId: 'controller-resource',
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
    const memoryStore = await storage.getStore('memory');
    await memoryStore.saveThread({
      thread: {
        id: 'source-thread-id',
        resourceId: 'controller-resource',
        title: 'Source title',
        createdAt: now,
        updatedAt: now,
        metadata: {},
      },
    });
    const storageCloneThread = vi.spyOn(memoryStore, 'cloneThread');
    const session = await controller.createSession({ id: 'test-session', ownerId: 'test-owner' });

    const cloned = await session.thread.clone({
      sourceThreadId: 'source-thread-id',
      title: 'Storage clone',
      resourceId: 'target-resource',
    });

    expect(storageCloneThread).toHaveBeenCalledWith({
      sourceThreadId: 'source-thread-id',
      resourceId: 'target-resource',
      title: 'Storage clone',
      metadata: { ownerId: 'test-owner', createdBy: 'test-owner' },
    });
    expect(cloned.id).not.toBe('source-thread-id');
    expect(cloned.resourceId).toBe('target-resource');
    expect(cloned.title).toBe('Storage clone');
  });

  describe('carrying memory without the old messages', () => {
    const old = new Date('2026-01-01T00:00:00.000Z');
    const message = (id: string, threadId: string, resourceId: string) => ({
      id,
      threadId,
      resourceId,
      role: 'user' as const,
      createdAt: old,
      content: { format: 2 as const, parts: [{ type: 'text' as const, text: id }] },
    });
    const setup = async () => {
      const storage = new InMemoryStore();
      const controller = new AgentController({
        workspace: createMockWorkspace(),
        id: 'test-controller',
        resourceId: 'controller-resource',
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
      const memoryStore = (await storage.getStore('memory'))!;
      const session = await controller.createSession({ id: 'test-session', ownerId: 'test-owner' });
      return { memoryStore, session };
    };

    it('clone copies only the messages the filter keeps and stamps the given metadata', async () => {
      const { memoryStore, session } = await setup();
      await memoryStore.saveThread({
        thread: {
          id: 'src',
          resourceId: 'controller-resource',
          createdAt: old,
          updatedAt: old,
          metadata: { projectPath: '/old/home' },
        },
      });
      await memoryStore.saveMessages({
        messages: [message('m1', 'src', 'controller-resource'), message('m2', 'src', 'controller-resource')],
      });

      const cloned = await session.thread.clone({
        sourceThreadId: 'src',
        title: 'New member',
        metadata: { projectPath: '/new/home' },
        options: { messageFilter: { startDate: new Date('2026-02-01T00:00:00.000Z') } },
      });

      expect((await memoryStore.listMessages({ threadId: cloned.id })).messages).toEqual([]);
      expect(cloned.metadata).toMatchObject({ projectPath: '/new/home', ownerId: 'test-owner' });
      expect(session.thread.getId()).toBe(cloned.id);
      // The source keeps its messages.
      expect((await memoryStore.listMessages({ threadId: 'src' })).messages).toHaveLength(2);
    });

    it('clone copies only the messages a partial filter keeps, in order', async () => {
      const { memoryStore, session } = await setup();
      await memoryStore.saveThread({
        thread: { id: 'src', resourceId: 'controller-resource', createdAt: old, updatedAt: old },
      });
      const later = (id: string, at: string) => ({
        ...message(id, 'src', 'controller-resource'),
        createdAt: new Date(at),
      });
      await memoryStore.saveMessages({
        messages: [
          later('m1', '2026-01-01T00:00:00.000Z'),
          later('m2', '2026-02-01T00:00:00.000Z'),
          later('m3', '2026-03-01T00:00:00.000Z'),
        ],
      });

      const cloned = await session.thread.clone({
        sourceThreadId: 'src',
        options: { messageFilter: { startDate: new Date('2026-01-15T00:00:00.000Z') } },
      });

      const copied = (await memoryStore.listMessages({ threadId: cloned.id })).messages;
      expect(copied.map(m => (m.content.parts[0] as { text: string }).text)).toEqual(['m2', 'm3']);
      expect(copied.every(m => m.threadId === cloned.id)).toBe(true);
    });

    it.each([
      ['an empty filter', { messageFilter: {} }],
      ['a limit', { messageLimit: 1 }],
    ])('clone refuses fullThread with %s before anything is copied', async (_, selection) => {
      const { memoryStore, session } = await setup();
      await memoryStore.saveThread({
        thread: { id: 'src', resourceId: 'controller-resource', createdAt: old, updatedAt: old },
      });
      await memoryStore.saveMessages({ messages: [message('m1', 'src', 'controller-resource')] });
      const copy = vi.spyOn(memoryStore, 'cloneThread');

      await expect(
        session.thread.clone({ sourceThreadId: 'src', options: { fullThread: true, ...selection } }),
      ).rejects.toThrow(/fullThread/);

      expect(copy).not.toHaveBeenCalled();
      expect((await memoryStore.listThreads({ filter: { resourceId: 'controller-resource' } })).threads).toHaveLength(
        1,
      );
    });

    it('cloneToCurrentResource refuses fullThread with a filter before anything is copied', async () => {
      const { memoryStore, session } = await setup();
      await memoryStore.saveThread({
        thread: {
          id: 'other',
          resourceId: 'other-resource',
          createdAt: old,
          updatedAt: old,
          metadata: { projectPath: '/old/home' },
        },
      });
      const copy = vi.spyOn(memoryStore, 'cloneThread');

      await expect(
        session.thread.cloneToCurrentResource({
          threadId: 'other',
          expectedResourceId: 'other-resource',
          expectedProjectPath: '/old/home',
          options: { fullThread: true, messageFilter: { startDate: old } },
        }),
      ).rejects.toThrow(/fullThread/);

      expect(copy).not.toHaveBeenCalled();
    });

    it('clone through raw storage copies every message for fullThread and keeps it out of the storage call', async () => {
      const { memoryStore, session } = await setup();
      await memoryStore.saveThread({
        thread: { id: 'src', resourceId: 'controller-resource', createdAt: old, updatedAt: old },
      });
      await memoryStore.saveMessages({
        messages: [message('m1', 'src', 'controller-resource'), message('m2', 'src', 'controller-resource')],
      });
      const copy = vi.spyOn(memoryStore, 'cloneThread');

      const cloned = await session.thread.clone({ sourceThreadId: 'src', options: { fullThread: true } });

      expect(copy.mock.calls[0]![0].options).toEqual({});
      expect((await memoryStore.listMessages({ threadId: cloned.id })).messages).toHaveLength(2);
    });

    it('cloneToCurrentResource uses the given metadata instead of the source thread’s and filters messages', async () => {
      const { memoryStore, session } = await setup();
      await memoryStore.saveThread({
        thread: {
          id: 'other',
          resourceId: 'other-resource',
          title: 'Old member',
          createdAt: old,
          updatedAt: old,
          metadata: { projectPath: '/old/home', sandboxAllowedPaths: ['/old/home/worktrees'] },
        },
      });
      await memoryStore.saveMessages({ messages: [message('o1', 'other', 'other-resource')] });

      const cloned = await session.thread.cloneToCurrentResource({
        threadId: 'other',
        expectedResourceId: 'other-resource',
        expectedProjectPath: '/old/home',
        metadata: { projectPath: '/new/home' },
        options: { messageFilter: { startDate: new Date('2026-02-01T00:00:00.000Z') } },
      });

      expect(cloned.resourceId).toBe('controller-resource');
      expect(cloned.metadata?.projectPath).toBe('/new/home');
      expect(cloned.metadata?.sandboxAllowedPaths).toBeUndefined();
      expect((await memoryStore.listMessages({ threadId: cloned.id })).messages).toEqual([]);
    });

    it('cloneToCurrentResource still copies the source metadata and every message when given neither', async () => {
      const { memoryStore, session } = await setup();
      await memoryStore.saveThread({
        thread: {
          id: 'other',
          resourceId: 'other-resource',
          createdAt: old,
          updatedAt: old,
          metadata: { projectPath: '/old/home' },
        },
      });
      await memoryStore.saveMessages({ messages: [message('o1', 'other', 'other-resource')] });

      const cloned = await session.thread.cloneToCurrentResource({
        threadId: 'other',
        expectedResourceId: 'other-resource',
        expectedProjectPath: '/old/home',
      });

      expect(cloned.metadata?.projectPath).toBe('/old/home');
      expect((await memoryStore.listMessages({ threadId: cloned.id })).messages).toHaveLength(1);
    });
  });

  it('throws when dynamic memory factory returns empty value', async () => {
    const controller = new AgentController({
      workspace: createMockWorkspace(),
      id: 'test-controller',
      memory: vi.fn().mockResolvedValue(undefined) as unknown as any,
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

    // The session's history subscription resolves memory, so the empty factory surfaces there.
    await expect(controller.createSession({ id: 'test-session', ownerId: 'test-owner' })).rejects.toThrow(
      'Function-based memory returned empty value',
    );
  });

  it.each([
    ['a separate caller store that never had the thread', false],
    ['memory backed by the controller store itself', true],
  ])('deletes a thread when resolved memory is %s, with adapters that throw on missing threads', async (_, same) => {
    const storage = new InMemoryStore();
    const callerStorage = same ? storage : new InMemoryStore();
    for (const store of new Set([storage, callerStorage])) {
      const memoryStore = (await store.getStore('memory'))!;
      const deleteThread = memoryStore.deleteThread.bind(memoryStore);
      memoryStore.deleteThread = async args => {
        if (!(await memoryStore.getThreadById(args))) throw new Error(`Thread ${args.threadId} not found`);
        return deleteThread(args);
      };
    }
    const controller = new AgentController({
      workspace: createMockWorkspace(),
      id: 'test-controller',
      resourceId: 'controller-resource',
      storage,
      memory: (() => new MockMemory({ storage: callerStorage })) as any,
      modes: [
        {
          id: 'default',
          name: 'Default',
          default: true,
          agent: new Agent({
            id: 'a',
            name: 'a',
            instructions: 'x',
            model: { provider: 'openai', name: 'gpt-4o' } as any,
          }),
        },
      ],
    });
    await controller.init();
    const session = await controller.createSession({ id: 's', ownerId: 'o' });
    const thread = await session.thread.create();
    await session.thread.create();

    await session.thread.delete({ threadId: thread.id });

    const memoryStore = await storage.getStore('memory');
    expect(await memoryStore!.getThreadById({ threadId: thread.id })).toBeNull();
  });
});
