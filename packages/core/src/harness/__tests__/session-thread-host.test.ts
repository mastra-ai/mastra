import { describe, expect, it, vi } from 'vitest';

import { Harness } from '../harness';
import { Session, type ThreadDataStore } from '../session';
import { SessionThreadHost, type SessionThreadHostRuntime } from '../thread-host';
import type { HarnessEvent, HarnessThread, TokenUsage } from '../types';

function thread(id: string, updatedAt: Date, input: Partial<HarnessThread> = {}): HarnessThread {
  return {
    id,
    resourceId: input.resourceId ?? 'resource-1',
    title: input.title ?? id,
    createdAt: input.createdAt ?? updatedAt,
    updatedAt,
    metadata: input.metadata,
  };
}

function usage(): TokenUsage {
  return { promptTokens: 1, completionTokens: 2, totalTokens: 3 };
}

function createSession({ threads = [] }: { threads?: HarnessThread[] } = {}) {
  const session = new Session<Record<string, unknown>>({
    resourceId: 'resource-1',
    state: { initialState: { projectPath: '/workspace/project' } },
  });
  session.mode.set({ modeId: 'default' });
  session.mode.setResolver(modeId =>
    modeId === 'default' ? { id: 'default', name: 'Default', defaultModelId: 'model-default' } : null,
  );
  session.thread.connect({
    listThreads: vi.fn(async () => threads),
    getById: vi.fn(async ({ threadId }) => threads.find(candidate => candidate.id === threadId) ?? null),
    listMessages: vi.fn(async () => []),
    firstUserMessages: vi.fn(async () => new Map()),
    getMetadata: vi.fn(async () => undefined),
    setMetadata: vi.fn(async () => undefined),
    deleteMetadata: vi.fn(async () => undefined),
  } satisfies ThreadDataStore);
  return session;
}

function connectHost(
  session: Session<Record<string, unknown>>,
  overrides: Partial<SessionThreadHostRuntime> & {
    storage?: Record<string, any>;
    memory?: Record<string, any>;
    events?: HarnessEvent[];
    log?: string[];
  } = {},
) {
  const events = overrides.events ?? [];
  const log = overrides.log ?? [];
  const storage =
    overrides.storage ??
    ({
      saveThread: vi.fn(async () => undefined),
      getThreadById: vi.fn(async ({ threadId }: { threadId: string }) => thread(threadId, new Date('2026-01-01T00:00:00Z'))),
      deleteThread: vi.fn(async () => undefined),
    } as Record<string, any>);
  const memory =
    overrides.memory ??
    ({
      cloneThread: vi.fn(async () => ({
        thread: thread('thread-clone', new Date('2026-01-02T00:00:00Z'), { title: 'Cloned Thread' }),
      })),
    } as Record<string, any>);
  const runtime: SessionThreadHostRuntime = {
    getMemoryStorage: vi.fn(async () => storage as any),
    resolveMemory: vi.fn(async () => memory as any),
    emit: vi.fn(event => {
      events.push(event);
      log.push(`emit:${event.type}:${'thread' in event ? event.thread.id : 'threadId' in event ? event.threadId : ''}`);
    }),
    generateId: vi.fn(() => 'thread-new'),
    abort: vi.fn(() => log.push('abort')),
    cleanupAgentThreadSubscription: vi.fn(() => log.push('cleanup')),
    ensureCurrentAgentThreadSubscription: vi.fn(async () => log.push(`rebind:${session.thread.getId()}`)),
    loadThreadMetadata: vi.fn(async () => log.push(`load:${session.thread.getId()}`)),
    threadLock: {
      acquire: vi.fn(async threadId => log.push(`lock.acquire:${threadId}`)),
      release: vi.fn(async threadId => log.push(`lock.release:${threadId}`)),
    },
    hasStorage: vi.fn(() => true),
    getProjectPath: vi.fn(() => '/workspace/project'),
    ...overrides,
  };

  session.threadHost.connect(runtime);
  return { runtime, storage, memory, events, log };
}

function createAgentMock() {
  return {
    id: 'agent-1',
    getMastraInstance: vi.fn(() => undefined),
    subscribeToThread: vi.fn(),
  };
}

describe('SessionThreadHost ownership and Harness delegation', () => {
  it('is owned by Session', () => {
    const session = createSession();

    expect(session.threadHost).toBeInstanceOf(SessionThreadHost);
  });

  it('keeps Harness lifecycle methods as delegates to the session-owned ThreadHost', async () => {
    const harness = new Harness({
      id: 'harness-1',
      resourceId: 'resource-1',
      modes: [{ id: 'default', name: 'Default', default: true, agent: createAgentMock() as any }],
    });
    const created = thread('created', new Date('2026-01-01T00:00:00Z'));
    const cloned = thread('cloned', new Date('2026-01-02T00:00:00Z'));
    const selectSpy = vi.spyOn(harness.session.threadHost, 'selectOrCreateThread').mockResolvedValue(created);
    const createSpy = vi.spyOn(harness.session.threadHost, 'createThread').mockResolvedValue(created);
    const switchSpy = vi.spyOn(harness.session.threadHost, 'switchThread').mockResolvedValue(undefined);
    const cloneSpy = vi.spyOn(harness.session.threadHost, 'cloneThread').mockResolvedValue(cloned);
    const deleteSpy = vi.spyOn(harness.session.threadHost, 'deleteThread').mockResolvedValue(undefined);

    await expect(harness.selectOrCreateThread()).resolves.toBe(created);
    await expect(harness.createThread({ title: 'New title' })).resolves.toBe(created);
    await expect(harness.switchThread({ threadId: 'target' })).resolves.toBeUndefined();
    await expect(harness.cloneThread({ sourceThreadId: 'source', title: 'Clone' })).resolves.toBe(cloned);
    await expect(harness.memory.deleteThread({ threadId: 'target' })).resolves.toBeUndefined();

    expect(selectSpy).toHaveBeenCalledWith();
    expect(createSpy).toHaveBeenCalledWith({ title: 'New title' });
    expect(switchSpy).toHaveBeenCalledWith({ threadId: 'target' });
    expect(cloneSpy).toHaveBeenCalledWith({ sourceThreadId: 'source', title: 'Clone' });
    expect(deleteSpy).toHaveBeenCalledWith({ threadId: 'target' });
  });
});

describe('SessionThreadHost lifecycle transitions', () => {
  it('selectOrCreateThread chooses the most recently updated thread and acquires its lock', async () => {
    const older = thread('older', new Date('2026-01-01T00:00:00Z'));
    const newest = thread('newest', new Date('2026-01-03T00:00:00Z'));
    const middle = thread('middle', new Date('2026-01-02T00:00:00Z'));
    const session = createSession({ threads: [older, newest, middle] });
    const { runtime, log } = connectHost(session);

    await expect(session.threadHost.selectOrCreateThread()).resolves.toBe(newest);

    expect(session.thread.getId()).toBe('newest');
    expect(runtime.threadLock?.acquire).toHaveBeenCalledWith('newest');
    expect(runtime.loadThreadMetadata).toHaveBeenCalledTimes(1);
    expect(runtime.ensureCurrentAgentThreadSubscription).toHaveBeenCalledTimes(1);
    expect(log).toEqual(['lock.acquire:newest', 'load:newest', 'rebind:newest']);
  });

  it('createThread saves, sets active thread, emits thread_created, and rebinds the stream', async () => {
    const session = createSession();
    session.thread.set({ threadId: 'old-thread' });
    const events: HarnessEvent[] = [];
    const log: string[] = [];
    const storage = {
      saveThread: vi.fn(async ({ thread: savedThread }: { thread: any }) => log.push(`save:${savedThread.id}`)),
      getThreadById: vi.fn(),
      deleteThread: vi.fn(),
    };
    const { runtime } = connectHost(session, {
      events,
      log,
      storage,
      emit: vi.fn(event => {
        events.push(event);
        log.push(`emit:${event.type}:${session.thread.getId()}`);
      }),
    });

    const created = await session.threadHost.createThread({ title: 'Created thread' });

    expect(created).toMatchObject({ id: 'thread-new', resourceId: 'resource-1', title: 'Created thread' });
    expect(session.thread.getId()).toBe('thread-new');
    expect(storage.saveThread).toHaveBeenCalledWith({
      thread: expect.objectContaining({
        id: 'thread-new',
        resourceId: 'resource-1',
        title: 'Created thread',
        metadata: {
          currentModelId: 'model-default',
          modeModelId_default: 'model-default',
          projectPath: '/workspace/project',
        },
      }),
    });
    expect(events).toEqual([{ type: 'thread_created', thread: created }]);
    expect(runtime.ensureCurrentAgentThreadSubscription).toHaveBeenCalledTimes(1);
    expect(log).toEqual([
      'cleanup',
      'lock.acquire:thread-new',
      'lock.release:old-thread',
      'save:thread-new',
      'emit:thread_created:thread-new',
      'rebind:thread-new',
    ]);
  });

  it('createThread rolls lock and active binding back when saving the new thread fails', async () => {
    const session = createSession();
    session.thread.set({ threadId: 'old-thread' });
    const log: string[] = [];
    const saveError = new Error('save failed');
    const storage = {
      saveThread: vi.fn(async () => {
        log.push('save:thread-new');
        throw saveError;
      }),
      getThreadById: vi.fn(),
      deleteThread: vi.fn(),
    };
    connectHost(session, { log, storage });

    await expect(session.threadHost.createThread()).rejects.toThrow(saveError);

    expect(session.thread.getId()).toBe('old-thread');
    expect(log).toEqual([
      'cleanup',
      'lock.acquire:thread-new',
      'lock.release:old-thread',
      'save:thread-new',
      'lock.release:thread-new',
      'lock.acquire:old-thread',
    ]);
  });

  it('switchThread aborts, cleans up, acquires the new lock before releasing the old, validates, loads metadata, emits, and rebinds', async () => {
    const target = thread('target-thread', new Date('2026-01-01T00:00:00Z'));
    const session = createSession();
    session.thread.set({ threadId: 'old-thread' });
    const events: HarnessEvent[] = [];
    const log: string[] = [];
    const storage = {
      saveThread: vi.fn(),
      getThreadById: vi.fn(async ({ threadId }: { threadId: string }) => {
        log.push(`get:${threadId}`);
        return threadId === target.id ? target : null;
      }),
      deleteThread: vi.fn(),
    };
    connectHost(session, {
      events,
      log,
      storage,
      emit: vi.fn(event => {
        events.push(event);
        log.push(`emit:${event.type}:${session.thread.getId()}`);
      }),
    });

    await session.threadHost.switchThread({ threadId: target.id });

    expect(session.thread.getId()).toBe(target.id);
    expect(events).toEqual([{ type: 'thread_changed', threadId: target.id, previousThreadId: 'old-thread' }]);
    expect(log).toEqual([
      'abort',
      'cleanup',
      'lock.acquire:target-thread',
      'lock.release:old-thread',
      'get:target-thread',
      'load:target-thread',
      'emit:thread_changed:target-thread',
      'rebind:target-thread',
    ]);
  });

  it('deleteThread clears and releases only the current thread before emitting thread_deleted', async () => {
    const session = createSession();
    session.thread.set({ threadId: 'current-thread' });
    session.addUsage(usage());
    const events: HarnessEvent[] = [];
    const log: string[] = [];
    const storage = {
      saveThread: vi.fn(),
      getThreadById: vi.fn(async ({ threadId }: { threadId: string }) => thread(threadId, new Date('2026-01-01T00:00:00Z'))),
      deleteThread: vi.fn(async ({ threadId }: { threadId: string }) => log.push(`delete:${threadId}`)),
    };
    const { runtime } = connectHost(session, { events, log, storage });

    await session.threadHost.deleteThread({ threadId: 'other-thread' });

    expect(session.thread.getId()).toBe('current-thread');
    expect(runtime.threadLock?.release).not.toHaveBeenCalled();
    expect(runtime.cleanupAgentThreadSubscription).not.toHaveBeenCalled();
    expect(events).toEqual([{ type: 'thread_deleted', threadId: 'other-thread' }]);
    expect(log).toEqual(['delete:other-thread', 'emit:thread_deleted:other-thread']);

    events.length = 0;
    log.length = 0;
    vi.clearAllMocks();

    await session.threadHost.deleteThread({ threadId: 'current-thread' });

    expect(session.thread.getId()).toBeNull();
    expect(session.getTokenUsage().totalTokens).toBe(0);
    expect(events).toEqual([{ type: 'thread_deleted', threadId: 'current-thread' }]);
    expect(log).toEqual([
      'delete:current-thread',
      'lock.release:current-thread',
      'cleanup',
      'emit:thread_deleted:current-thread',
    ]);
  });

  it('cloneThread clones through memory, swaps the lock, sets active thread, loads metadata, emits thread_created, and rebinds', async () => {
    const session = createSession();
    session.thread.set({ threadId: 'source-thread' });
    session.addUsage(usage());
    const cloned = thread('cloned-thread', new Date('2026-01-04T00:00:00Z'), { title: 'My clone' });
    const events: HarnessEvent[] = [];
    const log: string[] = [];
    const memory = {
      cloneThread: vi.fn(async input => {
        log.push(`clone:${input.sourceThreadId}:${input.resourceId}:${input.title}`);
        return { thread: cloned };
      }),
    };
    connectHost(session, {
      events,
      log,
      memory,
      emit: vi.fn(event => {
        events.push(event);
        log.push(`emit:${event.type}:${session.thread.getId()}:tokens=${session.getTokenUsage().totalTokens}`);
      }),
    });

    await expect(session.threadHost.cloneThread({ title: 'My clone' })).resolves.toEqual(cloned);

    expect(memory.cloneThread).toHaveBeenCalledWith({
      sourceThreadId: 'source-thread',
      resourceId: 'resource-1',
      title: 'My clone',
    });
    expect(session.thread.getId()).toBe('cloned-thread');
    expect(events).toEqual([{ type: 'thread_created', thread: cloned }]);
    expect(log).toEqual([
      'clone:source-thread:resource-1:My clone',
      'lock.acquire:cloned-thread',
      'lock.release:source-thread',
      'cleanup',
      'load:cloned-thread',
      'emit:thread_created:cloned-thread:tokens=0',
      'rebind:cloned-thread',
    ]);
  });
});
