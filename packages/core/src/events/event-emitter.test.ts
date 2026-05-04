import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EventEmitterPubSub } from './event-emitter';
import type { Event } from './types';

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
});
