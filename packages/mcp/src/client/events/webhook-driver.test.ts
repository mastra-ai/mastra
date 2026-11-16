import type { MastraError } from '@mastra/core/error';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { WEBHOOK_HEADERS, signWebhook } from '../../shared/events';
import type { SubscribeEventsResult } from '../../shared/events';
import { FakePort, occurrence } from './__fixtures__/fake-port';
import { EventSubscription } from './subscription';
import type { MCPClientWebhookOptions } from './types';
import { webhookDriver } from './webhook-driver';
import { WebhookReceiver } from './webhook-receiver';

const URL = 'https://agent.example.com/mcp/webhook';
const NOW = Date.parse('2026-01-01T00:00:00.000Z');
const MINUTE = 60_000;

function granted(overrides: Partial<SubscribeEventsResult> = {}): SubscribeEventsResult {
  return { id: 'sub_1', refreshBefore: new Date(Date.now() + 10 * MINUTE).toISOString(), cursor: 'c0', ...overrides };
}

function setup(options: Partial<MCPClientWebhookOptions> = {}) {
  const receiver = new WebhookReceiver();
  const port = new FakePort();
  port.webhookSetup = { options: { url: URL, ...options }, receiver };
  const start = (args?: Record<string, unknown>, retry = { initialDelayMs: 10 }) =>
    EventSubscription.start({
      port,
      serverName: 'srv',
      name: 'test.event',
      arguments: args,
      driver: webhookDriver,
      options: { retry },
      defaultStreamOpenTimeoutMs: 1000,
      random: () => 1,
    });
  /** POSTs a body signed with the secret the driver sent in its latest subscribe. */
  const post = (id: string, body: unknown, messageId = 'msg_1') => {
    const secret = port.subscribeCalls.at(-1)!.delivery.secret;
    const text = JSON.stringify(body);
    const timestamp = Math.floor(Date.now() / 1000);
    return receiver.handle(
      new Request(URL, {
        method: 'POST',
        body: text,
        headers: {
          [WEBHOOK_HEADERS.id]: messageId,
          [WEBHOOK_HEADERS.timestamp]: String(timestamp),
          [WEBHOOK_HEADERS.signature]: signWebhook({ secret, id: messageId, timestamp, body: text }),
          [WEBHOOK_HEADERS.subscriptionId]: id,
        },
      }),
    );
  };
  return { port, receiver, start, post };
}

describe('webhookDriver', () => {
  beforeEach(() => {
    vi.useFakeTimers({ now: NOW });
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('registers the webhook, routes verified deliveries, and refreshes before refreshBefore with the latest cursor', async () => {
    const { port, start, post } = setup();
    port.queueSubscribe(granted(), granted({ cursor: 'c1' }));
    const sub = await start({ repo: 'mastra' });

    expect(port.subscribeCalls).toHaveLength(1);
    const first = port.subscribeCalls[0]!;
    expect(first).toMatchObject({
      name: 'test.event',
      arguments: { repo: 'mastra' },
      delivery: { mode: 'webhook', url: URL },
      cursor: null,
    });
    expect(first.delivery.secret).toMatch(/^whsec_/);
    expect(sub.mode).toBe('webhook');
    expect(sub.cursor).toBe('c0');

    const response = await post('sub_1', { ...occurrence('e1', { n: 1 }), cursor: 'c1' });
    expect(response.status).toBe(200);
    const next = await sub[Symbol.asyncIterator]().next();
    expect(next.value).toMatchObject({ eventId: 'e1', data: { n: 1 } });
    expect(sub.cursor).toBe('c1');

    // Grant is 10 minutes; the default margin is min(60 s, 20% of 10 min) = 60 s.
    await vi.advanceTimersByTimeAsync(9 * MINUTE - 1);
    expect(port.subscribeCalls).toHaveLength(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(port.subscribeCalls).toHaveLength(2);
    expect(port.subscribeCalls[1]).toMatchObject({ cursor: 'c1', delivery: { secret: first.delivery.secret } });
    await sub.cancel();
  });

  it('honours refreshMarginMs and the configured ttlMs and secret', async () => {
    const secret = 'whsec_' + Buffer.alloc(32, 7).toString('base64');
    const { port, start } = setup({ refreshMarginMs: 5 * MINUTE, ttlMs: 20 * MINUTE, secret });
    port.queueSubscribe(granted());
    const sub = await start();
    expect(port.subscribeCalls[0]).toMatchObject({ ttlMs: 20 * MINUTE, delivery: { secret } });
    expect(port.subscribeCalls[0]).not.toHaveProperty('arguments');

    await vi.advanceTimersByTimeAsync(5 * MINUTE);
    expect(port.subscribeCalls).toHaveLength(2);
    await sub.cancel();
  });

  it('fails instead of refreshing in a loop when refreshBefore is not a timestamp', async () => {
    const { port, start } = setup();
    port.queueSubscribe(granted({ refreshBefore: 'not-a-date' }));
    await expect(start()).rejects.toMatchObject({ id: 'MCP_EVENTS_SUBSCRIPTION_FAILED' });
    await vi.advanceTimersByTimeAsync(1000);
    expect(port.subscribeCalls).toHaveLength(1);
  });

  it('refreshes a no-expiry grant once a day', async () => {
    const { port, start } = setup({ ttlMs: null });
    port.queueSubscribe(granted({ refreshBefore: null }));
    const sub = await start();
    expect(port.subscribeCalls[0]).toMatchObject({ ttlMs: null });
    await vi.advanceTimersByTimeAsync(24 * 60 * MINUTE - 1);
    expect(port.subscribeCalls).toHaveLength(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(port.subscribeCalls).toHaveLength(2);
    await sub.cancel();
  });

  it('reports failing delivery from deliveryStatus and exposes it on the subscription', async () => {
    const { port, start } = setup();
    const failing = { active: false, lastDeliveryAt: null, lastError: 'timeout' as const, failedSince: null };
    port.queueSubscribe(granted(), granted({ deliveryStatus: failing }), granted({ deliveryStatus: { active: true } }));
    const sub = await start();
    expect(sub.deliveryStatus).toBeUndefined();
    const errors: MastraError[] = [];
    sub.onError(error => errors.push(error));

    await vi.advanceTimersByTimeAsync(9 * MINUTE);
    expect(sub.deliveryStatus).toEqual(failing);
    expect(errors).toHaveLength(1);
    expect(errors[0]).toMatchObject({
      id: 'MCP_EVENTS_WEBHOOK_DELIVERY_FAILING',
      details: { active: false, lastError: 'timeout' },
    });

    await vi.advanceTimersByTimeAsync(9 * MINUTE);
    expect(sub.deliveryStatus).toEqual({ active: true });
    expect(errors).toHaveLength(1);
    await sub.cancel();
  });

  it('marks a gap control body as truncated and moves the cursor', async () => {
    const { port, start, post } = setup();
    port.queueSubscribe(granted());
    const sub = await start();
    expect(sub.truncated).toBe(false);

    expect((await post('sub_1', { type: 'gap', cursor: 'c9' }, 'msg_gap_1')).status).toBe(200);
    expect(sub.truncated).toBe(true);
    expect(sub.cursor).toBe('c9');
    await sub.cancel();
  });

  it('ends the subscription with a fatal error on a terminated control body', async () => {
    const { port, start, post } = setup();
    port.queueSubscribe(granted());
    const sub = await start();
    const next = sub[Symbol.asyncIterator]().next();

    await post('sub_1', { type: 'terminated', error: { code: -32024, message: 'revoked' } }, 'msg_terminated_1');
    await expect(next).rejects.toMatchObject({ id: 'MCP_EVENTS_SUBSCRIPTION_TERMINATED', details: { code: -32024 } });
    await vi.advanceTimersByTimeAsync(60 * MINUTE);
    expect(port.subscribeCalls).toHaveLength(1);
    // The server already dropped it, so there is nothing to unsubscribe.
    expect(port.unsubscribeCalls).toHaveLength(0);
  });

  it('backs off and re-subscribes with the same key after a refresh failure', async () => {
    const { port, start, post } = setup();
    port.queueSubscribe(granted(), new Error('connection closed'), granted({ cursor: 'c2' }));
    const sub = await start({ repo: 'mastra' });
    const errors: MastraError[] = [];
    sub.onError(error => errors.push(error));
    await post('sub_1', { ...occurrence('e1'), cursor: 'c1' });
    expect((await sub[Symbol.asyncIterator]().next()).value).toMatchObject({ eventId: 'e1' });

    await vi.advanceTimersByTimeAsync(9 * MINUTE);
    expect(port.subscribeCalls).toHaveLength(2);
    expect(errors[0]).toMatchObject({ id: 'MCP_EVENTS_DELIVERY_INTERRUPTED' });
    // Between sessions the route is gone, so the server is told to retry later.
    expect((await post('sub_1', { ...occurrence('e2'), cursor: 'c2' })).status).toBe(503);

    await vi.advanceTimersByTimeAsync(10);
    expect(port.subscribeCalls).toHaveLength(3);
    expect(port.subscribeCalls[2]).toMatchObject({
      name: 'test.event',
      arguments: { repo: 'mastra' },
      delivery: { url: URL },
      cursor: 'c1',
    });
    expect(sub.cursor).toBe('c2');
    await sub.cancel();
  });

  it('stops retrying when the server rejects the subscription as non-retryable', async () => {
    const { port, start } = setup();
    const { ProtocolError } = await import('@modelcontextprotocol/client');
    port.queueSubscribe(new ProtocolError(-32024, 'Forbidden'));
    await expect(start()).rejects.toBeInstanceOf(Error);
    await vi.advanceTimersByTimeAsync(60 * MINUTE);
    expect(port.subscribeCalls).toHaveLength(1);
  });

  it('cancel unregisters the route and sends a best-effort unsubscribe', async () => {
    const { port, start, post } = setup();
    port.queueSubscribe(granted());
    port.unsubscribeError = new Error('server gone');
    const sub = await start({ repo: 'mastra' });

    await sub.cancel();
    await vi.advanceTimersByTimeAsync(0);
    expect(port.unsubscribeCalls).toEqual([{ name: 'test.event', arguments: { repo: 'mastra' }, delivery: { url: URL } }]);
    expect(port.log).toHaveBeenCalledWith(
      'warning',
      expect.stringContaining('unsubscribe'),
      expect.objectContaining({ error: 'server gone' }),
    );
    expect((await post('sub_1', { ...occurrence('e1'), cursor: 'c1' })).status).not.toBe(200);
    await vi.advanceTimersByTimeAsync(60 * MINUTE);
    expect(port.subscribeCalls).toHaveLength(1);
  });

  it('shares one server subscription between same-key subscriptions and unsubscribes after the last cancel', async () => {
    const { port, start, post } = setup();
    port.queueSubscribe(granted(), granted({ id: 'sub_2' }));
    const a = await start({ repo: 'mastra' });
    const b = await start({ repo: 'mastra' });
    expect(port.subscribeCalls).toHaveLength(1);
    expect(b.cursor).toBe('c0');

    expect((await post('sub_1', { ...occurrence('e1'), cursor: 'c1' })).status).toBe(200);
    expect((await a[Symbol.asyncIterator]().next()).value).toMatchObject({ eventId: 'e1' });
    expect((await b[Symbol.asyncIterator]().next()).value).toMatchObject({ eventId: 'e1' });

    await a.cancel();
    expect(port.unsubscribeCalls).toHaveLength(0);
    expect((await post('sub_1', { ...occurrence('e2'), cursor: 'c2' })).status).toBe(200);
    expect((await b[Symbol.asyncIterator]().next()).value).toMatchObject({ eventId: 'e2' });
    expect(b.cursor).toBe('c2');

    await b.cancel();
    expect(port.unsubscribeCalls).toEqual([{ name: 'test.event', arguments: { repo: 'mastra' }, delivery: { url: URL } }]);
    expect((await post('sub_1', { ...occurrence('e3'), cursor: 'c3' })).status).not.toBe(200);

    // Different arguments are a different server subscription.
    const other = await start({ repo: 'other' });
    expect(port.subscribeCalls).toHaveLength(2);
    await other.cancel();
    expect(port.unsubscribeCalls).toHaveLength(2);
  });

  it('fails when the client has no webhook settings', async () => {
    const port = new FakePort();
    await expect(
      EventSubscription.start({
        port,
        serverName: 'srv',
        name: 'test.event',
        driver: webhookDriver,
        defaultStreamOpenTimeoutMs: 1000,
      }),
    ).rejects.toMatchObject({ id: expect.stringMatching(/^MCP_EVENTS_/) });
    expect(port.subscribeCalls).toHaveLength(0);
  });
});
