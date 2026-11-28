import { randomUUID } from 'node:crypto';
import { mkdtempSync, readdirSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { Event, EventCallback } from '@mastra/core/events';
import { Logger } from '@valkey/valkey-glide';
import { afterEach, beforeAll, afterAll, describe, expect, it } from 'vitest';
import { createClient } from './client';
import type { ValkeyClientType } from './client';
import { ValkeyStreamsPubSub } from './index';

const VALKEY_URL = process.env.VALKEY_URL ?? 'valkey://localhost:6381';

const KEY_PREFIX = `fanout-sharing-${randomUUID()}`;

function makeEvent(id: string): Omit<Event, 'id' | 'createdAt'> {
  return { type: 'test', data: { id }, runId: 'run-1' };
}

async function waitFor(check: () => boolean, timeoutMs = 5_000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (!check()) {
    if (Date.now() > deadline) throw new Error('timed out waiting for condition');
    await new Promise(r => setTimeout(r, 20));
  }
}

const tick = (ms = 300) => new Promise(r => setTimeout(r, ms));

/**
 * Route GLIDE's native (Rust core) warnings into a temp file so a test can
 * assert the server-side NOGROUP race is gone (mastra-ai/mastra#31465). The
 * logger is process-global, so the previous config is restored on `stop()`.
 */
function captureNativeWarnings() {
  const dir = mkdtempSync(join(tmpdir(), 'glide-warn-'));
  Logger.setLoggerConfig('warn', join(dir, 'capture'));
  return {
    stop(): string[] {
      Logger.setLoggerConfig('warn');
      const lines: string[] = [];
      for (const file of readdirSync(dir)) {
        lines.push(...readFileSync(join(dir, file), 'utf8').split('\n'));
      }
      return lines.filter(line => line.length > 0);
    },
  };
}

describe('ValkeyStreamsPubSub fan-out sharing', () => {
  let admin: ValkeyClientType;
  let pubsubs: ValkeyStreamsPubSub[] = [];

  beforeAll(async () => {
    admin = createClient({ url: VALKEY_URL });
    await admin.connect();
  });
  afterAll(async () => {
    await admin.quit();
  });
  afterEach(async () => {
    await Promise.allSettled(pubsubs.map(ps => ps.close()));
    pubsubs = [];
  });

  function createPubSub(config: ConstructorParameters<typeof ValkeyStreamsPubSub>[0] = {}) {
    // A unique client name lets CLIENT LIST count only this instance's connections.
    const name = `fanout-${randomUUID().slice(0, 8)}`;
    const ps = new ValkeyStreamsPubSub({
      valkeyOptions: { url: VALKEY_URL, clientName: name },
      keyPrefix: KEY_PREFIX,
      blockMs: 200,
      ...config,
    });
    pubsubs.push(ps);
    return { ps, name };
  }

  async function connections(name: string): Promise<number> {
    const list = String(await admin.command(['CLIENT', 'LIST']));
    return list.split('\n').filter(line => line.includes(` name=${name} `)).length;
  }

  async function groups(topic: string): Promise<number> {
    try {
      return (await admin.xInfoGroups(`${KEY_PREFIX}:${topic}`)).length;
    } catch {
      return 0;
    }
  }

  async function pending(topic: string): Promise<number> {
    let total = 0;
    for (const g of await admin.xInfoGroups(`${KEY_PREFIX}:${topic}`)) total += Number(g.pending);
    return total;
  }

  function collector() {
    const received: string[] = [];
    const cb: EventCallback = async (event, ack) => {
      received.push((event.data as { id: string }).id);
      await ack?.();
    };
    return { cb, received };
  }

  it('shares one reader and one consumer group across subscribers to one topic', async () => {
    const { ps, name } = createPubSub();
    const topic = `t-${randomUUID()}`;
    const first = collector();
    await ps.subscribe(topic, first.cb);
    const baseline = await connections(name); // writer + one reader

    const others = Array.from({ length: 9 }, collector);
    for (const c of others) await ps.subscribe(topic, c.cb);

    expect(await connections(name)).toBe(baseline);
    expect(await groups(topic)).toBe(1);

    await ps.publish(topic, makeEvent('e1'));
    const all = [first, ...others];
    await waitFor(() => all.every(c => c.received.length === 1));
    await tick();
    for (const c of all) expect(c.received).toEqual(['e1']);
    expect(await pending(topic)).toBe(0);
  });

  it('opens one reader per topic and leaves grouped subscriptions separate', async () => {
    const { ps, name } = createPubSub();
    const [a, b] = [`a-${randomUUID()}`, `b-${randomUUID()}`];
    await ps.subscribe(a, collector().cb);
    const base = await connections(name);
    await ps.subscribe(a, collector().cb);
    await ps.subscribe(b, collector().cb);
    await ps.subscribe(b, collector().cb);
    expect(await connections(name)).toBe(base + 1);
    expect(await groups(a)).toBe(1);
    expect(await groups(b)).toBe(1);

    // Grouped (worker) subscriptions keep their own reader each.
    await ps.subscribe(a, collector().cb, { group: 'workers' });
    await ps.subscribe(a, collector().cb, { group: 'workers' });
    expect(await connections(name)).toBe(base + 3);
    expect(await groups(a)).toBe(2);
  });

  it('keeps delivering until the last subscriber leaves, then releases the reader and group', async () => {
    const { ps, name } = createPubSub();
    const topic = `t-${randomUUID()}`;
    const subs = Array.from({ length: 10 }, collector);
    for (const c of subs) await ps.subscribe(topic, c.cb);
    const withReader = await connections(name);

    for (const c of subs.slice(0, 9)) await ps.unsubscribe(topic, c.cb);
    expect(await connections(name)).toBe(withReader);
    await ps.publish(topic, makeEvent('e1'));
    await waitFor(() => subs[9]!.received.length === 1);
    for (const c of subs.slice(0, 9)) expect(c.received).toEqual([]);

    await ps.unsubscribe(topic, subs[9]!.cb);
    // GLIDE's close() returns before the server drops the socket; any closed GLIDE client,
    // idle or not, stays in CLIENT LIST for ~3s. Poll well past that.
    let after = withReader;
    for (const deadline = Date.now() + 10_000; Date.now() < deadline && after !== withReader - 1;) {
      after = await connections(name);
      await tick(50);
    }
    expect(after).toBe(withReader - 1);
    expect(await groups(topic)).toBe(0);
  });

  it('replays existing entries to a later earliest subscriber without duplicates', async () => {
    const { ps } = createPubSub();
    const topic = `t-${randomUUID()}`;
    const a = collector();
    await ps.subscribe(topic, a.cb);
    await ps.publish(topic, makeEvent('e1'));
    await ps.publish(topic, makeEvent('e2'));
    await waitFor(() => a.received.length === 2);

    const b = collector();
    await ps.subscribe(topic, b.cb);
    await ps.publish(topic, makeEvent('e3'));
    await waitFor(() => a.received.length === 3 && b.received.length === 3);
    await tick();
    expect(a.received).toEqual(['e1', 'e2', 'e3']);
    expect(b.received).toEqual(['e1', 'e2', 'e3']);
    expect(await pending(topic)).toBe(0);
  });

  it('gives a later latest subscriber only events published after it joined', async () => {
    const { ps } = createPubSub();
    const topic = `t-${randomUUID()}`;
    const a = collector();
    await ps.subscribe(topic, a.cb);
    await ps.publish(topic, makeEvent('e1'));
    await ps.publish(topic, makeEvent('e2'));
    await waitFor(() => a.received.length === 2);

    const b = collector();
    await ps.subscribe(topic, b.cb, { startFrom: 'latest' });
    await ps.publish(topic, makeEvent('e3'));
    await waitFor(() => b.received.length === 1 && a.received.length === 3);
    await tick();
    expect(b.received).toEqual(['e3']);
  });

  // A nack republishes the event as a new stream entry, which every fan-out subscriber reads.
  // This matches the per-subscriber-group behavior before readers were shared.
  it('redelivers a nacked event to every subscriber once, as before sharing, and acks once when all ack', async () => {
    const { ps } = createPubSub();
    const topic = `t-${randomUUID()}`;
    const attemptsA: number[] = [];
    const attemptsB: number[] = [];
    const cbA: EventCallback = async (event, ack) => {
      attemptsA.push(event.deliveryAttempt ?? 1);
      await ack?.();
    };
    const cbB: EventCallback = async (event, ack, nack) => {
      attemptsB.push(event.deliveryAttempt ?? 1);
      if ((event.deliveryAttempt ?? 1) === 1) await nack?.();
      else await ack?.();
    };
    await ps.subscribe(topic, cbA);
    await ps.subscribe(topic, cbB);
    await ps.publish(topic, makeEvent('e1'));

    await waitFor(() => attemptsB.length === 2 && attemptsA.length === 2);
    await tick();
    expect(attemptsA).toEqual([1, 2]);
    expect(attemptsB).toEqual([1, 2]);
    expect(Number(await admin.command(['XLEN', `${KEY_PREFIX}:${topic}`]))).toBe(2);
    expect(await pending(topic)).toBe(0);
  });

  it('settles an entry when a subscriber leaves before acking it', async () => {
    const { ps } = createPubSub();
    const topic = `t-${randomUUID()}`;
    const a = collector();
    let hungCalled = false;
    const hung: EventCallback = () => {
      hungCalled = true; // never acks
    };
    await ps.subscribe(topic, a.cb);
    await ps.subscribe(topic, hung);
    await ps.publish(topic, makeEvent('e1'));
    await waitFor(() => hungCalled && a.received.length === 1);
    await tick();
    expect(await pending(topic)).toBe(1);

    await ps.unsubscribe(topic, hung);
    await tick();
    expect(await pending(topic)).toBe(0);
  });

  it('opens one reader for concurrent first subscribes to a topic', async () => {
    const { ps, name } = createPubSub();
    const warm = `w-${randomUUID()}`;
    await ps.subscribe(warm, collector().cb);
    const base = await connections(name);

    const topic = `t-${randomUUID()}`;
    const subs = Array.from({ length: 5 }, collector);
    await Promise.all(subs.map(c => ps.subscribe(topic, c.cb)));
    expect(await connections(name)).toBe(base + 1);
    expect(await groups(topic)).toBe(1);

    await ps.publish(topic, makeEvent('e1'));
    await waitFor(() => subs.every(c => c.received.length === 1));
  });

  it('recovers every subscriber after clearTopic', async () => {
    const { ps } = createPubSub();
    const topic = `t-${randomUUID()}`;
    const subs = Array.from({ length: 3 }, collector);
    for (const c of subs) await ps.subscribe(topic, c.cb);
    await ps.publish(topic, makeEvent('e1'));
    await waitFor(() => subs.every(c => c.received.length === 1));

    await ps.clearTopic(topic);
    await tick(500);
    await ps.publish(topic, makeEvent('e2'));
    await waitFor(() => subs.every(c => c.received.length === 2));
    for (const c of subs) expect(c.received).toEqual(['e1', 'e2']);
  });

  it('opens a fresh reader for a subscriber arriving after the last one left', async () => {
    const { ps } = createPubSub();
    const topic = `t-${randomUUID()}`;
    const a = collector();
    await ps.subscribe(topic, a.cb);
    const b = collector();
    await Promise.all([ps.unsubscribe(topic, a.cb), ps.subscribe(topic, b.cb, { startFrom: 'latest' })]);
    await ps.publish(topic, makeEvent('e1'));
    await waitFor(() => b.received.length === 1);
    expect(await groups(topic)).toBe(1);
  });

  it('drains the last fan-out member before clearTopic deletes, leaving no NOGROUP', async () => {
    // Regression for mastra-ai/mastra#31465. With a long block the reader sits in
    // XREADGROUP when the last subscriber leaves. On the old order the reader was
    // closed before its read returned and a concurrent clearTopic DELed the
    // stream immediately, so the server woke the blocked read with NOGROUP (a
    // native WARN). The reader must be unblocked and drained, and clearTopic must
    // wait for that teardown, before the stream is deleted.
    const capture = captureNativeWarnings();
    try {
      // Positive control. The NOGROUP assertion below only proves the *absence*
      // of a warning, which also holds vacuously when the native logger is
      // suppressed (e.g. RUST_LOG=error) or rerouted. Emit a unique warn through
      // GLIDE's logger - the same native sink core warnings use - and require it
      // to be captured, so an empty NOGROUP result is meaningful.
      const control = `glide-capture-control-${randomUUID()}`;
      Logger.log('warn', 'fanout-sharing-test', control);

      const { ps } = createPubSub({ blockMs: 30_000 });
      const topic = `t-${randomUUID()}`;
      const c = collector();
      await ps.subscribe(topic, c.cb, { startFrom: 'latest' });
      // Let the reader issue its blocking XREADGROUP.
      await tick(400);
      expect(await groups(topic)).toBe(1);

      await Promise.all([ps.unsubscribe(topic, c.cb), ps.clearTopic(topic)]);
      await tick(600);

      expect(await admin.command(['EXISTS', `${KEY_PREFIX}:${topic}`])).toBe(0);
      expect(await groups(topic)).toBe(0);

      const lines = capture.stop();
      expect(lines.some(line => line.includes(control))).toBe(true);
      const nogroup = lines.filter(line => /NOGROUP/i.test(line));
      expect(nogroup).toEqual([]);
    } finally {
      capture.stop();
    }
  });
});
