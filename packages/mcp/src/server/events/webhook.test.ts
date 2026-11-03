import type http from 'node:http';
import type { Client } from '@modelcontextprotocol/client';
import { ProtocolError } from '@modelcontextprotocol/client';
import type { AuthInfo } from '@modelcontextprotocol/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod/v4';

import {
  ListEventsResultSchema,
  SubscribeEventsResultSchema,
  UnsubscribeEventsResultSchema,
  generateWebhookSecret,
  verifyWebhook,
} from '../../shared/events';
import { connectClient, serveHTTP } from '../__tests__/harness.mock';
import type { ServedHTTP } from '../__tests__/harness.mock';
import { MCPServer } from '../server';
import { defineEvent } from './define-event';
import type { MCPServerEventAuthorizeContext, MCPServerWebhookOptions } from './types';
import type { WebhookTransportRequest } from './webhook-transport';

vi.setConfig({ testTimeout: 20_000, hookTimeout: 20_000 });

const SECRET = generateWebhookSecret();
const CALLBACK = 'https://hooks.example.com/mcp';

/** Requests carrying `authorization: Bearer <client>` are authenticated as that client. */
function authFromHeader(req: http.IncomingMessage): AuthInfo | undefined {
  const token = req.headers.authorization?.replace(/^Bearer /, '');
  return token ? { token, clientId: token, scopes: [] } : undefined;
}

let served: ServedHTTP | undefined;
const clients: Client[] = [];

afterEach(async () => {
  await Promise.all(clients.splice(0).map(client => client.close()));
  await served?.close();
  served = undefined;
});

async function start(
  webhook: MCPServerWebhookOptions | undefined,
  authorize?: (context: MCPServerEventAuthorizeContext<{ project: string }>) => boolean,
) {
  const posts: WebhookTransportRequest[] = [];
  const server = new MCPServer({
    id: 'webhooks',
    name: 'Webhooks',
    version: '1.0.0',
    tools: {},
    events: {
      'ticket.created': defineEvent({
        inputSchema: z.object({ project: z.string() }),
        payloadSchema: z.object({ id: z.string(), project: z.string() }),
        match: (args, data) => data.project === args.project,
        authorize,
      }),
      'build.finished': defineEvent({ poll: async () => ({ events: [], cursor: null }) }),
    },
    eventsOptions: webhook && {
      webhook: {
        url: { lookup: async () => [{ address: '93.184.216.34', family: 4 }] },
        transport: async request => {
          posts.push(request);
          const body = JSON.parse(request.body);
          return {
            status: 200,
            body: body.type === 'verification' ? JSON.stringify({ challenge: body.challenge }) : '',
          };
        },
        ...webhook,
      },
    },
  });
  served = await serveHTTP(server, { auth: authFromHeader });
  const connect = async (token?: string) => {
    const client = await connectClient(served!.url, {}, token ? { authorization: `Bearer ${token}` } : undefined);
    clients.push(client);
    return client;
  };
  return { server, posts, connect };
}

const subscribeParams = (overrides: Record<string, unknown> = {}) => ({
  name: 'ticket.created',
  arguments: { project: 'alpha' },
  delivery: { mode: 'webhook', url: CALLBACK, secret: SECRET },
  ...overrides,
});

function subscribe(client: Client, params: Record<string, unknown>) {
  return client.request({ method: 'events/subscribe', params }, SubscribeEventsResultSchema);
}

async function rejection(promise: Promise<unknown>) {
  try {
    await promise;
  } catch (error) {
    return error;
  }
  throw new Error('expected a rejection');
}

describe('MCPServer webhook delivery', () => {
  it('advertises webhook only for emit-fed types and only when configured', async () => {
    const configured = await start({});
    const list = await (
      await configured.connect()
    ).request({ method: 'events/list', params: {} }, ListEventsResultSchema);
    expect(Object.fromEntries(list.events.map(event => [event.name, event.delivery]))).toEqual({
      'ticket.created': ['push', 'poll', 'webhook'],
      'build.finished': ['poll'],
    });
    await served!.close();
    served = undefined;

    const plain = await start(undefined);
    const client = await plain.connect('alice');
    const bare = await client.request({ method: 'events/list', params: {} }, ListEventsResultSchema);
    expect(bare.events.find(event => event.name === 'ticket.created')?.delivery).toEqual(['push', 'poll']);
    // Without webhook config the methods are not registered at all.
    expect(await rejection(subscribe(client, subscribeParams()))).toBeInstanceOf(Error);
  });

  it('rejects unauthenticated subscribes with Forbidden', async () => {
    const { connect, posts } = await start({});
    const error = await rejection(subscribe(await connect(), subscribeParams()));
    expect(error).toBeInstanceOf(ProtocolError);
    expect(error).toMatchObject({ code: -32024 });
    expect(posts).toEqual([]);
  });

  it('rejects poll-sourced types as Unsupported', async () => {
    const { connect } = await start({});
    const error = await rejection(
      subscribe(await connect('alice'), subscribeParams({ name: 'build.finished', arguments: {} })),
    );
    expect(error).toMatchObject({ code: -32026, data: { feature: 'deliveryMode', mode: 'webhook' } });
  });

  it('rejects insecure and private callback URLs without upstream detail', async () => {
    const { connect, posts } = await start({
      url: { lookup: async () => [{ address: '10.1.2.3', family: 4 }] },
    });
    const client = await connect('alice');
    const insecure = await rejection(
      subscribe(
        client,
        subscribeParams({ delivery: { mode: 'webhook', url: 'http://hooks.example.com/', secret: SECRET } }),
      ),
    );
    expect(insecure).toMatchObject({ code: -32602, data: { reason: 'insecure_scheme' } });

    const internal = await rejection(subscribe(client, subscribeParams()));
    expect(internal).toMatchObject({ code: -32602, data: { reason: 'disallowed_address' } });
    expect(JSON.stringify(internal)).not.toContain('10.1.2.3');
    expect(posts).toEqual([]);
  });

  it('keeps the signing secret out of the request span', async () => {
    const { server, connect } = await start({});
    const spanParams: unknown[] = [];
    const original = server['startRequestSpan'].bind(server);
    vi.spyOn(server as any, 'startRequestSpan').mockImplementation((...args: any[]) => {
      spanParams.push(args[1]);
      return original(...args);
    });
    const client = await connect('alice');
    await subscribe(client, subscribeParams());
    expect(spanParams).toHaveLength(1);
    expect(spanParams[0]).toMatchObject({ delivery: { url: CALLBACK, secret: '[redacted]' } });
    expect(JSON.stringify(spanParams)).not.toContain(SECRET);
  });

  it('verifies, delivers signed emits, and stops after unsubscribe', async () => {
    const { server, connect, posts } = await start({});
    const client = await connect('alice');
    const result = await subscribe(client, subscribeParams());
    expect(result).toMatchObject({ id: expect.stringMatching(/^sub_/), refreshBefore: expect.any(String) });
    expect(posts.map(post => JSON.parse(post.body).type)).toEqual(['verification']);

    await server.events.emit('ticket.created', { id: 't-1', project: 'beta' });
    await server.events.emit('ticket.created', { id: 't-2', project: 'alpha' }, { eventId: 'evt_2' });
    await vi.waitFor(() => expect(posts).toHaveLength(2));
    const delivery = posts[1]!;
    expect(JSON.parse(delivery.body)).toMatchObject({ eventId: 'evt_2', data: { id: 't-2', project: 'alpha' } });
    expect(delivery.headers['x-mcp-subscription-id']).toBe(result.id);
    expect(verifyWebhook({ secret: SECRET, headers: delivery.headers, body: delivery.body }).ok).toBe(true);

    const unsubscribed = await client.request(
      {
        method: 'events/unsubscribe',
        params: { name: 'ticket.created', arguments: { project: 'alpha' }, delivery: { url: CALLBACK } },
      },
      UnsubscribeEventsResultSchema,
    );
    const { _meta, ...rest } = unsubscribed;
    expect(rest).toEqual({});
    await server.events.emit('ticket.created', { id: 't-3', project: 'alpha' });
    await new Promise(resolve => setTimeout(resolve, 50));
    expect(posts).toHaveLength(2);
  });

  it('runs authorize on every subscribe and refresh, and drops a subscription that loses access', async () => {
    const allowed = new Set(['alice']);
    const seen: string[] = [];
    const { server, connect, posts } = await start({}, ({ requestContext, delivery }) => {
      const caller = (requestContext.get('authInfo') as AuthInfo | undefined)?.clientId ?? '';
      seen.push(`${caller}:${delivery}`);
      return allowed.has(caller);
    });

    const bob = await connect('bob');
    const denied = await rejection(subscribe(bob, subscribeParams()));
    expect(denied).toBeInstanceOf(ProtocolError);
    expect((denied as ProtocolError).code).toBe(-32024);
    // No verification request: a denied caller gets nothing sent to its URL.
    expect(posts).toHaveLength(0);

    const alice = await connect('alice');
    await subscribe(alice, subscribeParams());
    await server.events.emit('ticket.created', { id: 't-1', project: 'alpha' });
    await vi.waitFor(() => expect(posts).toHaveLength(2));
    expect(JSON.parse(posts[1]!.body)).toMatchObject({ data: { id: 't-1' } });

    allowed.delete('alice');
    const refresh = await rejection(subscribe(alice, subscribeParams()));
    expect((refresh as ProtocolError).code).toBe(-32024);
    await server.events.emit('ticket.created', { id: 't-2', project: 'alpha' });
    await new Promise(resolve => setTimeout(resolve, 50));
    expect(posts).toHaveLength(2);
    expect(seen).toEqual(['bob:webhook', 'alice:webhook', 'alice:webhook']);
  });

  it('keys subscriptions by principal', async () => {
    const { connect } = await start({});
    const alice = await subscribe(await connect('alice'), subscribeParams());
    const bob = await subscribe(await connect('bob'), subscribeParams());
    expect(alice.id).not.toBe(bob.id);
  });
});
