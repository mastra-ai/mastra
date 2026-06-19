import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Agent } from '../agent';
import { InMemoryStore } from '../storage/mock';
import { Harness } from './harness';

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

  beforeEach(async () => {
    acquire = vi.fn();
    release = vi.fn();
    harness = createHarness({ acquire, release });
    await harness.init();
  });

  describe('createThread', () => {
    it('acquires lock on the new thread', async () => {
      const thread = await harness.session.thread.create();
      expect(acquire).toHaveBeenCalledWith(thread.id);
    });

    it('releases lock on previous thread when creating a new one', async () => {
      const first = await harness.session.thread.create();
      acquire.mockClear();
      release.mockClear();

      const second = await harness.session.thread.create();
      expect(release).toHaveBeenCalledWith(first.id);
      expect(acquire).toHaveBeenCalledWith(second.id);
    });

    it('acquire is called before release on createThread', async () => {
      await harness.session.thread.create();
      const callOrder: string[] = [];
      release.mockImplementation(() => callOrder.push('release'));
      acquire.mockImplementation(() => callOrder.push('acquire'));

      await harness.session.thread.create();
      expect(callOrder).toEqual(['acquire', 'release']);
    });

    it('re-acquires old lock if acquire on new thread fails', async () => {
      const first = await harness.session.thread.create();
      acquire.mockClear();
      release.mockClear();

      acquire.mockImplementationOnce(() => {
        throw new Error('Thread is locked');
      });

      await expect(harness.session.thread.create()).rejects.toThrow('Thread is locked');
      // Should have attempted to re-acquire the old thread's lock
      expect(acquire).toHaveBeenCalledTimes(2); // failed new + re-acquire old
      expect(acquire).toHaveBeenLastCalledWith(first.id);
      // Old thread lock was never released
      expect(release).not.toHaveBeenCalled();
    });

    it('waits for an async acquire promise before releasing previous thread lock', async () => {
      await harness.session.thread.create();
      acquire.mockClear();
      release.mockClear();

      let resolveAcquire: (() => void) | undefined;
      acquire.mockImplementationOnce(
        () =>
          new Promise<void>(resolve => {
            resolveAcquire = resolve;
          }),
      );

      const createThreadPromise = harness.session.thread.create();
      await Promise.resolve();

      expect(release).not.toHaveBeenCalled();
      resolveAcquire?.();

      await createThreadPromise;
      expect(release).toHaveBeenCalledTimes(1);
    });
  });

  describe('switchThread', () => {
    it('acquires lock on the target thread', async () => {
      const thread = await harness.session.thread.create({ title: 'thread-a' });
      await harness.session.thread.create({ title: 'thread-b' });
      acquire.mockClear();
      release.mockClear();

      await harness.session.thread.switch({ threadId: thread.id });
      expect(acquire).toHaveBeenCalledWith(thread.id);
    });

    it('releases lock on previous thread', async () => {
      const first = await harness.session.thread.create({ title: 'first' });
      const second = await harness.session.thread.create({ title: 'second' });
      acquire.mockClear();
      release.mockClear();

      await harness.session.thread.switch({ threadId: first.id });
      expect(release).toHaveBeenCalledWith(second.id);
      expect(acquire).toHaveBeenCalledWith(first.id);
    });

    it('acquire is called before release on switchThread', async () => {
      const threadA = await harness.session.thread.create({ title: 'first' });
      await harness.session.thread.create({ title: 'second' });
      const callOrder: string[] = [];
      release.mockImplementation(() => callOrder.push('release'));
      acquire.mockImplementation(() => callOrder.push('acquire'));

      await harness.session.thread.switch({ threadId: threadA.id });
      expect(callOrder).toEqual(['acquire', 'release']);
    });

    it('propagates errors from acquire (e.g., lock conflict)', async () => {
      const threadA = await harness.session.thread.create({ title: 'first' });
      await harness.session.thread.create({ title: 'second' });

      acquire.mockImplementation(() => {
        throw new Error('Thread is locked by another process');
      });

      await expect(harness.session.thread.switch({ threadId: threadA.id })).rejects.toThrow(
        'Thread is locked by another process',
      );
    });

    it('waits for an async release promise before resolving switchThread', async () => {
      const first = await harness.session.thread.create({ title: 'first' });
      await harness.session.thread.create({ title: 'second' });
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
      const switchPromise = harness.session.thread.switch({ threadId: first.id }).then(() => {
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

  describe('selectOrCreateThread', () => {
    it('acquires lock when selecting an existing thread', async () => {
      // Pre-create a thread so selectOrCreateThread finds it
      await harness.session.thread.create({ title: 'existing' });
      acquire.mockClear();
      release.mockClear();

      // Manually set the same storage so it sees the thread
      // Instead, create a new harness with same store
      const store = new InMemoryStore();
      const agent = new Agent({
        name: 'test-agent',
        instructions: 'You are a test agent.',
        model: { provider: 'openai', name: 'gpt-4o', toolChoice: 'auto' },
      });
      const freshHarness = new Harness({
        id: 'test-harness',
        storage: store,
        modes: [{ id: 'default', name: 'Default', default: true, agent }],
        threadLock: { acquire, release },
      });
      await freshHarness.init();

      // Create a thread via this harness so selectOrCreateThread can find it
      const existing = await freshHarness.session.thread.create({ title: 'existing-thread' });
      acquire.mockClear();
      release.mockClear();

      // Create another fresh harness with the same storage
      const freshHarness2 = new Harness({
        id: 'test-harness',
        storage: store,
        modes: [{ id: 'default', name: 'Default', default: true, agent }],
        threadLock: { acquire, release },
      });
      await freshHarness2.init();

      const selected = await freshHarness2.selectOrCreateThread();
      expect(selected.id).toBe(existing.id);
      expect(acquire).toHaveBeenCalledWith(existing.id);
    });

    it('acquires lock when creating a new thread (no existing threads)', async () => {
      const store = new InMemoryStore();
      const agent = new Agent({
        name: 'test-agent',
        instructions: 'You are a test agent.',
        model: { provider: 'openai', name: 'gpt-4o', toolChoice: 'auto' },
      });
      const freshHarness = new Harness({
        id: 'test-harness',
        storage: store,
        modes: [{ id: 'default', name: 'Default', default: true, agent }],
        threadLock: { acquire, release },
      });
      await freshHarness.init();

      acquire.mockClear();
      const thread = await freshHarness.selectOrCreateThread();
      expect(acquire).toHaveBeenCalledWith(thread.id);
    });
  });

  describe('deleteThread', () => {
    it('deletes a thread from storage', async () => {
      const thread = await harness.session.thread.create({ title: 'to-delete' });
      await harness.session.thread.delete({ threadId: thread.id });

      const threads = await harness.session.thread.list();
      expect(threads.find(t => t.id === thread.id)).toBeUndefined();
    });

    it('releases lock when deleting the current thread', async () => {
      const thread = await harness.session.thread.create({ title: 'current' });
      acquire.mockClear();
      release.mockClear();

      await harness.session.thread.delete({ threadId: thread.id });
      expect(release).toHaveBeenCalledWith(thread.id);
    });

    it('clears currentThreadId when deleting the current thread', async () => {
      const thread = await harness.session.thread.create({ title: 'current' });
      expect(harness.session.thread.getId()).toBe(thread.id);

      await harness.session.thread.delete({ threadId: thread.id });
      expect(harness.session.thread.getId()).toBeNull();
    });

    it('does not release lock when deleting a non-current thread', async () => {
      const first = await harness.session.thread.create({ title: 'first' });
      const second = await harness.session.thread.create({ title: 'second' });
      release.mockClear();

      await harness.session.thread.delete({ threadId: first.id });
      // Should not release lock since first is not the current thread (second is)
      expect(release).not.toHaveBeenCalled();
      expect(harness.session.thread.getId()).toBe(second.id);
    });

    it('throws when thread does not exist', async () => {
      await expect(harness.session.thread.delete({ threadId: 'nonexistent' })).rejects.toThrow('Thread not found');
    });

    it('emits thread_deleted event', async () => {
      const events: string[] = [];
      harness.session.subscribe(event => {
        if (event.type === 'thread_deleted') events.push(event.threadId);
      });

      const thread = await harness.session.thread.create({ title: 'to-delete' });
      await harness.session.thread.delete({ threadId: thread.id });
      expect(events).toEqual([thread.id]);
    });
  });

  describe('without threadLock config', () => {
    it('works normally without locking', async () => {
      const unlocked = createHarness(); // no threadLock
      await unlocked.init();

      const threadA = await unlocked.session.thread.create({ title: 'test' });
      await unlocked.session.thread.create({ title: 'test2' });
      await unlocked.session.thread.switch({ threadId: threadA.id });
      // No errors thrown — locking is optional
    });
  });
});
