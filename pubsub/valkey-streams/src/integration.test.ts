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
