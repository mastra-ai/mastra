import { describe, expect, it, vi } from 'vitest';

import { InProcessDomainPubSub } from '../../src/workers/in-process-domain-pubsub.js';

const event = {
  type: 'security.alert.received',
  runId: 'run-1',
  data: { incidentId: 'incident-1' },
};

describe('InProcessDomainPubSub', () => {
  it('rejects workflow commands without consumers but permits unused notifications', async () => {
    const pubsub = new InProcessDomainPubSub();
    await expect(pubsub.publish(event.type, event)).rejects.toThrow('NO_CONSUMER');
    await expect(
      pubsub.publish('security.workflow.updated', {
        ...event,
        type: 'security.workflow.updated',
      }),
    ).resolves.toBeUndefined();
    await pubsub.close();
  });
  it('never treats callback return without ACK as successful delivery', async () => {
    const pubsub = new InProcessDomainPubSub();
    await pubsub.subscribe(event.type, async () => {});
    await expect(pubsub.publish(event.type, event)).rejects.toThrow('ACK_REQUIRED');
    await pubsub.close();
  });
  it('bounds NACK retries while yielding to the event loop', async () => {
    const pubsub = new InProcessDomainPubSub({
      maxDeliveryAttempts: 3,
      retryDelayMs: 1,
    });
    let calls = 0;
    let yielded = false;
    await pubsub.subscribe(event.type, async (_event, _ack, nack) => {
      calls++;
      if (calls === 1)
        setTimeout(() => {
          yielded = true;
        }, 0);
      await nack?.();
    });
    await expect(pubsub.publish(event.type, event)).rejects.toThrow('RETRY_EXHAUSTED');
    expect(calls).toBe(3);
    expect(yielded).toBe(true);
    await pubsub.close();
  });
  it('close aborts a retry delay and rejects unacknowledged publication', async () => {
    const pubsub = new InProcessDomainPubSub({ retryDelayMs: 1_000 });
    let started = () => {};
    const called = new Promise<void>(resolve => {
      started = resolve;
    });
    await pubsub.subscribe(event.type, async (_event, _ack, nack) => {
      await nack?.();
      started();
    });
    const publication = expect(pubsub.publish(event.type, event)).rejects.toThrow('CLOSED');
    await called;
    await pubsub.close();
    await publication;
    await expect(pubsub.publish(event.type, event)).rejects.toThrow('CLOSED');
    await expect(pubsub.subscribe(event.type, async () => {})).rejects.toThrow('CLOSED');
  });
  it('rejects invalid bounded retry options', () => {
    for (const maxDeliveryAttempts of [0, 11, 1.5, NaN])
      expect(() => new InProcessDomainPubSub({ maxDeliveryAttempts })).toThrow('OPTIONS_INVALID');
    for (const retryDelayMs of [0, 1_001, -1, Infinity])
      expect(() => new InProcessDomainPubSub({ retryDelayMs })).toThrow('OPTIONS_INVALID');
  });
  it('does not resolve publish until the consumer acknowledges', async () => {
    const pubsub = new InProcessDomainPubSub();
    let release = () => {};
    const gate = new Promise<void>(resolve => {
      release = resolve;
    });
    let published = false;
    await pubsub.subscribe(
      event.type,
      async (_delivered, ack) => {
        await gate;
        await ack?.();
      },
      { group: 'workflow-starters' },
    );

    const publication = pubsub.publish(event.type, event).then(() => {
      published = true;
    });
    await Promise.resolve();
    expect(published).toBe(false);

    release();
    await publication;
    expect(published).toBe(true);
    await pubsub.close();
  });

  it('redelivers a nacked event with an incremented attempt', async () => {
    const pubsub = new InProcessDomainPubSub();
    const attempts: number[] = [];
    const subscriber = vi.fn(async (delivered, ack, nack) => {
      attempts.push(delivered.deliveryAttempt ?? 0);
      if (attempts.length === 1) await nack?.();
      else await ack?.();
    });
    await pubsub.subscribe(event.type, subscriber, {
      group: 'workflow-starters',
    });

    await pubsub.publish(event.type, event);

    expect(attempts).toEqual([1, 2]);
    expect(subscriber).toHaveBeenCalledTimes(2);
    await pubsub.close();
  });
});
