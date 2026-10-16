import http from 'node:http';
import type { AddressInfo } from 'node:net';
import type { AuthInfo } from '@modelcontextprotocol/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod/v4';

import { MCPClient } from '../../client/configuration';
import type { MCPEventOccurrence, MCPEventSubscription } from '../../client/events';
import { serveHTTP } from '../__tests__/harness.mock';
import type { ServedHTTP } from '../__tests__/harness.mock';
import { MCPServer } from '../server';
import { defineEvent } from './define-event';
import { InMemoryWebhookSubscriptionStore } from './webhook-store';
import type { WebhookSubscriptionRecord } from './webhook-store';

vi.setConfig({ testTimeout: 20_000, hookTimeout: 20_000 });

/** Counts writes, so the test can see the client's refreshes reach the server. */
class CountingStore extends InMemoryWebhookSubscriptionStore {
  readonly writes: WebhookSubscriptionRecord[] = [];
  override async set(record: WebhookSubscriptionRecord): Promise<void> {
    this.writes.push(record);
    await super.set(record);
  }
  override async delete(id: string): Promise<void> {
    this.deletes.push(id);
    await super.delete(id);
  }
  readonly deletes: string[] = [];
}

/** A local HTTP server that hands every request to `handle` as a Fetch `Request`. */
async function serveReceiver(handle: (request: Request) => Promise<Response>) {
  const requests: { status: number; type?: string }[] = [];
  const server = http.createServer(async (req, res) => {
    const chunks: Buffer[] = [];
    for await (const chunk of req) chunks.push(chunk as Buffer);
    const body = Buffer.concat(chunks);
    const headers = new Headers();
    for (const [key, value] of Object.entries(req.headers)) {
      if (typeof value === 'string') headers.set(key, value);
    }
    const response = await handle(
      new Request(`http://127.0.0.1${req.url}`, {
        method: req.method,
        headers,
        ...(req.method === 'POST' ? { body } : {}),
      }),
    );
    let type: string | undefined;
    try {
      type = JSON.parse(body.toString()).type;
    } catch {}
    requests.push({ status: response.status, type });
    res.writeHead(response.status, Object.fromEntries(response.headers));
    res.end(Buffer.from(await response.arrayBuffer()));
  });
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', () => resolve()));
  const { port } = server.address() as AddressInfo;
  return {
    url: `http://127.0.0.1:${port}/webhook`,
    requests,
    close: async () => {
      server.closeAllConnections();
      await new Promise<void>(resolve => server.close(() => resolve()));
    },
  };
}

async function waitFor(condition: () => boolean, timeoutMs = 5000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (!condition()) {
    if (Date.now() > deadline) throw new Error('waitFor timed out');
    await new Promise(resolve => setTimeout(resolve, 10));
  }
}

async function nextEvent(subscription: MCPEventSubscription): Promise<MCPEventOccurrence> {
  const result = await subscription[Symbol.asyncIterator]().next();
  if (result.done) throw new Error('subscription ended');
  return result.value;
}

function authFromHeader(req: http.IncomingMessage): AuthInfo | undefined {
  const token = req.headers.authorization?.replace(/^Bearer /, '');
  return token ? { token, clientId: token, scopes: [] } : undefined;
}

const cleanups: (() => Promise<void>)[] = [];
afterEach(async () => {
  for (const cleanup of cleanups.splice(0).reverse()) await cleanup();
});

describe('webhook delivery end to end', () => {
  it('subscribes, verifies, delivers signed events, refreshes, and unsubscribes on cancel', async () => {
    const store = new CountingStore();
    const server = new MCPServer({
      id: 'webhook-flow',
      name: 'Webhook flow',
      version: '1.0.0',
      tools: {},
      events: {
        'ticket.created': defineEvent({
          inputSchema: z.object({ project: z.string() }),
          payloadSchema: z.object({ id: z.string(), project: z.string() }),
          match: (args, data) => data.project === args.project,
        }),
      },
      eventsOptions: {
        webhook: {
          store,
          // The receiver runs on plain http on loopback in this test.
          url: { allowPrivate: true, allowInsecure: true },
          ttl: { minMs: 1000, defaultMs: 1500 },
          retry: { initialDelayMs: 20, maxDelayMs: 50 },
        },
      },
    });
    const served: ServedHTTP = await serveHTTP(server, { auth: authFromHeader });
    cleanups.push(() => served.close());

    let mcp: MCPClient | undefined;
    const receiver = await serveReceiver(request => mcp!.events.handleWebhook(request));
    cleanups.push(() => receiver.close());
    mcp = new MCPClient({
      id: 'webhook-flow-client',
      servers: { tickets: { url: served.url, requestInit: { headers: { authorization: 'Bearer alice' } } } },
      webhook: { url: receiver.url, refreshMarginMs: 500 },
    });
    cleanups.push(() => mcp!.disconnect());

    const [descriptor] = await mcp.events.list('tickets');
    expect(descriptor!.delivery).toEqual(['push', 'poll', 'webhook']);

    const sub = await mcp.events.subscribe('tickets', 'ticket.created', { project: 'mcp' });
    expect(sub.mode).toBe('webhook');
    // The server verified the endpoint before activating, answered by the receiver itself.
    expect(receiver.requests).toEqual([{ status: 200, type: 'verification' }]);
    expect(store.writes).toHaveLength(1);
    const record = store.writes[0]!;
    expect(record).toMatchObject({ url: receiver.url, name: 'ticket.created', arguments: { project: 'mcp' } });

    await server.events.emit('ticket.created', { id: 'T-0', project: 'other' });
    const emitted = await server.events.emit('ticket.created', { id: 'T-1', project: 'mcp' });
    const event = await nextEvent(sub);
    expect(event).toMatchObject({ eventId: emitted.eventId, data: { id: 'T-1', project: 'mcp' } });
    const deliveries = () => receiver.requests.filter(request => request.type === undefined);
    await waitFor(() => deliveries().length > 0);
    expect(deliveries()).toEqual([{ status: 200 }]);

    // Granted 1.5 s with a 0.5 s margin: the client re-subscribes with the same key and secret.
    await waitFor(() => store.writes.length >= 2 && sub.deliveryStatus !== undefined);
    expect(store.writes[1]).toMatchObject({ id: record.id, secret: record.secret });
    expect(sub.deliveryStatus).toMatchObject({ active: true, lastError: null });

    await sub.cancel();
    await waitFor(() => store.deletes.includes(record.id));
    expect(await store.list('ticket.created')).toEqual([]);

    await server.events.emit('ticket.created', { id: 'T-2', project: 'mcp' });
    await new Promise(resolve => setTimeout(resolve, 100));
    expect(deliveries()).toHaveLength(1);
  });

  it('falls back to push when an unauthenticated connection is refused webhook delivery, unless webhook is forced', async () => {
    const server = new MCPServer({
      id: 'webhook-fallback',
      name: 'Webhook fallback',
      version: '1.0.0',
      tools: {},
      events: { 'ticket.created': defineEvent({ payloadSchema: z.object({ id: z.string() }) }) },
      eventsOptions: { webhook: { url: { allowPrivate: true, allowInsecure: true } } },
    });
    const served: ServedHTTP = await serveHTTP(server);
    cleanups.push(() => served.close());
    const receiver = await serveReceiver(async () => new Response(null, { status: 500 }));
    cleanups.push(() => receiver.close());
    const mcp = new MCPClient({
      id: 'webhook-fallback-client',
      servers: { tickets: { url: served.url } },
      webhook: { url: receiver.url },
    });
    cleanups.push(() => mcp.disconnect());

    const sub = await mcp.events.subscribe('tickets', 'ticket.created');
    expect(sub.mode).toBe('push');
    const errors: unknown[] = [];
    sub.onError(error => errors.push(error));
    sub.onError(error => errors.push(error));
    expect(errors).toEqual([
      expect.objectContaining({
        id: 'MCP_EVENTS_WEBHOOK_UNAVAILABLE',
        details: expect.objectContaining({ code: -32024, fallback: 'push' }),
      }),
    ]);
    const emitted = await server.events.emit('ticket.created', { id: 'T-1' });
    expect(await nextEvent(sub)).toMatchObject({ eventId: emitted.eventId });
    await sub.cancel();

    await expect(
      mcp.events.subscribe('tickets', 'ticket.created', undefined, { delivery: 'webhook' }),
    ).rejects.toMatchObject({ cause: expect.objectContaining({ details: expect.objectContaining({ code: -32024 }) }) });
    expect(receiver.requests).toEqual([]);
  });

  it('handleWebhook answers 404 when the client has no webhook settings', async () => {
    const mcp = new MCPClient({ id: 'webhook-flow-unconfigured', servers: {} });
    cleanups.push(() => mcp.disconnect());
    const response = await mcp.events.handleWebhook(new Request('http://localhost/webhook', { method: 'POST' }));
    expect(response.status).toBe(404);
  });
});
