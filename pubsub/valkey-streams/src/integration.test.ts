import { randomUUID } from 'node:crypto';
import type { Event } from '@mastra/core/events';
import { expect, it } from 'vitest';
import { createClient } from './client';
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

    const acked: Promise<void>[] = [];
    await pubsub.subscribe(
      topic,
      (event, ack) => {
        seenB.push(event);
        acked.push(ack?.() ?? Promise.resolve());
      },
      { group },
    );
    deadline = Date.now() + 6_000;
    while (seenB.length === 0 && Date.now() < deadline) await new Promise(resolve => setTimeout(resolve, 25));
    expect(seenB[0]).toMatchObject({ type: 'sticky' });
    await Promise.all(acked);
    // A's own reclaim loop must not have handed the entry back to A: that
    // would reset the idle clock and starve B forever.
    expect(seenA).toHaveLength(1);
    // Once B acks, nothing is pending, so another reclaim window delivers nothing new.
    await new Promise(resolve => setTimeout(resolve, 1_000));
    expect(seenB).toHaveLength(1);
    expect(seenA).toHaveLength(1);
  } finally {
    await pubsub.clearTopic(topic);
    await pubsub.close();
  }
});

async function pttlOf(key: string): Promise<number> {
  const raw = createClient({ url: 'valkey://localhost:6381' });
  await raw.connect();
  try {
    return Number(await raw.command(['PTTL', key]));
  } finally {
    await raw.quit();
  }
}

async function xlenOf(key: string): Promise<number> {
  const raw = createClient({ url: 'valkey://localhost:6381' });
  await raw.connect();
  try {
    return Number(await raw.command(['XLEN', key]));
  } finally {
    await raw.quit();
  }
}

it('expires idle streams by default (7 days) on both publish- and subscribe-created keys', async () => {
  const sevenDays = 7 * 24 * 60 * 60 * 1000;
  const pubsub = new ValkeyStreamsPubSub({ url: 'valkey://localhost:6381', blockMs: 50 });
  const publishTopic = `valkey-default-ttl-pub-${randomUUID()}`;
  const subscribeTopic = `valkey-default-ttl-sub-${randomUUID()}`;
  try {
    await pubsub.publish(publishTopic, { type: 'hello', data: {}, runId: 'run-1' });
    await pubsub.subscribe(subscribeTopic, (_event, ack) => void ack?.());
    for (const topic of [publishTopic, subscribeTopic]) {
      const pttl = await pttlOf(`mastra:topic:${topic}`);
      expect(pttl).toBeGreaterThan(sevenDays - 60_000);
      expect(pttl).toBeLessThanOrEqual(sevenDays);
    }
  } finally {
    await pubsub.clearTopic(publishTopic);
    await pubsub.clearTopic(subscribeTopic);
    await pubsub.close();
  }
});

it('keeps streams persistent with streamIdleTtlMs: 0', async () => {
  const pubsub = new ValkeyStreamsPubSub({ url: 'valkey://localhost:6381', blockMs: 50, streamIdleTtlMs: 0 });
  const topic = `valkey-nottl-${randomUUID()}`;
  try {
    await pubsub.publish(topic, { type: 'hello', data: {}, runId: 'run-1' });
    expect(await pttlOf(`mastra:topic:${topic}`)).toBe(-1);
  } finally {
    await pubsub.clearTopic(topic);
    await pubsub.close();
  }
});

it('keeps delivering to a live subscriber after its idle stream expires', async () => {
  // Expiry happens while the reader is blocked in XREADGROUP with no local
  // cursor reset; the read loop must recreate the group and keep delivering.
  const pubsub = new ValkeyStreamsPubSub({ url: 'valkey://localhost:6381', blockMs: 50, streamIdleTtlMs: 300 });
  const topic = `valkey-ttl-expire-live-${randomUUID()}`;
  const received: number[] = [];
  try {
    await pubsub.subscribe(topic, (event, ack) => {
      received.push((event.data as { n: number }).n);
      void ack?.();
    });
    await pubsub.publish(topic, { type: 'n', data: { n: 1 }, runId: 'run-1' });
    await expect.poll(() => received, { timeout: 5_000 }).toEqual([1]);

    // The read loop recreates the stream right after it expires, so check that
    // entry 1 is gone (XLEN 0) rather than racing to see the key missing.
    await expect.poll(() => xlenOf(`mastra:topic:${topic}`), { timeout: 5_000 }).toBe(0);

    await pubsub.publish(topic, { type: 'n', data: { n: 2 }, runId: 'run-1' });
    await expect.poll(() => received, { timeout: 5_000 }).toEqual([1, 2]);
  } finally {
    await pubsub.clearTopic(topic);
    await pubsub.close();
  }
}, 20_000);
