import { randomUUID } from 'node:crypto';
import type { Event } from '@mastra/core/events';
import { expect, it } from 'vitest';
import { ValkeyStreamsPubSub } from './index';

it('publishes and consumes through Valkey GLIDE', async () => {
  const pubsub = new ValkeyStreamsPubSub({ url: 'valkey://localhost:6381', blockMs: 50 });
  const received: Event[] = [];
  const topic = `valkey-${randomUUID()}`;
  try {
    await pubsub.subscribe(topic, (event, ack) => {
      received.push(event);
      void ack?.();
    });
    await pubsub.publish(topic, { type: 'hello', data: { provider: 'valkey' }, runId: 'run-1' });
    const deadline = Date.now() + 5_000;
    while (received.length === 0 && Date.now() < deadline) await new Promise(resolve => setTimeout(resolve, 25));
    expect(received[0]).toMatchObject({ type: 'hello', data: { provider: 'valkey' } });
  } finally {
    await pubsub.clearTopic(topic);
    await pubsub.close();
  }
});

it('reclaims idle pending entries to a sibling consumer, never back to their stuck owner', async () => {
  const pubsub = new ValkeyStreamsPubSub({
    url: 'valkey://localhost:6381',
    blockMs: 200,
    reclaimIntervalMs: 250,
    reclaimIdleMs: 500,
  });
  const topic = `valkey-${randomUUID()}`;
  const group = `claim-${randomUUID()}`;
  const seenA: Event[] = [];
  const seenB: Event[] = [];
  try {
    // A reads but never acks; its pending entry goes idle.
    await pubsub.subscribe(
      topic,
      event => {
        seenA.push(event);
      },
      { group },
    );
    await pubsub.publish(topic, { type: 'sticky', data: {}, runId: 'run-1' });
    let deadline = Date.now() + 5_000;
    while (seenA.length === 0 && Date.now() < deadline) await new Promise(resolve => setTimeout(resolve, 25));
    expect(seenA).toHaveLength(1);

    await pubsub.subscribe(
      topic,
      (event, ack) => {
        seenB.push(event);
        void ack?.();
      },
      { group },
    );
    deadline = Date.now() + 6_000;
    while (seenB.length === 0 && Date.now() < deadline) await new Promise(resolve => setTimeout(resolve, 25));
    expect(seenB[0]).toMatchObject({ type: 'sticky' });
    // A's own reclaim loop must not have handed the entry back to A: that
    // would reset the idle clock and starve B forever.
    expect(seenA).toHaveLength(1);
  } finally {
    await pubsub.clearTopic(topic);
    await pubsub.close();
  }
});
