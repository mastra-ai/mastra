import type { Event, EventCallback, PubSub } from '@mastra/core/events';
import { describe, expect, it } from 'vitest';

/** Customer drivers can reuse this push-domain transport contract. Factories
 * must return a clean namespace and cleanup must release its subscriptions. */
export function defineDomainPubSubContract(
  name: string,
  create: () => Promise<{ pubsub: PubSub; cleanup(): Promise<void> }>,
) {
  describe(`${name}: domain PubSub contract`, () => {
    it('preserves the envelope and durable identity on NACK redelivery', async () => {
      const { pubsub, cleanup } = await create();
      const delivered: Event[] = [];
      let complete = () => {};
      const received = new Promise<void>(resolve => {
        complete = resolve;
      });
      try {
        await pubsub.subscribe(
          'security.alert.received',
          async (event, ack, nack) => {
            delivered.push(event);
            if (delivered.length === 1) await nack?.();
            else {
              await ack?.();
              complete();
            }
          },
          { group: 'contract-workers' },
        );
        await pubsub.publish('security.alert.received', contractEvent);
        await received;
        expect(delivered).toHaveLength(2);
        expect(delivered[1]!.id).toBe(delivered[0]!.id);
        expect(delivered[1]!.createdAt).toEqual(delivered[0]!.createdAt);
        expect(delivered.map(event => event.deliveryAttempt)).toEqual([1, 2]);
        expect(delivered.every(event => JSON.stringify(event.data) === JSON.stringify(contractEvent.data))).toBe(true);
      } finally {
        await cleanup();
      }
    });
    it('fans out independent subscribers and selects one member per consumer group', async () => {
      const { pubsub, cleanup } = await create();
      const counts = [0, 0, 0, 0];
      const callbacks: EventCallback[] = counts.map((_value, index) => async (_event, ack) => {
        counts[index]! += 1;
        await ack?.();
      });
      try {
        await pubsub.subscribe(contractEvent.type, callbacks[0]!);
        await pubsub.subscribe(contractEvent.type, callbacks[1]!, {
          group: 'workers',
        });
        await pubsub.subscribe(contractEvent.type, callbacks[2]!, {
          group: 'workers',
        });
        await pubsub.subscribe(contractEvent.type, callbacks[3]!, {
          group: 'auditors',
        });
        await pubsub.publish(contractEvent.type, contractEvent);
        await pubsub.publish(contractEvent.type, contractEvent);
        await pubsub.flush();
        expect(counts[0]).toBe(2);
        expect(counts[1]! + counts[2]!).toBe(2);
        expect(counts[3]).toBe(2);
        await pubsub.unsubscribe(contractEvent.type, callbacks[0]!);
        await pubsub.publish(contractEvent.type, contractEvent);
        await pubsub.flush();
        expect(counts[0]).toBe(2);
      } finally {
        await cleanup();
      }
    });
  });
}

export const contractEvent = {
  type: 'security.alert.received',
  runId: 'run-1',
  data: {
    eventId: 'durable-event-1',
    tenantId: 'tenant-1',
    incidentId: 'incident-1',
    payload: { alertId: 'alert-1' },
  },
};
