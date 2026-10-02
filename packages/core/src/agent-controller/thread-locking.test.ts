import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Agent } from '../agent';
import { InMemoryStore } from '../storage/mock';
import { AgentController } from './agent-controller';
import type { Session } from './session';
import { createMockWorkspace } from './test-utils';

function createController(threadLock?: { acquire: (id: string) => void; release: (id: string) => void }) {
  const agent = new Agent({
    name: 'test-agent',
    instructions: 'You are a test agent.',
    model: { provider: 'openai', name: 'gpt-4o', toolChoice: 'auto' },
  });

  return new AgentController({
    workspace: createMockWorkspace(),
    id: 'test-controller',
    storage: new InMemoryStore(),
    modes: [{ id: 'default', name: 'Default', default: true, agent }],
    threadLock,
  });
}

describe('AgentController thread locking', () => {
  let acquire: ReturnType<typeof vi.fn>;
  let release: ReturnType<typeof vi.fn>;
  let controller: ReturnType<typeof createController>;
  let session: Session;

  beforeEach(async () => {
    acquire = vi.fn();
    release = vi.fn();
    controller = createController({ acquire, release });
    await controller.init();
    session = await controller.createSession({ id: 'test-session', ownerId: 'test-owner' });
    // createSession() acquires a lock for its auto-created starter thread.
    // Reset the spies so each test observes only its own lock activity.
    acquire.mockClear();
    release.mockClear();
  });

  describe('createThread', () => {
    it('acquires lock on the new thread', async () => {
      const thread = await session.thread.create();
      expect(acquire).toHaveBeenCalledWith(thread.id);
    });

    it('releases lock on previous thread when creating a new one', async () => {
      const first = await session.thread.create();
      acquire.mockClear();
      release.mockClear();

      const second = await session.thread.create();
      expect(release).toHaveBeenCalledWith(first.id);
      expect(acquire).toHaveBeenCalledWith(second.id);
    });

    it('acquire is called before release on createThread', async () => {
      await session.thread.create();
      const callOrder: string[] = [];
      release.mockImplementation(() => callOrder.push('release'));
      acquire.mockImplementation(() => callOrder.push('acquire'));

      await session.thread.create();
      expect(callOrder).toEqual(['acquire', 'release']);
    });

    it('re-acquires old lock if acquire on new thread fails', async () => {
      const first = await session.thread.create();
      acquire.mockClear();
      release.mockClear();

      acquire.mockImplementationOnce(() => {
        throw new Error('Thread is locked');
      });

      await expect(session.thread.create()).rejects.toThrow('Thread is locked');
      // Should have attempted to re-acquire the old thread's lock
      expect(acquire).toHaveBeenCalledTimes(2); // failed new + re-acquire old
      expect(acquire).toHaveBeenLastCalledWith(first.id);
      // Old thread lock was never released
      expect(release).not.toHaveBeenCalled();
    });

    it('waits for an async acquire promise before releasing previous thread lock', async () => {
      await session.thread.create();
      acquire.mockClear();
      release.mockClear();

      let resolveAcquire: (() => void) | undefined;
      acquire.mockImplementationOnce(
        () =>
          new Promise<void>(resolve => {
            resolveAcquire = resolve;
          }),
      );

      const createThreadPromise = session.thread.create();
      await Promise.resolve();

      expect(release).not.toHaveBeenCalled();
      resolveAcquire?.();

      await createThreadPromise;
      expect(release).toHaveBeenCalledTimes(1);
    });
  });

  describe('switchThread', () => {
    it('acquires lock on the target thread', async () => {
      const thread = await session.thread.create({ title: 'thread-a' });
      await session.thread.create({ title: 'thread-b' });
      acquire.mockClear();
      release.mockClear();

      await session.thread.switch({ threadId: thread.id });
      expect(acquire).toHaveBeenCalledWith(thread.id);
    });

    it('releases lock on previous thread', async () => {
      const first = await session.thread.create({ title: 'first' });
      const second = await session.thread.create({ title: 'second' });
      acquire.mockClear();
      release.mockClear();

      await session.thread.switch({ threadId: first.id });
      expect(release).toHaveBeenCalledWith(second.id);
      expect(acquire).toHaveBeenCalledWith(first.id);
    });

    it('acquire is called before release on switchThread', async () => {
      const threadA = await session.thread.create({ title: 'first' });
      await session.thread.create({ title: 'second' });
      const callOrder: string[] = [];
      release.mockImplementation(() => callOrder.push('release'));
      acquire.mockImplementation(() => callOrder.push('acquire'));

      await session.thread.switch({ threadId: threadA.id });
      expect(callOrder).toEqual(['acquire', 'release']);
    });

    it('propagates errors from acquire (e.g., lock conflict)', async () => {
      const threadA = await session.thread.create({ title: 'first' });
      await session.thread.create({ title: 'second' });

      acquire.mockImplementation(() => {
        throw new Error('Thread is locked by another process');
      });

      await expect(session.thread.switch({ threadId: threadA.id })).rejects.toThrow(
        'Thread is locked by another process',
      );
    });

    it('waits for an async release promise before resolving switchThread', async () => {
      const first = await session.thread.create({ title: 'first' });
      await session.thread.create({ title: 'second' });
      acquire.mockClear();
      release.mockClear();

      let resolveRelease: (() => void) | undefined;
      release.mockImplementationOnce(
        () =>
          new Promise<void>(resolve => {
            resolveRelease = resolve;
          }),
      );

      let settled = false;
      const switchPromise = session.thread.switch({ threadId: first.id }).then(() => {
        settled = true;
      });
      await Promise.resolve();

      expect(settled).toBe(false);
      expect(acquire).toHaveBeenCalledWith(first.id);

      resolveRelease?.();
      await switchPromise;

      expect(settled).toBe(true);
    });
  });

  describe('createSession thread selection', () => {
    function freshController(store: InMemoryStore) {
      const agent = new Agent({
        name: 'test-agent',
        instructions: 'You are a test agent.',
        model: { provider: 'openai', name: 'gpt-4o', toolChoice: 'auto' },
      });
      return new AgentController({
        workspace: createMockWorkspace(),
        id: 'test-controller',
        storage: store,
        modes: [{ id: 'default', name: 'Default', default: true, agent }],
        threadLock: { acquire, release },
      });
    }

    it('resumes and locks the most recent thread for the same resourceId', async () => {
      const store = new InMemoryStore();

      // First session creates a thread for resource "user-1".
      const controllerA = freshController(store);
      await controllerA.init();
      const sessionA = await controllerA.createSession({
        id: 'session-a',
        ownerId: 'test-owner',
        resourceId: 'user-1',
      });
      const existing = sessionA.thread.getId();
      expect(existing).toBeDefined();

      acquire.mockClear();
      release.mockClear();

      // A second session for the same resourceId should resume that thread.
      const controllerB = freshController(store);
      await controllerB.init();
      const sessionB = await controllerB.createSession({
        id: 'session-b',
        ownerId: 'test-owner',
        resourceId: 'user-1',
      });

      expect(sessionB.thread.getId()).toBe(existing);
      expect(acquire).toHaveBeenCalledWith(existing);
    });

    it('creates a fresh thread for a different resourceId', async () => {
      const store = new InMemoryStore();

      const controllerA = freshController(store);
      await controllerA.init();
      const sessionA = await controllerA.createSession({
        id: 'session-a',
        ownerId: 'test-owner',
        resourceId: 'user-1',
      });
      const existing = sessionA.thread.getId();

      acquire.mockClear();

      // A session for a different resourceId must not resume user-1's thread.
      const controllerB = freshController(store);
      await controllerB.init();
      const sessionB = await controllerB.createSession({
        id: 'session-b',
        ownerId: 'test-owner',
        resourceId: 'user-2',
      });

      expect(sessionB.thread.getId()).not.toBe(existing);
      expect(acquire).toHaveBeenCalledWith(sessionB.thread.getId());
    });

    it('acquires lock when creating a new thread (no existing threads)', async () => {
      const store = new InMemoryStore();
      const controller = freshController(store);
      await controller.init();

      acquire.mockClear();
      const newSession = await controller.createSession({ id: 'test-session', ownerId: 'test-owner' });
      expect(acquire).toHaveBeenCalledWith(newSession.thread.getId());
    });

    it('scopes initial thread selection to tags so worktrees stay isolated', async () => {
      const store = new InMemoryStore();

      // Two worktrees of the same repo share one resourceId but live at
      // different paths. Each session is created with its own projectPath tag.
      const controllerA = freshController(store);
      await controllerA.init();
      const sessionA = await controllerA.createSession({
        id: 'session-a',
        ownerId: 'test-owner',
        resourceId: 'repo',
        tags: { projectPath: '/repo/worktree-a' },
      });
      const threadA = sessionA.thread.getId();
      expect(threadA).toBeDefined();

      const controllerB = freshController(store);
      await controllerB.init();
      const sessionB = await controllerB.createSession({
        id: 'session-b',
        ownerId: 'test-owner',
        resourceId: 'repo',
        tags: { projectPath: '/repo/worktree-b' },
      });
      const threadB = sessionB.thread.getId();

      // worktree-b must NOT claim worktree-a's most-recent thread.
      expect(threadB).not.toBe(threadA);

      // Reconnecting to worktree-a resumes its own thread, not worktree-b's.
      const controllerA2 = freshController(store);
      await controllerA2.init();
      const sessionA2 = await controllerA2.createSession({
        id: 'session-a2',
        ownerId: 'test-owner',
        resourceId: 'repo',
        tags: { projectPath: '/repo/worktree-a' },
      });
      expect(sessionA2.thread.getId()).toBe(threadA);

      // The tags are stamped onto the thread metadata (not just used for
      // selection), so listings can filter threads back to their scope.
      const threadsA = await sessionA2.thread.list();
      const resumed = threadsA.find(t => t.id === threadA);
      expect((resumed?.metadata as Record<string, unknown> | undefined)?.projectPath).toBe('/repo/worktree-a');
    });

    it('stamps every tag onto created threads (multi-dimensional scope)', async () => {
      const store = new InMemoryStore();
      const controller = freshController(store);
      await controller.init();
      const session = await controller.createSession({
        id: 'multi',
        ownerId: 'test-owner',
        resourceId: 'repo',
        tags: { projectPath: '/repo/wt', branch: 'feat/x' },
      });

      const threadId = session.thread.getId();
      const threads = await session.thread.list();
      const created = threads.find(t => t.id === threadId);
      const metadata = (created?.metadata as Record<string, unknown> | undefined) ?? {};
      expect(metadata.projectPath).toBe('/repo/wt');
      expect(metadata.branch).toBe('feat/x');
    });
  });

  describe('deleteThread', () => {
    it('deletes a thread from storage', async () => {
      const thread = await session.thread.create({ title: 'to-delete' });
      await session.thread.delete({ threadId: thread.id });

      const threads = await session.thread.list();
      expect(threads.find(t => t.id === thread.id)).toBeUndefined();
    });

    it('releases lock when deleting the current thread', async () => {
      const thread = await session.thread.create({ title: 'current' });
      acquire.mockClear();
      release.mockClear();

      await session.thread.delete({ threadId: thread.id });
      expect(release).toHaveBeenCalledWith(thread.id);
    });

    it('clears currentThreadId when deleting the current thread', async () => {
      const thread = await session.thread.create({ title: 'current' });
      expect(session.thread.getId()).toBe(thread.id);

      await session.thread.delete({ threadId: thread.id });
      expect(session.thread.getId()).toBeNull();
    });

    it('does not release lock when deleting a non-current thread', async () => {
      const first = await session.thread.create({ title: 'first' });
      const second = await session.thread.create({ title: 'second' });
      release.mockClear();

      await session.thread.delete({ threadId: first.id });
      // Should not release lock since first is not the current thread (second is)
      expect(release).not.toHaveBeenCalled();
      expect(session.thread.getId()).toBe(second.id);
    });

    it('throws when thread does not exist', async () => {
      await expect(session.thread.delete({ threadId: 'nonexistent' })).rejects.toThrow('Thread not found');
    });

    it('emits thread_deleted event', async () => {
      const events: string[] = [];
      session.subscribe(event => {
        if (event.type === 'thread_deleted') events.push(event.threadId);
      });

      const thread = await session.thread.create({ title: 'to-delete' });
      await session.thread.delete({ threadId: thread.id });
      expect(events).toEqual([thread.id]);
    });
  });

  describe('without threadLock config', () => {
    it('works normally without locking', async () => {
      const unlocked = createController(); // no threadLock
      await unlocked.init();
      const unlockedSession = await unlocked.createSession({ id: 'unlocked-session', ownerId: 'test-owner' });

      const threadA = await unlockedSession.thread.create({ title: 'test' });
      await unlockedSession.thread.create({ title: 'test2' });
      await unlockedSession.thread.switch({ threadId: threadA.id });
      // No errors thrown — locking is optional
    });
  });
});
