import type http from 'node:http';
import path from 'node:path';
import { noopObserve } from '@mastra/core/tools';
import type { AuthInfo } from '@modelcontextprotocol/server';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { MCPClient } from '../../client/configuration';
import type { MCPClientWebhookOptions, MCPEventOccurrence, MCPEventSubscribeOptions } from '../../client/events';
import { serveHTTP } from '../../server/__tests__/harness.mock';
import { InMemoryWebhookSubscriptionStore } from '../../server/events';
import type { MCPServerWebhookOptions, WebhookSubscriptionRecord } from '../../server/events';
import { createEventsServer } from './fixture';
import { rejectionOf, take } from './helpers';
import { serveWebhookReceiver, waitFor } from './webhook-receiver';

vi.setConfig({ testTimeout: 30_000, hookTimeout: 30_000 });

const tsxCli = path.join(path.dirname(require.resolve('tsx/package.json')), 'dist', 'cli.mjs');

/** Records writes and deletes, so tests can see subscribe, refresh and unsubscribe reach the server. */
class RecordingStore extends InMemoryWebhookSubscriptionStore {
  readonly writes: WebhookSubscriptionRecord[] = [];
  readonly deletes: string[] = [];
  override async set(record: WebhookSubscriptionRecord): Promise<void> {
    this.writes.push(record);
    await super.set(record);
  }
  override async delete(id: string): Promise<void> {
    this.deletes.push(id);
    await super.delete(id);
  }
  /** The id the server gave the subscription for these arguments. */
  idFor(args: Record<string, unknown>): string {
    const record = this.writes.find(write => JSON.stringify(write.arguments) === JSON.stringify(args));
    if (!record) throw new Error(`No subscription stored for ${JSON.stringify(args)}`);
    return record.id;
  }
}

function authFromHeader(req: http.IncomingMessage): AuthInfo | undefined {
  const token = req.headers.authorization?.replace(/^Bearer /, '');
  return token ? { token, clientId: token, scopes: [] } : undefined;
}

const cleanups: (() => Promise<void>)[] = [];
afterEach(async () => {
  for (const cleanup of cleanups.splice(0).reverse()) await cleanup();
});

let clientCount = 0;

/**
 * A real MCPServer served over Streamable HTTP with bearer authentication, a real webhook receiver
 * mounting `mcp.events.handleWebhook`, and a real MCPClient. The URL policy is relaxed here only,
 * because the receiver listens on plain `http` on loopback.
 */
async function setup(
  options: {
    server?: Partial<MCPServerWebhookOptions>;
    client?: Partial<MCPClientWebhookOptions>;
    token?: string | null;
  } = {},
) {
  const store = new RecordingStore();
  const { server } = createEventsServer({
    webhook: {
      store,
      url: { allowPrivate: true, allowInsecure: true },
      retry: { initialDelayMs: 20, maxDelayMs: 50 },
      ...options.server,
    },
  });
  const served = await serveHTTP(server, { auth: authFromHeader });
  cleanups.push(() => served.close());

  let mcp: MCPClient | undefined;
  const receiver = await serveWebhookReceiver(request => mcp!.events.handleWebhook(request));
  cleanups.push(() => receiver.close());

  const token = options.token === undefined ? 'alice' : options.token;
  const client = (webhook: MCPClientWebhookOptions | undefined) => {
    const created = new MCPClient({
      id: `webhook-interop-${++clientCount}`,
      servers: {
        events: {
          url: served.url,
          ...(token ? { requestInit: { headers: { authorization: `Bearer ${token}` } } } : {}),
        },
      },
      ...(webhook ? { webhook } : {}),
    });
    cleanups.push(() => created.disconnect());
    return created;
  };
  mcp = client({ url: receiver.url, ...options.client });

  const subscribe = (args: Record<string, unknown>, subscribeOptions?: MCPEventSubscribeOptions) =>
    mcp!.events.subscribe('events', 'ticket.created', args, subscribeOptions);
  const emit = async (id: string, project: string) => {
    await server.events.emit('ticket.created', { id, project }, { eventId: id });
  };

  return { mcp, store, receiver, subscribe, emit, client };
}

const ticketIds = (occurrences: MCPEventOccurrence[]) => occurrences.map(occurrence => occurrence.data.id);
const quietWindow = () => new Promise(resolve => setTimeout(resolve, 100));

describe('MCPClient ↔ MCPServer webhook delivery over Streamable HTTP', () => {
  it('advertises webhook only for emit-fed types and prefers it when the client is configured', async () => {
    const { mcp, subscribe, client } = await setup();

    const descriptors = await mcp.events.list('events');
    expect(Object.fromEntries(descriptors.map(descriptor => [descriptor.name, descriptor.delivery]))).toEqual({
      'ticket.created': ['push', 'poll', 'webhook'],
      'build.finished': ['poll'],
    });

    const viaWebhook = await subscribe({ project: 'mode' });
    expect(viaWebhook.mode).toBe('webhook');
    await viaWebhook.cancel();

    const withoutWebhook = await client(undefined).events.subscribe('events', 'ticket.created', { project: 'mode' });
    expect(withoutWebhook.mode).toBe('push');
    await withoutWebhook.cancel();
  });

  it('delivers only matching occurrences emitted after subscribing, routed per subscription', async () => {
    const { store, receiver, subscribe, emit } = await setup();

    await emit('early', 'hook-a');
    const subA = await subscribe({ project: 'hook-a' });
    const subB = await subscribe({ project: 'hook-b' });
    expect([subA.mode, subB.mode]).toEqual(['webhook', 'webhook']);

    await emit('a1', 'hook-a');
    await emit('b1', 'hook-b');
    await emit('a2', 'hook-a');

    expect(ticketIds(await take(subA, 2))).toEqual(['a1', 'a2']);
    expect(ticketIds(await take(subB, 1))).toEqual(['b1']);

    // One shared receiver URL, one POST per matching occurrence, addressed to its own subscription.
    const idA = store.idFor({ project: 'hook-a' });
    const idB = store.idFor({ project: 'hook-b' });
    expect(idA).not.toBe(idB);
    await quietWindow();
    expect(receiver.deliveries()).toEqual(
      expect.arrayContaining([
        { status: 200, subscriptionId: idA },
        { status: 200, subscriptionId: idB },
      ]),
    );
    expect(receiver.deliveries().filter(delivery => delivery.subscriptionId === idA)).toHaveLength(2);
    expect(receiver.deliveries().filter(delivery => delivery.subscriptionId === idB)).toHaveLength(1);
  });

  it('resumes from a saved cursor after unsubscribing, without missing or repeating occurrences', async () => {
    const { store, receiver, subscribe, emit } = await setup();
    const args = { project: 'hook-resume' };

    const first = await subscribe(args);
    await emit('r1', 'hook-resume');
    expect(ticketIds(await take(first, 1))).toEqual(['r1']);
    const cursor = first.cursor;
    expect(cursor).not.toBeNull();

    const id = store.idFor(args);
    await first.cancel();
    await waitFor(() => store.deletes.includes(id), 5000, 'the unsubscribe to reach the server');

    await emit('r2', 'hook-resume');
    await emit('r3', 'hook-resume');
    const deliveredWhileAway = receiver.deliveries().length;
    await quietWindow();
    expect(receiver.deliveries()).toHaveLength(deliveredWhileAway);

    const resumed = await subscribe(args, { cursor });
    await emit('r4', 'hook-resume');
    // SEP-3415 makes a webhook body's `cursor` a watermark that only covers acknowledged events, so the
    // cursor that arrived with r1 is the position before r1. Resuming from it redelivers r1 once
    // (at least once); a consumer drops it by `eventId`. Nothing emitted while unsubscribed is lost.
    const replayed = await take(resumed, 4);
    expect(ticketIds(replayed)).toEqual(['r1', 'r2', 'r3', 'r4']);
    expect(new Set(replayed.map(occurrence => occurrence.eventId)).size).toBe(4);
  });

  it('resubscribing with the same arguments while the previous unsubscribe is in flight loses nothing', async () => {
    const { store, subscribe, emit } = await setup();
    const args = { project: 'hook-race' };

    const first = await subscribe(args);
    await emit('q1', 'hook-race');
    expect(ticketIds(await take(first, 1))).toEqual(['q1']);
    const cursor = first.cursor;
    const id = store.idFor(args);

    const cancelling = first.cancel();
    const second = await subscribe(args, { cursor });
    await cancelling;

    await emit('q2', 'hook-race');
    // The resubscription replays q1 (see the resume test) and then delivers q2: nothing is lost.
    expect(ticketIds(await take(second, 2))).toEqual(['q1', 'q2']);
    expect(await store.list('ticket.created')).toHaveLength(1);
  });

  it('shares one server subscription between same-argument webhook subscriptions until the last cancel', async () => {
    const { store, subscribe, emit } = await setup();
    const args = { project: 'hook-shared' };
    const first = await subscribe(args);
    const second = await subscribe(args);
    expect(await store.list('ticket.created')).toHaveLength(1);

    await emit('s1', 'hook-shared');
    expect(ticketIds(await take(first, 1))).toEqual(['s1']);
    expect(ticketIds(await take(second, 1))).toEqual(['s1']);

    await first.cancel();
    await emit('s2', 'hook-shared');
    expect(ticketIds(await take(second, 1))).toEqual(['s2']);
    expect(store.deletes).toEqual([]);
    expect(await store.list('ticket.created')).toHaveLength(1);

    await second.cancel();
    await waitFor(() => store.deletes.length === 1, 5000, 'the last cancel to unsubscribe');
    expect(await store.list('ticket.created')).toEqual([]);
  });

  it('refreshes before the grant expires and keeps delivering', async () => {
    const { store, subscribe, emit } = await setup({
      server: { ttl: { minMs: 1000, defaultMs: 1500 } },
      client: { refreshMarginMs: 500 },
    });

    const subscription = await subscribe({ project: 'hook-refresh' });
    const [record] = store.writes;
    expect(subscription.deliveryStatus).toBeUndefined();

    await waitFor(
      () => store.writes.length >= 2 && subscription.deliveryStatus !== undefined,
      5000,
      'the client to refresh its subscription',
    );
    expect(store.writes[1]).toMatchObject({ id: record!.id, secret: record!.secret });
    expect(subscription.deliveryStatus).toMatchObject({ active: true, lastError: null });

    await emit('after-refresh', 'hook-refresh');
    expect(ticketIds(await take(subscription, 1))).toEqual(['after-refresh']);
  });

  describe('errors', () => {
    it('rejects forcing webhook on a poll-only type', async () => {
      const { mcp } = await setup();
      const error = await rejectionOf(
        mcp.events.subscribe('events', 'build.finished', { branch: 'main' }, { delivery: 'webhook' }),
      );
      expect(error).toMatchObject({
        id: 'MCP_CLIENT_SUBSCRIBE_EVENT_FAILED',
        cause: { id: 'MCP_EVENTS_NO_COMPATIBLE_DELIVERY_MODE' },
      });
    });

    it('rejects forcing webhook when the client has no webhook settings', async () => {
      const { client } = await setup();
      const error = await rejectionOf(
        client(undefined).events.subscribe('events', 'ticket.created', { project: 'x' }, { delivery: 'webhook' }),
      );
      expect(error).toMatchObject({
        id: 'MCP_CLIENT_SUBSCRIBE_EVENT_FAILED',
        cause: { id: 'MCP_EVENTS_WEBHOOK_NOT_CONFIGURED' },
      });
    });

    it('rejects forced webhook from an unauthenticated caller and falls back by default', async () => {
      const { mcp, emit } = await setup({ token: null });

      const forced = await rejectionOf(
        mcp.events.subscribe('events', 'ticket.created', { project: 'anon' }, { delivery: 'webhook' }),
      );
      expect(forced).toMatchObject({
        id: 'MCP_CLIENT_SUBSCRIBE_EVENT_FAILED',
        cause: { id: 'MCP_EVENTS_SUBSCRIPTION_FAILED' },
      });

      // Without forcing a mode, the client falls back to push and reports why once.
      const byDefault = await mcp.events.subscribe('events', 'ticket.created', { project: 'anon' });
      expect(byDefault.mode).toBe('push');
      const errors: unknown[] = [];
      byDefault.onError(error => errors.push(error));
      expect(errors).toEqual([
        expect.objectContaining({
          id: 'MCP_EVENTS_WEBHOOK_UNAVAILABLE',
          details: expect.objectContaining({ fallback: 'push' }),
        }),
      ]);
      await emit('anon-1', 'anon');
      expect(ticketIds(await take(byDefault, 1))).toEqual(['anon-1']);
      await byDefault.cancel();
    });
  });

  // Over stdio there is no authenticated caller, so the server refuses webhook subscriptions even
  // though it advertises the mode.
  it('falls back to push over stdio for a webhook-configured client, and rejects forced webhook', async () => {
    const receiver = await serveWebhookReceiver(async () => new Response(null, { status: 404 }));
    cleanups.push(() => receiver.close());
    const mcp = new MCPClient({
      id: `webhook-interop-${++clientCount}`,
      servers: {
        events: {
          command: process.execPath,
          args: [tsxCli, path.join(__dirname, 'stdio-server.fixture.ts')],
          env: { EVENTS_INTEROP_WEBHOOK: '1' },
        },
      },
      webhook: { url: receiver.url },
    });
    cleanups.push(() => mcp.disconnect());

    const descriptors = await mcp.events.list('events');
    const ticket = descriptors.find(descriptor => descriptor.name === 'ticket.created');
    expect(ticket?.delivery).toEqual(['push', 'poll', 'webhook']);

    const subscription = await mcp.events.subscribe('events', 'ticket.created', { project: 'stdio' });
    expect(subscription.mode).toBe('push');
    const errors: unknown[] = [];
    subscription.onError(error => errors.push(error));
    expect(errors).toEqual([
      expect.objectContaining({
        id: 'MCP_EVENTS_WEBHOOK_UNAVAILABLE',
        details: expect.objectContaining({ fallback: 'push' }),
      }),
    ]);

    const tools = await mcp.listToolsets();
    await tools.events!.emitTicket!.execute!({ id: 'stdio-1', project: 'stdio' }, { observe: noopObserve });
    expect(ticketIds(await take(subscription, 1))).toEqual(['stdio-1']);
    await subscription.cancel();

    const forced = await rejectionOf(
      mcp.events.subscribe('events', 'ticket.created', { project: 'stdio' }, { delivery: 'webhook' }),
    );
    expect(forced).toMatchObject({
      id: 'MCP_CLIENT_SUBSCRIBE_EVENT_FAILED',
      cause: { id: 'MCP_EVENTS_SUBSCRIPTION_FAILED' },
    });
    expect(receiver.requests).toEqual([]);
  });
});
