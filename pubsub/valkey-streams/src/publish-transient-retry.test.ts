import { randomUUID } from 'node:crypto';
import type { Event } from '@mastra/core/events';
import { afterEach, describe, expect, it } from 'vitest';
import { makeRefusingProxy, makeXaddDropProxy, valkeyTarget, VALKEY_URL, waitFor } from '../test-fixtures/harness';
import { PublishRetryBudgetExhaustedError, ValkeyStreamsPubSub } from './index';

// A dropped connection fails the XADD in flight on it. GLIDE reconnects but does
// not resend it, so publish must retry or the event is lost.
describe('publish retries when the connection drops mid-XADD', () => {
  const cleanups: Array<() => Promise<unknown>> = [];

  afterEach(async () => {
    while (cleanups.length) await cleanups.pop()!().catch(() => {});
  });

  it.each(['before', 'after'] as const)(
    'delivers the event when the connection drops %s Valkey writes it',
    async mode => {
      const proxy = makeXaddDropProxy(valkeyTarget(), mode);
      cleanups.push(() => proxy.close());
      const port = await proxy.listening;
      const keyPrefix = `publish-retry-${randomUUID()}`;

      const publisher = new ValkeyStreamsPubSub({ url: `valkey://127.0.0.1:${port}`, keyPrefix, blockMs: 50 });
      cleanups.push(() => publisher.close());
      const subscriber = new ValkeyStreamsPubSub({ url: VALKEY_URL, keyPrefix, blockMs: 50 });
      cleanups.push(() => subscriber.close());

      const received: Event[] = [];
      await subscriber.subscribe('topic', async (event, ack) => {
        received.push(event);
        await ack?.();
      });

      await publisher.publish('topic', { type: 'test.event', runId: 'run-1', data: { n: 1 } });

      expect(proxy.dropped).toBe(true);
      await waitFor(async () => received.length > 0, 10_000);
      if (mode === 'after') {
        await waitFor(async () => received.length >= 2, 10_000);
      }
      // A lost reply means the retry appends a second copy of the same event id.
      const ids = new Set(received.map(event => event.id));
      expect(ids.size).toBe(1);
      expect(received[0]!.data).toEqual({ n: 1 });
      if (mode === 'before') {
        await new Promise(resolve => setTimeout(resolve, 300));
        expect(received).toHaveLength(1);
      }
    },
    30_000,
  );
});

// GLIDE fails a request against a gone server in milliseconds (a closed channel
// is a `ConnectionError`, later attempts time out on the request timeout) rather
// than parking it, so publish must still give up once its budget is spent.
describe('publish gives up when Valkey stays down after the drop', () => {
  const cleanups: Array<() => Promise<unknown>> = [];

  afterEach(async () => {
    while (cleanups.length) await cleanups.pop()!().catch(() => {});
  });

  it('rejects with PublishRetryBudgetExhaustedError once the retry budget runs out', async () => {
    const proxy = makeXaddDropProxy(valkeyTarget(), 'before', { closeListenerAfterDrop: true });
    cleanups.push(() => proxy.close());
    const port = await proxy.listening;
    const publisher = new ValkeyStreamsPubSub({
      url: `valkey://127.0.0.1:${port}`,
      keyPrefix: `publish-budget-${randomUUID()}`,
      publishRetryBudgetMs: 2_000,
    });
    cleanups.push(() => publisher.close());

    const startedAt = Date.now();
    const publishing = publisher.publish('topic', { type: 'test.event', runId: 'run-1', data: { n: 1 } });
    await expect(publishing).rejects.toBeInstanceOf(PublishRetryBudgetExhaustedError);
    expect(proxy.dropped).toBe(true);
    expect(Date.now() - startedAt).toBeLessThan(5_000);
  }, 15_000);
});

// A failed cold connect leaves the cached client promise rejected. Unless it is
// dropped, `isOpen` keeps reporting the writer as usable, `#ensureWriterConnected`
// returns early, and every later publish awaits the same rejection forever.
describe('publish recovers after a failed connect', () => {
  const cleanups: Array<() => Promise<unknown>> = [];

  afterEach(async () => {
    while (cleanups.length) await cleanups.pop()!().catch(() => {});
  });

  it('connects and delivers once Valkey is reachable again', async () => {
    const proxy = makeRefusingProxy(valkeyTarget());
    cleanups.push(() => proxy.close());
    const port = await proxy.listening;
    const keyPrefix = `publish-recover-${randomUUID()}`;

    const publisher = new ValkeyStreamsPubSub({
      url: `valkey://127.0.0.1:${port}`,
      keyPrefix,
      blockMs: 50,
      // Bound the failing cold connect instead of waiting out GLIDE's 2s default.
      valkeyOptions: { advancedConfiguration: { connectionTimeout: 500 } },
    });
    cleanups.push(() => publisher.close());
    const subscriber = new ValkeyStreamsPubSub({ url: VALKEY_URL, keyPrefix, blockMs: 50 });
    cleanups.push(() => subscriber.close());

    const received: Event[] = [];
    await subscriber.subscribe('topic', async (event, ack) => {
      received.push(event);
      await ack?.();
    });

    let failed: Error | undefined;
    try {
      await publisher.publish('topic', { type: 'test.event', runId: 'run-1', data: { n: 1 } });
    } catch (error) {
      failed = error as Error;
    }
    expect(failed).toBeDefined();
    expect(['ClosingError', 'ConnectionError']).toContain(failed!.name);

    proxy.accept();
    await publisher.publish('topic', { type: 'test.event', runId: 'run-1', data: { n: 1 } });
    await waitFor(async () => received.length > 0, 10_000);
    expect(received[0]!.data).toEqual({ n: 1 });
  }, 30_000);
});
