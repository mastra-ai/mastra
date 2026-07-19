import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { Event } from '../types';
import { EventEmitterPubSub } from './index';

function makeEvent(overrides: Partial<Omit<Event, 'id' | 'createdAt'>> = {}): Omit<Event, 'id' | 'createdAt'> {
  return {
    type: 'test',
    data: {},
    runId: 'run-1',
    ...overrides,
  };
}

describe('EventEmitterPubSub', () => {
  let pubsub: EventEmitterPubSub;

  beforeEach(() => {
    pubsub = new EventEmitterPubSub();
  });

  describe('fan-out (existing behavior)', () => {
    it('delivers messages to all subscribers', async () => {
      const cb1 = vi.fn();
      const cb2 = vi.fn();

      await pubsub.subscribe('topic-a', cb1);
      await pubsub.subscribe('topic-a', cb2);

      await pubsub.publish('topic-a', makeEvent({ type: 'hello' }));

      expect(cb1).toHaveBeenCalledTimes(1);
      expect(cb2).toHaveBeenCalledTimes(1);
      expect(cb1.mock.calls[0]![0].type).toBe('hello');
      expect(cb2.mock.calls[0]![0].type).toBe('hello');
    });

    it('does not deliver to unsubscribed callbacks', async () => {
      const cb1 = vi.fn();
      const cb2 = vi.fn();

      await pubsub.subscribe('topic-a', cb1);
      await pubsub.subscribe('topic-a', cb2);
      await pubsub.unsubscribe('topic-a', cb1);

      await pubsub.publish('topic-a', makeEvent());

      expect(cb1).not.toHaveBeenCalled();
      expect(cb2).toHaveBeenCalledTimes(1);
    });

    it('does not deliver to subscribers on different topics', async () => {
      const cb1 = vi.fn();
      const cb2 = vi.fn();

      await pubsub.subscribe('topic-a', cb1);
      await pubsub.subscribe('topic-b', cb2);

      await pubsub.publish('topic-a', makeEvent());

      expect(cb1).toHaveBeenCalledTimes(1);
      expect(cb2).not.toHaveBeenCalled();
    });
  });

  describe('group (competing consumers)', () => {
    it('delivers each message to exactly one subscriber in the group', async () => {
      const cb1 = vi.fn();
      const cb2 = vi.fn();

      await pubsub.subscribe('tasks', cb1, { group: 'workers' });
      await pubsub.subscribe('tasks', cb2, { group: 'workers' });

      await pubsub.publish('tasks', makeEvent({ type: 'task-1' }));

      // Exactly one should have been called
      expect(cb1.mock.calls.length + cb2.mock.calls.length).toBe(1);
    });

    it('round-robins across group members', async () => {
      const cb1 = vi.fn();
      const cb2 = vi.fn();
      const cb3 = vi.fn();

      await pubsub.subscribe('tasks', cb1, { group: 'workers' });
      await pubsub.subscribe('tasks', cb2, { group: 'workers' });
      await pubsub.subscribe('tasks', cb3, { group: 'workers' });

      // Publish 6 messages — should distribute 2 each
      for (let i = 0; i < 6; i++) {
        await pubsub.publish('tasks', makeEvent({ type: `task-${i}` }));
      }

      expect(cb1).toHaveBeenCalledTimes(2);
      expect(cb2).toHaveBeenCalledTimes(2);
      expect(cb3).toHaveBeenCalledTimes(2);
    });

    it('works with a single subscriber in the group', async () => {
      const cb = vi.fn();

      await pubsub.subscribe('tasks', cb, { group: 'workers' });

      await pubsub.publish('tasks', makeEvent({ type: 'task-1' }));
      await pubsub.publish('tasks', makeEvent({ type: 'task-2' }));

      expect(cb).toHaveBeenCalledTimes(2);
    });

    it('different groups on the same topic are independent', async () => {
      const groupA1 = vi.fn();
      const groupA2 = vi.fn();
      const groupB1 = vi.fn();

      await pubsub.subscribe('tasks', groupA1, { group: 'group-a' });
      await pubsub.subscribe('tasks', groupA2, { group: 'group-a' });
      await pubsub.subscribe('tasks', groupB1, { group: 'group-b' });

      await pubsub.publish('tasks', makeEvent({ type: 'task-1' }));

      // group-a: one of groupA1/groupA2 gets it
      expect(groupA1.mock.calls.length + groupA2.mock.calls.length).toBe(1);
      // group-b: groupB1 gets it (only member)
      expect(groupB1).toHaveBeenCalledTimes(1);
    });

    it('group subscribers and fan-out subscribers coexist on the same topic', async () => {
      const fanout1 = vi.fn();
      const fanout2 = vi.fn();
      const grouped1 = vi.fn();
      const grouped2 = vi.fn();

      await pubsub.subscribe('tasks', fanout1);
      await pubsub.subscribe('tasks', fanout2);
      await pubsub.subscribe('tasks', grouped1, { group: 'workers' });
      await pubsub.subscribe('tasks', grouped2, { group: 'workers' });

      await pubsub.publish('tasks', makeEvent({ type: 'task-1' }));

      // Fan-out: both get it
      expect(fanout1).toHaveBeenCalledTimes(1);
      expect(fanout2).toHaveBeenCalledTimes(1);
      // Group: exactly one gets it
      expect(grouped1.mock.calls.length + grouped2.mock.calls.length).toBe(1);
    });

    it('unsubscribing a group member removes it from round-robin', async () => {
      const cb1 = vi.fn();
      const cb2 = vi.fn();

      await pubsub.subscribe('tasks', cb1, { group: 'workers' });
      await pubsub.subscribe('tasks', cb2, { group: 'workers' });

      // Unsubscribe cb1
      await pubsub.unsubscribe('tasks', cb1);

      // All messages should now go to cb2
      await pubsub.publish('tasks', makeEvent({ type: 'task-1' }));
      await pubsub.publish('tasks', makeEvent({ type: 'task-2' }));

      expect(cb1).not.toHaveBeenCalled();
      expect(cb2).toHaveBeenCalledTimes(2);
    });

    it('unsubscribing the last group member cleans up the emitter listener', async () => {
      const cb = vi.fn();

      await pubsub.subscribe('tasks', cb, { group: 'workers' });
      await pubsub.unsubscribe('tasks', cb);

      // Publishing should not call the callback
      await pubsub.publish('tasks', makeEvent());

      expect(cb).not.toHaveBeenCalled();
    });
  });

  describe('close', () => {
    it('removes all listeners and clears group state', async () => {
      const cb1 = vi.fn();
      const cb2 = vi.fn();

      await pubsub.subscribe('tasks', cb1);
      await pubsub.subscribe('tasks', cb2, { group: 'workers' });

      await pubsub.close();

      await pubsub.publish('tasks', makeEvent());

      expect(cb1).not.toHaveBeenCalled();
      expect(cb2).not.toHaveBeenCalled();
    });
  });

  describe('clearTopic', () => {
    it('resolves via the PubSub base no-op and leaves subscriptions intact', async () => {
      // EventEmitterPubSub retains nothing per topic, so it relies on the
      // base class's default clearTopic. Run lifecycles call it
      // fire-and-forget on every transport; it must resolve cleanly and
      // must not tear down live subscriptions.
      const cb = vi.fn();
      await pubsub.subscribe('tasks', cb);

      await expect(pubsub.clearTopic('tasks')).resolves.toBeUndefined();

      await pubsub.publish('tasks', makeEvent());
      expect(cb).toHaveBeenCalledTimes(1);
    });
  });

  describe('publish', () => {
    it('auto-generates id and createdAt', async () => {
      const cb = vi.fn();

      await pubsub.subscribe('topic', cb);
      await pubsub.publish('topic', makeEvent());

      const event = cb.mock.calls[0]![0] as Event;
      expect(event.id).toBeDefined();
      expect(typeof event.id).toBe('string');
      expect(event.createdAt).toBeInstanceOf(Date);
    });
  });

  describe('lease', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('grants a lease when the key is free', async () => {
      const result = await pubsub.acquireLease('thread-1', 'owner-a', 1000);
      expect(result).toEqual({ acquired: true, owner: 'owner-a' });
      expect(await pubsub.getLeaseOwner('thread-1')).toBe('owner-a');
    });

    it('denies a lease while another owner holds it', async () => {
      await pubsub.acquireLease('thread-1', 'owner-a', 1000);
      const result = await pubsub.acquireLease('thread-1', 'owner-b', 1000);
      expect(result).toEqual({ acquired: false, owner: 'owner-a' });
      expect(await pubsub.getLeaseOwner('thread-1')).toBe('owner-a');
    });

    it('lets the same owner re-acquire (idempotent)', async () => {
      await pubsub.acquireLease('thread-1', 'owner-a', 1000);
      const result = await pubsub.acquireLease('thread-1', 'owner-a', 1000);
      expect(result).toEqual({ acquired: true, owner: 'owner-a' });
    });

    it('expires the lease after TTL and lets a new owner acquire it', async () => {
      await pubsub.acquireLease('thread-1', 'owner-a', 1000);
      vi.advanceTimersByTime(1001);
      const result = await pubsub.acquireLease('thread-1', 'owner-b', 1000);
      expect(result).toEqual({ acquired: true, owner: 'owner-b' });
      expect(await pubsub.getLeaseOwner('thread-1')).toBe('owner-b');
    });

    it('returns undefined owner once the lease has expired', async () => {
      await pubsub.acquireLease('thread-1', 'owner-a', 1000);
      vi.advanceTimersByTime(1001);
      expect(await pubsub.getLeaseOwner('thread-1')).toBeUndefined();
    });

    it('releases a lease that the caller owns', async () => {
      await pubsub.acquireLease('thread-1', 'owner-a', 1000);
      await pubsub.releaseLease('thread-1', 'owner-a');
      expect(await pubsub.getLeaseOwner('thread-1')).toBeUndefined();
    });

    it('does not release a lease held by a different owner', async () => {
      await pubsub.acquireLease('thread-1', 'owner-a', 1000);
      await pubsub.releaseLease('thread-1', 'owner-b');
      expect(await pubsub.getLeaseOwner('thread-1')).toBe('owner-a');
    });

    it('renews a lease the caller still owns', async () => {
      await pubsub.acquireLease('thread-1', 'owner-a', 1000);
      vi.advanceTimersByTime(800);
      const renewed = await pubsub.renewLease('thread-1', 'owner-a', 1000);
      expect(renewed).toBe(true);

      // 500ms past the original expiry but well within the renewed window.
      vi.advanceTimersByTime(700);
      expect(await pubsub.getLeaseOwner('thread-1')).toBe('owner-a');
    });

    it('fails to renew a lease held by a different owner', async () => {
      await pubsub.acquireLease('thread-1', 'owner-a', 1000);
      const renewed = await pubsub.renewLease('thread-1', 'owner-b', 1000);
      expect(renewed).toBe(false);
      expect(await pubsub.getLeaseOwner('thread-1')).toBe('owner-a');
    });

    it('fails to renew a lease that has already expired', async () => {
      await pubsub.acquireLease('thread-1', 'owner-a', 1000);
      vi.advanceTimersByTime(1001);
      const renewed = await pubsub.renewLease('thread-1', 'owner-a', 1000);
      expect(renewed).toBe(false);
    });

    it('keeps leases for different keys independent', async () => {
      const a = await pubsub.acquireLease('thread-1', 'owner-a', 1000);
      const b = await pubsub.acquireLease('thread-2', 'owner-b', 1000);
      expect(a.acquired).toBe(true);
      expect(b.acquired).toBe(true);
      expect(await pubsub.getLeaseOwner('thread-1')).toBe('owner-a');
      expect(await pubsub.getLeaseOwner('thread-2')).toBe('owner-b');
    });
  });
});
