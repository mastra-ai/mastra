import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Agent } from '../agent';
import { InMemoryStore } from '../storage/mock';
import { Harness } from './harness';
import type { Session } from './session';

function createHarness(threadLock?: { acquire: (id: string) => void; release: (id: string) => void }) {
  const agent = new Agent({
    name: 'test-agent',
    instructions: 'You are a test agent.',
    model: { provider: 'openai', name: 'gpt-4o', toolChoice: 'auto' },
  });

  return new Harness({
    id: 'test-harness',
    storage: new InMemoryStore(),
    modes: [{ id: 'default', name: 'Default', default: true, agent }],
    threadLock,
  });
}

describe('Harness thread locking', () => {
  let acquire: ReturnType<typeof vi.fn>;
  let release: ReturnType<typeof vi.fn>;
  let harness: ReturnType<typeof createHarness>;
  let session: Session;

  beforeEach(async () => {
    acquire = vi.fn();
    release = vi.fn();
    harness = createHarness({ acquire, release });
    await harness.init();
    session = await harness.createSession({ id: 'test-session', ownerId: 'test-owner' });
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
    function freshHarness(store: InMemoryStore) {
      const agent = new Agent({
        name: 'test-agent',
        instructions: 'You are a test agent.',
        model: { provider: 'openai', name: 'gpt-4o', toolChoice: 'auto' },
      });
      return new Harness({
        id: 'test-harness',
        storage: store,
        modes: [{ id: 'default', name: 'Default', default: true, agent }],
        threadLock: { acquire, release },
      });
    }

    it('resumes and locks the most recent thread for the same resourceId', async () => {
      const store = new InMemoryStore();

      // First session creates a thread for resource "user-1".
      const harnessA = freshHarness(store);
      await harnessA.init();
      const sessionA = await harnessA.createSession({ id: 'session-a', ownerId: 'test-owner', resourceId: 'user-1' });
      const existing = sessionA.thread.getId();
      expect(existing).toBeDefined();

      acquire.mockClear();
      release.mockClear();

      // A second session for the same resourceId should resume that thread.
      const harnessB = freshHarness(store);
      await harnessB.init();
      const sessionB = await harnessB.createSession({ id: 'session-b', ownerId: 'test-owner', resourceId: 'user-1' });

      expect(sessionB.thread.getId()).toBe(existing);
      expect(acquire).toHaveBeenCalledWith(existing);
    });

    it('creates a fresh thread for a different resourceId', async () => {
      const store = new InMemoryStore();

      const harnessA = freshHarness(store);
      await harnessA.init();
      const sessionA = await harnessA.createSession({ id: 'session-a', ownerId: 'test-owner', resourceId: 'user-1' });
      const existing = sessionA.thread.getId();

      acquire.mockClear();

      // A session for a different resourceId must not resume user-1's thread.
      const harnessB = freshHarness(store);
      await harnessB.init();
      const sessionB = await harnessB.createSession({ id: 'session-b', ownerId: 'test-owner', resourceId: 'user-2' });

      expect(sessionB.thread.getId()).not.toBe(existing);
      expect(acquire).toHaveBeenCalledWith(sessionB.thread.getId());
    });

    it('acquires lock when creating a new thread (no existing threads)', async () => {
      const store = new InMemoryStore();
      const harness = freshHarness(store);
      await harness.init();

      acquire.mockClear();
      const newSession = await harness.createSession({ id: 'test-session', ownerId: 'test-owner' });
      expect(acquire).toHaveBeenCalledWith(newSession.thread.getId());
    });

    it('scopes initial thread selection to tags so worktrees stay isolated', async () => {
      const store = new InMemoryStore();

      // Two worktrees of the same repo share one resourceId but live at
      // different paths. Each session is created with its own projectPath tag.
      const harnessA = freshHarness(store);
      await harnessA.init();
      const sessionA = await harnessA.createSession({
        id: 'session-a',
        ownerId: 'test-owner',
        resourceId: 'repo',
        tags: { projectPath: '/repo/worktree-a' },
      });
      const threadA = sessionA.thread.getId();
      expect(threadA).toBeDefined();

      const harnessB = freshHarness(store);
      await harnessB.init();
      const sessionB = await harnessB.createSession({
        id: 'session-b',
        ownerId: 'test-owner',
        resourceId: 'repo',
        tags: { projectPath: '/repo/worktree-b' },
      });
      const threadB = sessionB.thread.getId();

      // worktree-b must NOT claim worktree-a's most-recent thread.
      expect(threadB).not.toBe(threadA);

      // Reconnecting to worktree-a resumes its own thread, not worktree-b's.
      const harnessA2 = freshHarness(store);
      await harnessA2.init();
      const sessionA2 = await harnessA2.createSession({
        id: 'session-a2',
        ownerId: 'test-owner',
        resourceId: 'repo',
        tags: { projectPath: '/repo/worktree-a' },
      });
      expect(sessionA2.thread.getId()).toBe(threadA);
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
      const unlocked = createHarness(); // no threadLock
      await unlocked.init();
      const unlockedSession = await unlocked.createSession({ id: 'unlocked-session', ownerId: 'test-owner' });

      const threadA = await unlockedSession.thread.create({ title: 'test' });
      await unlockedSession.thread.create({ title: 'test2' });
      await unlockedSession.thread.switch({ threadId: threadA.id });
      // No errors thrown — locking is optional
    });
  });
});
