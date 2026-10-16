import path from 'node:path';
import { ConsoleLogger } from '@mastra/core/logger';
import { createTool } from '@mastra/core/tools';
import { Client, ProtocolError } from '@modelcontextprotocol/client';
import type { Notification } from '@modelcontextprotocol/client';
import { StdioClientTransport } from '@modelcontextprotocol/client/stdio';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod/v4';

import {
  EVENTS_EXTENSION_ID,
  EVENTS_SUBSCRIPTION_ID_META_KEY,
  ListEventsResultSchema,
  PollEventsResultSchema,
  StreamEventsResultSchema,
} from '../shared/events';
import { connectClient, rawRequest, serveHTTP } from './__tests__/harness.mock';
import type { ServedHTTP } from './__tests__/harness.mock';
import { defineEvent } from './events';
import type { MCPServerEventDefinition, MCPServerEventPollContext, MCPServerEventsOptions } from './events';
import { MCPServer } from './server';
import type { MCPServerConfig } from './server';

vi.setConfig({ testTimeout: 30_000, hookTimeout: 30_000 });

const ticketCreated = () =>
  defineEvent({
    description: 'A ticket was created',
    inputSchema: z.object({ project: z.string().optional() }),
    payloadSchema: z.object({ id: z.string(), project: z.string() }),
    match: (args, data) => !args.project || data.project === args.project,
  });

const buildFinished = (poll: (ctx: MCPServerEventPollContext<{ branch: string }>) => void) =>
  defineEvent({
    description: 'A build finished',
    inputSchema: z.object({ branch: z.string() }),
    poll: async context => {
      poll(context);
      const position = Number(context.cursor ?? 0);
      return {
        events: [
          {
            eventId: `build-${context.arguments.branch}-${position + 1}`,
            data: { branch: context.arguments.branch, n: position + 1 },
          },
        ],
        cursor: String(position + 1),
        hasMore: true,
        nextPollMs: 5_000,
      };
    },
  });

const echo = createTool({
  id: 'echo',
  description: 'Echoes the input back',
  inputSchema: z.object({ text: z.string() }),
  execute: async ({ text }) => text,
});

function makeServer(
  events: Record<string, MCPServerEventDefinition> | undefined,
  extra: Partial<MCPServerConfig> & { eventsOptions?: MCPServerEventsOptions } = {},
) {
  return new MCPServer({ id: 'events', name: 'Events', version: '1.0.0', tools: { echo }, events, ...extra });
}

/** Push notifications a client received, grouped by subscription id. */
function recordNotifications(client: Client) {
  const received: Notification[] = [];
  client.fallbackNotificationHandler = async notification => void received.push(notification);
  const forSubscription = (id: unknown) =>
    received.filter(
      n => (n.params?._meta as Record<string, unknown> | undefined)?.[EVENTS_SUBSCRIPTION_ID_META_KEY] === id,
    );
  const methods = (notifications: Notification[]) =>
    notifications.map(n => n.method.replace('notifications/events/', ''));
  return { received, forSubscription, methods };
}

function openStream(client: Client, params: Record<string, unknown>) {
  const controller = new AbortController();
  const result = client.request({ method: 'events/stream', params }, StreamEventsResultSchema, {
    signal: controller.signal,
    timeout: 60_000,
  });
  // Cancelling rejects the request; tests that abort read the rejection explicitly.
  result.catch(() => {});
  return { result, abort: () => controller.abort() };
}

async function rejection(promise: Promise<unknown>): Promise<ProtocolError> {
  const error = await promise.then(
    () => undefined,
    (e: unknown) => e,
  );
  expect(error).toBeInstanceOf(ProtocolError);
  return error as ProtocolError;
}

function registryOf(server: MCPServer) {
  return server['eventRegistry'];
}

function spyOnErrors(server: MCPServer) {
  server.__setLogger(new ConsoleLogger({ level: 'silent' }));
  return vi.spyOn(server['logger'], 'error');
}

describe('MCPServer events over Streamable HTTP', () => {
  let served: ServedHTTP | undefined;
  let client: Client | undefined;

  afterEach(async () => {
    await client?.close().catch(() => {});
    await served?.close();
    client = undefined;
    served = undefined;
  });

  async function connect(server: MCPServer) {
    served = await serveHTTP(server);
    client = await connectClient(served.url);
    return client;
  }

  describe('capability', () => {
    it('is absent when no events are configured', async () => {
      const c = await connect(makeServer(undefined));
      expect(c.getServerCapabilities()?.extensions?.[EVENTS_EXTENSION_ID]).toBeUndefined();
      await expect(c.request({ method: 'events/list', params: {} }, ListEventsResultSchema)).rejects.toThrow();
    });

    it('is advertised alongside the MCP Apps extension', async () => {
      const c = await connect(
        makeServer(
          { 'ticket.created': ticketCreated() },
          { appResources: { 'ui://widget': { name: 'Widget', html: '<h1>hi</h1>' } } },
        ),
      );
      expect(c.getServerCapabilities()?.extensions).toEqual({
        'io.modelcontextprotocol/ui': {},
        [EVENTS_EXTENSION_ID]: {},
      });
    });
  });

  describe('events/list', () => {
    it('describes each type with its delivery modes and JSON Schemas', async () => {
      const server = makeServer({ 'ticket.created': ticketCreated(), 'build.finished': buildFinished(() => {}) });
      const c = await connect(server);
      const result = await c.request({ method: 'events/list', params: {} }, ListEventsResultSchema);

      expect(result.nextCursor).toBeUndefined();
      expect(result.events).toEqual([
        {
          name: 'ticket.created',
          description: 'A ticket was created',
          delivery: ['push', 'poll'],
          inputSchema: expect.objectContaining({ type: 'object', properties: { project: { type: 'string' } } }),
          payloadSchema: expect.objectContaining({ type: 'object', required: ['id', 'project'] }),
        },
        {
          name: 'build.finished',
          description: 'A build finished',
          delivery: ['poll'],
          inputSchema: expect.objectContaining({ required: ['branch'] }),
        },
      ]);
      expect(server.events.list()).toEqual(result.events);
    });

    it('paginates with an opaque cursor and rejects a malformed one', async () => {
      const events = Object.fromEntries(['a', 'b', 'c', 'd', 'e'].map(name => [name, defineEvent({})]));
      const c = await connect(makeServer(events, { eventsOptions: { listPageSize: 2 } }));

      const names: string[] = [];
      let cursor: string | undefined;
      let pages = 0;
      do {
        const page = await c.request(
          { method: 'events/list', params: cursor ? { cursor } : {} },
          ListEventsResultSchema,
        );
        names.push(...page.events.map(event => event.name));
        cursor = page.nextCursor;
        pages++;
      } while (cursor);
      expect(names).toEqual(['a', 'b', 'c', 'd', 'e']);
      expect(pages).toBe(3);

      const error = await rejection(
        c.request({ method: 'events/list', params: { cursor: 'garbage' } }, ListEventsResultSchema),
      );
      expect(error.code).toBe(-32602);
    });
  });

  describe('events/poll', () => {
    it('serves a poll source, passing arguments and cursor through', async () => {
      const seen: Array<{ arguments: unknown; cursor: unknown; maxEvents: unknown }> = [];
      const c = await connect(
        makeServer({
          'build.finished': buildFinished(ctx =>
            seen.push({ arguments: ctx.arguments, cursor: ctx.cursor, maxEvents: ctx.maxEvents }),
          ),
        }),
      );

      const first = await c.request(
        { method: 'events/poll', params: { name: 'build.finished', arguments: { branch: 'main' } } },
        PollEventsResultSchema,
      );
      expect(first).toMatchObject({
        events: [{ name: 'build.finished', data: { branch: 'main', n: 1 } }],
        cursor: '1',
        hasMore: true,
        nextPollMs: 5_000,
      });
      expect(first.events[0]!.timestamp).toEqual(expect.any(String));

      await c.request(
        {
          method: 'events/poll',
          params: { name: 'build.finished', arguments: { branch: 'main' }, cursor: first.cursor, maxEvents: 3 },
        },
        PollEventsResultSchema,
      );
      expect(seen).toEqual([
        { arguments: { branch: 'main' }, cursor: null, maxEvents: 100 },
        { arguments: { branch: 'main' }, cursor: '1', maxEvents: 3 },
      ]);
    });

    it('passes the eventIds a poll source returns through unchanged across polls', async () => {
      const c = await connect(makeServer({ 'build.finished': buildFinished(() => {}) }));
      const poll = () =>
        c.request(
          { method: 'events/poll', params: { name: 'build.finished', arguments: { branch: 'main' } } },
          PollEventsResultSchema,
        );
      const [first, again] = [await poll(), await poll()];
      expect(first.events.map(event => event.eventId)).toEqual(['build-main-1']);
      expect(again.events.map(event => event.eventId)).toEqual(['build-main-1']);
    });

    it('answers a poll source failure with a generic -32603 and logs the details', async () => {
      const server = makeServer({
        broken: defineEvent({
          poll: async () => {
            throw new Error('upstream down: secret-host:5432');
          },
        }),
      });
      const logged = spyOnErrors(server);
      const c = await connect(server);
      const error = await rejection(
        c.request({ method: 'events/poll', params: { name: 'broken' } }, PollEventsResultSchema),
      );
      expect(error.code).toBe(-32603);
      expect(error.message).not.toContain('upstream down');
      expect(error.message).toContain('Polling event "broken" failed');
      expect(logged).toHaveBeenCalledWith(
        expect.stringContaining('broken'),
        expect.objectContaining({ error: expect.objectContaining({ message: 'upstream down: secret-host:5432' }) }),
      );
    });

    it('answers a throwing match on a buffer poll with a generic -32603 and logs the details', async () => {
      const server = makeServer({
        flaky: defineEvent({
          match: () => {
            throw new Error('filter bug: token=abc');
          },
        }),
      });
      const logged = spyOnErrors(server);
      const c = await connect(server);
      const start = await c.request({ method: 'events/poll', params: { name: 'flaky' } }, PollEventsResultSchema);
      await server.events.emit('flaky', {});
      const error = await rejection(
        c.request({ method: 'events/poll', params: { name: 'flaky', cursor: start.cursor } }, PollEventsResultSchema),
      );
      expect(error.code).toBe(-32603);
      expect(error.message).not.toContain('token=abc');
      expect(logged).toHaveBeenCalledWith(
        expect.stringContaining('flaky'),
        expect.objectContaining({ error: expect.objectContaining({ message: 'filter bug: token=abc' }) }),
      );
    });

    it('serves emitted events from the ring buffer, filtered by match', async () => {
      const server = makeServer({ 'ticket.created': ticketCreated() });
      const c = await connect(server);
      const poll = (args: Record<string, unknown>, cursor?: string | null) =>
        c.request(
          { method: 'events/poll', params: { name: 'ticket.created', arguments: args, cursor } },
          PollEventsResultSchema,
        );

      await server.events.emit('ticket.created', { id: 'before', project: 'a' });
      const start = await poll({ project: 'a' }, null);
      expect(start.events).toEqual([]);

      await server.events.emit('ticket.created', { id: 't1', project: 'a' });
      await server.events.emit('ticket.created', { id: 't2', project: 'b' });
      await server.events.emit('ticket.created', { id: 't3', project: 'a' });

      const projectA = await poll({ project: 'a' }, start.cursor);
      expect(projectA.events.map(event => event.data.id)).toEqual(['t1', 't3']);
      expect(projectA.truncated).toBeUndefined();
      const all = await poll({}, start.cursor);
      expect(all.events.map(event => event.data.id)).toEqual(['t1', 't2', 't3']);

      const caughtUp = await poll({ project: 'a' }, projectA.cursor);
      expect(caughtUp.events).toEqual([]);
      expect(caughtUp.cursor).toBe(projectA.cursor);
    });

    it('reports truncation when the cursor fell out of the buffer', async () => {
      const server = makeServer({ 'ticket.created': defineEvent({ bufferSize: 2, pollIntervalMs: 2_000 }) });
      const c = await connect(server);
      const start = await c.request(
        { method: 'events/poll', params: { name: 'ticket.created' } },
        PollEventsResultSchema,
      );
      for (const id of ['t1', 't2', 't3']) await server.events.emit('ticket.created', { id });

      const result = await c.request(
        { method: 'events/poll', params: { name: 'ticket.created', cursor: start.cursor } },
        PollEventsResultSchema,
      );
      expect(result.truncated).toBe(true);
      expect(result.nextPollMs).toBe(2_000);
      expect(result.events.map(event => event.data.id)).toEqual(['t2', 't3']);
    });
  });

  describe('errors', () => {
    const events = () => ({
      'ticket.created': ticketCreated(),
      'build.finished': buildFinished(() => {}),
      'push.only': defineEvent({ delivery: ['push'] }),
    });

    it.each(['events/poll', 'events/stream'])('%s rejects an unknown event with -32023', async method => {
      const c = await connect(makeServer(events()));
      const { received } = recordNotifications(c);
      const error = await rejection(
        c.request({ method, params: { name: 'nope' } }, PollEventsResultSchema.or(StreamEventsResultSchema)),
      );
      expect(error.code).toBe(-32023);
      expect(error.data).toEqual({ kind: 'event', name: 'nope' });
      expect(received).toEqual([]);
    });

    it.each(['events/poll', 'events/stream'])('%s rejects invalid arguments with -32602', async method => {
      const c = await connect(makeServer(events()));
      const { received } = recordNotifications(c);
      const error = await rejection(
        c.request(
          { method, params: { name: 'ticket.created', arguments: { project: 42 } } },
          PollEventsResultSchema.or(StreamEventsResultSchema),
        ),
      );
      expect(error.code).toBe(-32602);
      expect(error.data).toMatchObject({ issues: [expect.objectContaining({ path: ['project'] })] });
      expect(received).toEqual([]);
    });

    it('rejects a delivery mode the type does not advertise with -32026', async () => {
      const c = await connect(makeServer(events()));
      const { received } = recordNotifications(c);

      const push = await rejection(
        c.request(
          { method: 'events/stream', params: { name: 'build.finished', arguments: { branch: 'main' } } },
          StreamEventsResultSchema,
        ),
      );
      expect(push.code).toBe(-32026);
      expect(push.data).toEqual({ feature: 'deliveryMode', mode: 'push' });

      const poll = await rejection(
        c.request({ method: 'events/poll', params: { name: 'push.only' } }, PollEventsResultSchema),
      );
      expect(poll.code).toBe(-32026);
      expect(poll.data).toEqual({ feature: 'deliveryMode', mode: 'poll' });
      expect(received).toEqual([]);
    });
  });

  describe('events/stream', () => {
    it('sends active first, then only the events matching each subscription', async () => {
      const server = makeServer({ 'ticket.created': ticketCreated() });
      const c = await connect(server);
      const { received, forSubscription, methods } = recordNotifications(c);

      const a = openStream(c, { name: 'ticket.created', arguments: { project: 'a' } });
      const b = openStream(c, { name: 'ticket.created', arguments: { project: 'b' } });
      await vi.waitFor(() => expect(methods(received)).toEqual(['active', 'active']));
      const [idA, idB] = received.map(
        n => (n.params!._meta as Record<string, unknown>)[EVENTS_SUBSCRIPTION_ID_META_KEY],
      );
      expect(idA).not.toBe(idB);

      await server.events.emit('ticket.created', { id: 't1', project: 'a' });
      await vi.waitFor(() => expect(methods(forSubscription(idA))).toEqual(['active', 'event']));
      expect(forSubscription(idA)[1]!.params).toMatchObject({ name: 'ticket.created', data: { id: 't1' } });
      expect(methods(forSubscription(idB))).toEqual(['active']);

      await server.events.emit('ticket.created', { id: 't2', project: 'b' });
      await vi.waitFor(() => expect(methods(forSubscription(idB))).toEqual(['active', 'event']));
      expect(methods(forSubscription(idA))).toEqual(['active', 'event']);

      a.abort();
      b.abort();
    });

    it('replays from a cursor before live events', async () => {
      const server = makeServer({ 'ticket.created': ticketCreated() });
      const c = await connect(server);
      const { received, methods } = recordNotifications(c);

      const start = await c.request(
        { method: 'events/poll', params: { name: 'ticket.created' } },
        PollEventsResultSchema,
      );
      await server.events.emit('ticket.created', { id: 'missed', project: 'a' });

      const stream = openStream(c, { name: 'ticket.created', cursor: start.cursor });
      await vi.waitFor(() => expect(methods(received)).toEqual(['active', 'event']));
      expect(received[0]!.params).toMatchObject({ cursor: start.cursor, truncated: false });
      expect(received[1]!.params).toMatchObject({ data: { id: 'missed' } });

      await server.events.emit('ticket.created', { id: 'live', project: 'a' });
      await vi.waitFor(() => expect(methods(received)).toEqual(['active', 'event', 'event']));
      expect(received[2]!.params).toMatchObject({ data: { id: 'live' } });
      stream.abort();
    });

    it('stamps every message with the request id and ends with a final result on server close', async () => {
      const server = makeServer({ 'ticket.created': ticketCreated() });
      served = await serveHTTP(server);
      const response = rawRequest(served.url, { method: 'events/stream', params: { name: 'ticket.created' }, id: 42 });
      await vi.waitFor(() => expect(registryOf(server).listenerCount()).toBe(1));

      await server.events.emit('ticket.created', { id: 't1', project: 'a' });
      await server.close();
      const messages = (await response).text
        .split('\n')
        .filter(line => line.startsWith('data: '))
        .map(line => JSON.parse(line.slice('data: '.length)));

      expect(messages.map(message => message.method ?? 'result')).toEqual([
        'notifications/events/active',
        'notifications/events/event',
        'result',
      ]);
      for (const notification of messages.slice(0, 2)) {
        expect(notification.params._meta[EVENTS_SUBSCRIPTION_ID_META_KEY]).toBe(42);
      }
      expect(messages[2]).toMatchObject({ id: 42, result: { _meta: { [EVENTS_SUBSCRIPTION_ID_META_KEY]: 42 } } });
      expect(registryOf(server).openStreams.size).toBe(0);
    });

    it('releases the subscription when the client cancels', async () => {
      const server = makeServer({ 'ticket.created': ticketCreated() });
      const c = await connect(server);
      const { received, methods } = recordNotifications(c);
      const registry = registryOf(server);

      const stream = openStream(c, { name: 'ticket.created' });
      await vi.waitFor(() => expect(methods(received)).toEqual(['active']));
      expect(registry.openStreams.size).toBe(1);
      expect(registry.listenerCount()).toBe(1);

      stream.abort();
      await expect(stream.result).rejects.toThrow();
      await vi.waitFor(() => expect(registry.openStreams.size).toBe(0));
      expect(registry.listenerCount()).toBe(0);

      await server.events.emit('ticket.created', { id: 'after', project: 'a' });
      expect(methods(received)).toEqual(['active']);
    });

    it('keeps serving other requests while streams are open', async () => {
      const server = makeServer({ 'ticket.created': ticketCreated() });
      const c = await connect(server);
      const { received, methods } = recordNotifications(c);
      const streams = Array.from({ length: 5 }, () => openStream(c, { name: 'ticket.created' }));
      await vi.waitFor(() => expect(methods(received)).toHaveLength(5));

      const result = await c.callTool({ name: 'echo', arguments: { text: 'still here' } });
      expect(result.content).toEqual([{ type: 'text', text: 'still here' }]);
      for (const stream of streams) stream.abort();
    });
  });
});

describe('MCPServer events over stdio', () => {
  const tsxCli = path.join(path.dirname(require.resolve('tsx/package.json')), 'dist', 'cli.mjs');
  const fixturePath = path.join(__dirname, '__tests__', 'events-server.fixture.ts');
  let client: Client | undefined;

  afterEach(async () => {
    await client?.close().catch(() => {});
    client = undefined;
  });

  it('demultiplexes concurrent streams by subscription id and still answers tool calls', async () => {
    client = new Client(
      { name: 'stdio-client', version: '1.0.0' },
      { versionNegotiation: { mode: { pin: '2026-07-28' } } },
    );
    const transport = new StdioClientTransport({
      command: process.execPath,
      args: [tsxCli, fixturePath],
      stderr: 'pipe',
    });
    transport.stderr?.on('data', (chunk: Buffer) => process.stderr.write(chunk));
    await client.connect(transport);
    expect(client.getServerCapabilities()?.extensions?.[EVENTS_EXTENSION_ID]).toEqual({});

    const { received, forSubscription, methods } = recordNotifications(client);
    const a = openStream(client, { name: 'ticket.created', arguments: { project: 'a' } });
    const b = openStream(client, { name: 'ticket.created', arguments: { project: 'b' } });
    await vi.waitFor(() => expect(methods(received)).toEqual(['active', 'active']));
    const [idA, idB] = received.map(n => (n.params!._meta as Record<string, unknown>)[EVENTS_SUBSCRIPTION_ID_META_KEY]);

    const emitted = await client.callTool({ name: 'emitTicket', arguments: { id: 't1', project: 'b' } });
    expect(emitted.isError).toBeFalsy();
    await vi.waitFor(() => expect(methods(forSubscription(idB))).toEqual(['active', 'event']));
    expect(forSubscription(idB)[1]!.params).toMatchObject({ data: { id: 't1', project: 'b' } });
    expect(methods(forSubscription(idA))).toEqual(['active']);

    const echoed = await client.callTool({ name: 'echo', arguments: { text: 'hi' } });
    expect(echoed.content).toEqual([{ type: 'text', text: 'hi' }]);

    a.abort();
    b.abort();
    await expect(a.result).rejects.toThrow();
    await expect(b.result).rejects.toThrow();
  });
});
