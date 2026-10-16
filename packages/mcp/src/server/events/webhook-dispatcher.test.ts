import { noopLogger } from '@mastra/core/logger';
import { ProtocolError } from '@modelcontextprotocol/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { generateWebhookSecret, verifyWebhook } from '../../shared/events';
import type { SubscribeEventsRequestParams, WebhookLookup } from '../../shared/events';
import { ServerEventRegistry } from './registry';
import type { MCPServerWebhookOptions } from './types';
import { WebhookDispatcher } from './webhook-dispatcher';
import { InMemoryWebhookSubscriptionStore } from './webhook-store';
import type { WebhookTransportRequest, WebhookTransportResult } from './webhook-transport';

const URL_A = 'https://hooks.example.com/mcp';
const URL_B = 'https://other.example.com/mcp';
const PUBLIC = { address: '93.184.216.34', family: 4 as const };

interface Sent {
  request: WebhookTransportRequest;
  body: Record<string, unknown>;
  webhookId: string;
  timestamp: string;
  signature: string;
}

type Responder = (sent: Sent) => WebhookTransportResult | Promise<WebhookTransportResult>;

/** Echoes verification challenges and accepts everything else. */
const accept: Responder = sent =>
  sent.body.type === 'verification'
    ? { status: 200, body: JSON.stringify({ challenge: sent.body.challenge }) }
    : { status: 200, body: '' };

function setup(options: Partial<MCPServerWebhookOptions> = {}) {
  const registry = new ServerEventRegistry(
    {
      tasks: { match: (args, data) => !args.project || data.project === args.project },
      polled: { poll: async () => ({ events: [], cursor: null }) },
    },
    { webhook: true },
  );
  const sent: Sent[] = [];
  let responder: Responder = accept;
  let answers: Awaited<ReturnType<WebhookLookup>> = [PUBLIC];
  const store = new InMemoryWebhookSubscriptionStore();
  const dispatcher = new WebhookDispatcher({
    registry,
    getLogger: () => noopLogger,
    random: () => 0,
    options: {
      store,
      url: { lookup: async () => answers },
      transport: async request => {
        const entry: Sent = {
          request,
          body: JSON.parse(request.body),
          webhookId: request.headers['webhook-id']!,
          timestamp: request.headers['webhook-timestamp']!,
          signature: request.headers['webhook-signature']!,
        };
        sent.push(entry);
        return responder(entry);
      },
      ...options,
    },
  });
  const tasks = registry.list().find(event => event.name === 'tasks')!;
  return {
    registry,
    dispatcher,
    store,
    sent,
    tasks,
    events: () => sent.filter(entry => entry.body.eventId !== undefined),
    controls: (type: string) => sent.filter(entry => entry.body.type === type),
    respond: (next: Responder) => (responder = next),
    resolveTo: (next: Awaited<ReturnType<WebhookLookup>>) => (answers = next),
    subscribe: (overrides: Partial<SubscribeEventsRequestParams> & { secret?: string; principal?: string } = {}) => {
      const { secret = SECRET, principal = 'alice', ...params } = overrides;
      const args = params.arguments ?? {};
      return dispatcher.subscribe(
        tasks,
        args,
        {
          name: 'tasks',
          arguments: args,
          cursor: null,
          ...params,
          delivery: { mode: 'webhook', url: params.delivery?.url ?? URL_A, secret },
        },
        principal,
      );
    },
  };
}

const SECRET = generateWebhookSecret();
const ROTATED = generateWebhookSecret();

function verifies(sent: Sent, secret: string) {
  return verifyWebhook({
    secret,
    headers: sent.request.headers,
    body: sent.request.body,
  }).ok;
}

async function rejection(promise: Promise<unknown>) {
  try {
    await promise;
  } catch (error) {
    return error;
  }
  throw new Error('expected a rejection');
}

let harness: ReturnType<typeof setup> | undefined;
function create(options: Partial<MCPServerWebhookOptions> = {}) {
  harness = setup(options);
  return harness;
}

beforeEach(() => {
  vi.useFakeTimers({ now: new Date('2026-01-01T00:00:00.000Z') });
});

afterEach(() => {
  harness?.dispatcher.close();
  harness = undefined;
  vi.useRealTimers();
});

describe('WebhookDispatcher subscribe', () => {
  it('upserts idempotently per (principal, url, name, arguments)', async () => {
    const h = create();
    const first = await h.subscribe({ arguments: { project: 'a' } });
    const again = await h.subscribe({ arguments: { project: 'a' } });
    expect(first.id).toMatch(/^sub_[\w-]{24}$/);
    expect(again.id).toBe(first.id);
    expect((await h.store.list('tasks')).length).toBe(1);

    const ids = new Set([
      first.id,
      (await h.subscribe({ arguments: { project: 'a' }, principal: 'bob' })).id,
      (await h.subscribe({ arguments: { project: 'a' }, delivery: { mode: 'webhook', url: URL_B, secret: SECRET } }))
        .id,
      (await h.subscribe({ arguments: { project: 'b' } })).id,
    ]);
    expect(ids.size).toBe(4);
    expect(
      WebhookDispatcher.subscriptionId({ principal: 'alice', url: URL_A, name: 'polled', arguments: { project: 'a' } }),
    ).not.toBe(first.id);
  });

  it('returns deliveryStatus only when refreshing a live subscription', async () => {
    const h = create();
    expect(await h.subscribe()).not.toHaveProperty('deliveryStatus');
    expect((await h.subscribe()).deliveryStatus).toEqual({ active: true, lastDeliveryAt: null, lastError: null });
  });

  it('grants the default TTL and clamps suggestions to the floor and ceiling', async () => {
    const h = create({ ttl: { defaultMs: 600_000, minMs: 60_000, maxMs: 3_600_000 } });
    const now = Date.now();
    const at = (ms: number) => new Date(now + ms).toISOString();
    expect((await h.subscribe()).refreshBefore).toBe(at(600_000));
    expect((await h.subscribe({ ttlMs: 1000 })).refreshBefore).toBe(at(60_000));
    expect((await h.subscribe({ ttlMs: 10 * 3_600_000 })).refreshBefore).toBe(at(3_600_000));
    expect((await h.subscribe({ ttlMs: 120_000 })).refreshBefore).toBe(at(120_000));
  });

  it('honours a no-expiry request only when allowNoExpiry is set', async () => {
    const finite = create({ ttl: { maxMs: 3_600_000 } });
    expect((await finite.subscribe({ ttlMs: null })).refreshBefore).toBe(
      new Date(Date.now() + 3_600_000).toISOString(),
    );
    finite.dispatcher.close();

    const unbounded = create({ allowNoExpiry: true });
    expect((await unbounded.subscribe({ ttlMs: null })).refreshBefore).toBeNull();
  });

  it('rejects disallowed callback URLs with InvalidParams and no resolver detail', async () => {
    const h = create();
    const insecure = await rejection(
      h.subscribe({ delivery: { mode: 'webhook', url: 'http://x.example.com/', secret: SECRET } }),
    );
    expect(insecure).toBeInstanceOf(ProtocolError);
    expect(insecure).toMatchObject({ code: -32602, data: { reason: 'insecure_scheme' } });

    h.resolveTo([{ address: '10.0.0.7', family: 4 }]);
    const internal = await rejection(h.subscribe());
    expect(internal).toMatchObject({ code: -32602, data: { reason: 'disallowed_address' } });
    expect(JSON.stringify(internal)).not.toContain('10.0.0.7');

    h.resolveTo([]);
    expect(await rejection(h.subscribe())).toMatchObject({ code: -32027, data: { reason: 'connection_refused' } });
    expect(h.sent).toEqual([]);
  });
});

describe('WebhookDispatcher verification', () => {
  it('activates only after the endpoint echoes a signed challenge', async () => {
    const h = create();
    const { id } = await h.subscribe();
    expect(h.sent).toHaveLength(1);
    const [verification] = h.sent;
    expect(verification!.body).toEqual({ type: 'verification', challenge: expect.any(String) });
    expect(verification!.webhookId).toMatch(/^msg_verification_/);
    expect(verification!.request.headers['x-mcp-subscription-id']).toBe(id);
    expect(verifies(verification!, SECRET)).toBe(true);
  });

  it('fails with challenge_failed when the echo is wrong or the status is not 2xx', async () => {
    const h = create();
    h.respond(() => ({ status: 200, body: JSON.stringify({ challenge: 'wrong' }) }));
    expect(await rejection(h.subscribe())).toMatchObject({ code: -32027, data: { reason: 'challenge_failed' } });
    h.respond(sent => ({ status: 500, body: JSON.stringify({ challenge: sent.body.challenge }) }));
    expect(await rejection(h.subscribe())).toMatchObject({ code: -32027, data: { reason: 'challenge_failed' } });
    expect(await h.store.list('tasks')).toEqual([]);
  });

  it('reports an unreachable endpoint with the transport category', async () => {
    const h = create();
    h.respond(() => ({ error: 'timeout' }));
    expect(await rejection(h.subscribe())).toMatchObject({ code: -32027, data: { reason: 'timeout' } });
  });

  it('caches a verified (principal, url) pair until verificationTtlMs passes', async () => {
    const h = create({ verificationTtlMs: 60_000 });
    await h.subscribe({ arguments: { project: 'a' } });
    await h.subscribe({ arguments: { project: 'b' } });
    expect(h.controls('verification')).toHaveLength(1);
    await h.subscribe({ principal: 'bob' });
    expect(h.controls('verification')).toHaveLength(2);
    await vi.advanceTimersByTimeAsync(60_001);
    await h.subscribe({ arguments: { project: 'a' } });
    expect(h.controls('verification')).toHaveLength(3);
  });

  it('skips the handshake for allowlisted URLs', async () => {
    const h = create({ allowedUrls: url => url.hostname === 'hooks.example.com' });
    await h.subscribe();
    expect(h.sent).toEqual([]);
  });
});

describe('WebhookDispatcher delivery', () => {
  it('POSTs an emitted event only to matching subscriptions, signed and addressed to the pinned IP', async () => {
    const h = create();
    const a = await h.subscribe({ arguments: { project: 'a' } });
    await h.subscribe({ arguments: { project: 'b' } });
    await vi.advanceTimersByTimeAsync(1_200_000);
    expect(h.events()).toEqual([]);

    const occurrence = await h.registry.emit('tasks', { project: 'a' }, { eventId: 'evt_1' });
    await vi.advanceTimersByTimeAsync(0);

    expect(h.events()).toHaveLength(1);
    const [delivery] = h.events();
    expect(delivery!.request.address).toBe(PUBLIC.address);
    expect(delivery!.request.headers['x-mcp-subscription-id']).toBe(a.id);
    expect(delivery!.webhookId).toBe('evt_1');
    expect(delivery!.body).toMatchObject({ eventId: 'evt_1', name: 'tasks', data: { project: 'a' } });
    expect(delivery!.body.cursor).toBe(a.cursor);
    expect(verifies(delivery!, SECRET)).toBe(true);

    await h.registry.emit('tasks', { project: 'a' }, { eventId: 'evt_2' });
    await vi.advanceTimersByTimeAsync(0);
    expect(h.events().at(-1)!.body.cursor).toBe(occurrence.cursor);
  });

  it('stops delivering once the subscription expires', async () => {
    const h = create();
    const { id } = await h.subscribe({ ttlMs: 60_000 });
    await vi.advanceTimersByTimeAsync(60_001);
    await h.registry.emit('tasks', { project: 'a' });
    await vi.advanceTimersByTimeAsync(0);
    expect(h.events()).toEqual([]);
    expect(await h.store.get(id)).toBeUndefined();
  });

  it('replays from a supplied cursor and reports truncation', async () => {
    const h = create();
    const first = await h.registry.emit('tasks', { project: 'a' }, { eventId: 'evt_1' });
    await h.registry.emit('tasks', { project: 'b' }, { eventId: 'evt_2' });
    await h.registry.emit('tasks', { project: 'a' }, { eventId: 'evt_3' });

    const result = await h.subscribe({ arguments: { project: 'a' }, cursor: first.cursor });
    await vi.advanceTimersByTimeAsync(0);
    expect(result).not.toHaveProperty('truncated');
    expect(h.events().map(entry => entry.webhookId)).toEqual(['evt_3']);

    const foreign = await h.subscribe({ arguments: { project: 'c' }, cursor: 'Zm9yZWlnbjox' });
    expect(foreign.truncated).toBe(true);
  });

  it('retries with backoff, regenerating timestamp and signature under the same webhook-id', async () => {
    const h = create({ retry: { initialDelayMs: 2000 } });
    await h.subscribe();
    let calls = 0;
    h.respond(sent => (sent.body.eventId && ++calls < 3 ? { status: 503, body: '' } : accept(sent)));

    await h.registry.emit('tasks', { project: 'a' }, { eventId: 'evt_1' });
    await vi.advanceTimersByTimeAsync(0);
    expect(h.events()).toHaveLength(1);
    await vi.advanceTimersByTimeAsync(999);
    expect(h.events()).toHaveLength(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(h.events()).toHaveLength(2);
    await vi.advanceTimersByTimeAsync(2000);
    expect(h.events()).toHaveLength(3);

    const attempts = h.events();
    expect(new Set(attempts.map(entry => entry.webhookId))).toEqual(new Set(['evt_1']));
    expect(new Set(attempts.map(entry => entry.timestamp)).size).toBe(3);
    expect(new Set(attempts.map(entry => entry.signature)).size).toBe(3);
    expect(attempts.every(entry => verifies(entry, SECRET))).toBe(true);

    await vi.advanceTimersByTimeAsync(600_000);
    expect(h.events()).toHaveLength(3);
  });

  it.each([410, 413])('does not retry a %i response', async status => {
    const h = create();
    await h.subscribe();
    h.respond(sent => (sent.body.eventId ? { status, body: '' } : accept(sent)));
    await h.registry.emit('tasks', {}, { eventId: 'evt_1' });
    await vi.advanceTimersByTimeAsync(1_200_000);
    expect(h.events()).toHaveLength(1);
    expect((await h.subscribe()).deliveryStatus?.lastError).toBeNull();
  });

  it('abandons an event after maxAttempts and reports the failure', async () => {
    const h = create({ retry: { maxAttempts: 3 } });
    await h.subscribe();
    h.respond(sent => (sent.body.eventId ? { error: 'connection_refused' } : accept(sent)));
    const occurrence = await h.registry.emit('tasks', {}, { eventId: 'evt_1' });
    await vi.advanceTimersByTimeAsync(1_200_000);
    expect(h.events()).toHaveLength(3);

    const refreshed = await h.subscribe();
    expect(refreshed.cursor).toBe(occurrence.cursor);
    expect(refreshed.deliveryStatus).toEqual({
      active: true,
      lastDeliveryAt: null,
      lastError: 'connection_refused',
      failedSince: '2026-01-01T00:00:00.000Z',
    });
  });

  it('never advances the watermark past an unacknowledged earlier event', async () => {
    const h = create({ retry: { initialDelayMs: 1000 } });
    const { cursor: start } = await h.subscribe();
    let failFirst = true;
    h.respond(sent => {
      if (sent.body.eventId === 'evt_1' && failFirst) return { status: 500, body: '' };
      return accept(sent);
    });

    await h.registry.emit('tasks', {}, { eventId: 'evt_1' });
    const second = await h.registry.emit('tasks', {}, { eventId: 'evt_2' });
    await vi.advanceTimersByTimeAsync(0);
    expect((await h.subscribe()).cursor).toBe(start);

    failFirst = false;
    await vi.advanceTimersByTimeAsync(1000);
    expect((await h.subscribe()).cursor).toBe(second.cursor);

    await h.registry.emit('tasks', {}, { eventId: 'evt_3' });
    await vi.advanceTimersByTimeAsync(0);
    expect(h.events().at(-1)!.body.cursor).toBe(second.cursor);
  });

  it('dual-signs with the previous secret during the grace window only', async () => {
    const h = create({ secretGraceMs: 60_000 });
    await h.subscribe();
    await h.subscribe({ secret: ROTATED });

    await h.registry.emit('tasks', {}, { eventId: 'evt_1' });
    await vi.advanceTimersByTimeAsync(0);
    const during = h.events().at(-1)!;
    expect(during.signature.split(' ')).toHaveLength(2);
    expect(verifies(during, ROTATED)).toBe(true);
    expect(verifies(during, SECRET)).toBe(true);

    await vi.advanceTimersByTimeAsync(60_001);
    await h.registry.emit('tasks', {}, { eventId: 'evt_2' });
    await vi.advanceTimersByTimeAsync(0);
    const after = h.events().at(-1)!;
    expect(verifies(after, ROTATED)).toBe(true);
    expect(verifies(after, SECRET)).toBe(false);
  });

  it('does not POST when the hostname turns private at delivery time', async () => {
    const h = create();
    await h.subscribe();
    h.resolveTo([{ address: '127.0.0.1', family: 4 }]);
    await h.registry.emit('tasks', {}, { eventId: 'evt_1' });
    await vi.advanceTimersByTimeAsync(1_200_000);
    expect(h.events()).toEqual([]);
    h.resolveTo([PUBLIC]);
    expect((await h.subscribe()).deliveryStatus?.lastError).toBe('connection_refused');
  });
});

describe('WebhookDispatcher suspension and control envelopes', () => {
  const suspend = { windowMs: 600_000, minAttempts: 3, failureRate: 0.9 };

  it('suspends after sustained failure and resumes pending deliveries on refresh', async () => {
    const h = create({ suspend, retry: { maxAttempts: 10, initialDelayMs: 1000 } });
    await h.subscribe();
    h.respond(sent => (sent.body.eventId ? { status: 500, body: '' } : accept(sent)));
    await h.registry.emit('tasks', {}, { eventId: 'evt_1' });
    await vi.advanceTimersByTimeAsync(10_000);
    expect(h.events()).toHaveLength(3);
    await vi.advanceTimersByTimeAsync(1_200_000);
    expect(h.events()).toHaveLength(3);

    h.respond(accept);
    const refreshed = await h.subscribe();
    expect(refreshed.deliveryStatus).toEqual({
      active: false,
      lastDeliveryAt: null,
      lastError: 'http_5xx',
      failedSince: '2026-01-01T00:00:00.000Z',
    });
    await vi.advanceTimersByTimeAsync(0);
    expect(h.events()).toHaveLength(4);
    expect((await h.subscribe()).deliveryStatus).toMatchObject({ active: true, lastError: null });
  });

  it('terminates a no-expiry subscription that stays suspended', async () => {
    const h = create({ allowNoExpiry: true, suspend, retry: { maxAttempts: 10, initialDelayMs: 1000 } });
    const { id } = await h.subscribe({ ttlMs: null });
    h.respond(sent => (sent.body.eventId ? { status: 500, body: '' } : accept(sent)));
    await h.registry.emit('tasks', {}, { eventId: 'evt_1' });
    await vi.advanceTimersByTimeAsync(10_000);
    expect(h.controls('terminated')).toEqual([]);

    await vi.advanceTimersByTimeAsync(suspend.windowMs);
    const [terminated] = h.controls('terminated');
    expect(terminated!.body).toEqual({
      type: 'terminated',
      error: { code: -32027, message: expect.any(String), data: { reason: 'http_5xx' } },
    });
    expect(terminated!.webhookId).toMatch(/^msg_terminated_/);
    expect(verifies(terminated!, SECRET)).toBe(true);
    expect(await h.store.get(id)).toBeUndefined();
  });

  it('sends a gap with a fresh cursor when pending deliveries overflow', async () => {
    const h = create({ maxPending: 2 });
    await h.subscribe();
    h.respond(sent => (sent.body.eventId ? new Promise<WebhookTransportResult>(() => {}) : accept(sent)));
    await h.registry.emit('tasks', {}, { eventId: 'evt_1' });
    const second = await h.registry.emit('tasks', {}, { eventId: 'evt_2' });
    await h.registry.emit('tasks', {}, { eventId: 'evt_3' });
    await vi.advanceTimersByTimeAsync(0);

    const [gap] = h.controls('gap');
    expect(gap!.body).toEqual({ type: 'gap', cursor: second.cursor });
    expect(gap!.webhookId).toMatch(/^msg_gap_/);
    expect(verifies(gap!, SECRET)).toBe(true);
    expect(h.events().map(entry => entry.webhookId)).toEqual(['evt_1', 'evt_2', 'evt_3']);
  });
});

describe('WebhookDispatcher unsubscribe', () => {
  it('stops delivery and answers the same for unknown keys', async () => {
    const h = create();
    const { id } = await h.subscribe();
    await h.dispatcher.unsubscribe({ principal: 'alice', url: URL_A, name: 'tasks', arguments: {} });
    await h.dispatcher.unsubscribe({ principal: 'mallory', url: URL_A, name: 'tasks', arguments: {} });
    expect(await h.store.get(id)).toBeUndefined();
    await h.registry.emit('tasks', {});
    await vi.advanceTimersByTimeAsync(0);
    expect(h.events()).toEqual([]);
  });
});
