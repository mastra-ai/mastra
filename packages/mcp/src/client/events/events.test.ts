import { createServer } from 'node:http';
import type { Server as HttpServer } from 'node:http';
import { createRequire } from 'node:module';
import type { AddressInfo } from 'node:net';
import path from 'node:path';
import { MastraError } from '@mastra/core/error';
import { toNodeHandler } from '@modelcontextprotocol/node';
import { McpServer, createMcpHandler } from '@modelcontextprotocol/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { EVENTS_ERROR_CODES, EVENTS_EXTENSION_ID } from '../../shared/events';
import { InternalMastraMCPClient } from '../client';
import { MCPClient } from '../configuration';
import { createEventsFixture } from './__fixtures__/events-server';
import type { EventsFixture } from './__fixtures__/events-server';
import type { MCPEventOccurrence, MCPEventSubscription } from './types';

const require = createRequire(import.meta.url);

interface Harness {
  httpServer: HttpServer;
  url: URL;
  fixture?: EventsFixture;
}

async function startHttpServer(withEvents: boolean): Promise<Harness> {
  const fixture = withEvents ? createEventsFixture() : undefined;
  // A fresh server per request, as in production: one SDK server serves one request at a time.
  const createServerForRequest = () => {
    const mcpServer = new McpServer(
      { name: 'events-test-server', version: '1.0.0' },
      { capabilities: { tools: {}, ...(withEvents ? { extensions: { [EVENTS_EXTENSION_ID]: {} } } : {}) } },
    );
    mcpServer.registerTool('noop', { description: 'noop' }, async () => ({ content: [] }));
    fixture?.install(mcpServer.server);
    return mcpServer.server;
  };
  const handler = toNodeHandler(createMcpHandler(createServerForRequest, { legacy: 'reject' }));
  const httpServer = createServer((req, res) => void handler(req, res));
  await new Promise<void>(resolve => httpServer.listen(0, '127.0.0.1', () => resolve()));
  const { port } = httpServer.address() as AddressInfo;
  return { httpServer, url: new URL(`http://127.0.0.1:${port}/mcp`), fixture };
}

async function waitFor(condition: () => boolean | Promise<boolean>, timeoutMs = 5000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (!(await condition())) {
    if (Date.now() > deadline) throw new Error('waitFor timed out');
    await new Promise(resolve => setTimeout(resolve, 10));
  }
}

async function nextEvent(subscription: MCPEventSubscription, timeoutMs = 5000): Promise<MCPEventOccurrence> {
  const iterator = subscription[Symbol.asyncIterator]();
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const result = await Promise.race([
      iterator.next(),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error('no event arrived')), timeoutMs);
      }),
    ]);
    if (result.done) throw new Error('subscription ended');
    return result.value;
  } finally {
    clearTimeout(timer);
  }
}

const eventRequests = (fetchSpy: ReturnType<typeof vi.fn>) =>
  fetchSpy.mock.calls.filter(([, init]) => typeof init?.body === 'string' && init.body.includes('"method":"events/'));

describe('MCP Events client over Streamable HTTP', () => {
  let harness: Harness | undefined;
  let client: InternalMastraMCPClient | undefined;
  const datadogTracerTestSymbol = Symbol.for('mastra.mcp.dd-trace-test-tracer');

  afterEach(async () => {
    await client?.disconnect().catch(() => {});
    client = undefined;
    harness?.httpServer.closeAllConnections();
    await new Promise<void>(resolve => (harness ? harness.httpServer.close(() => resolve()) : resolve()));
    harness = undefined;
    delete (globalThis as Record<PropertyKey, unknown>)[datadogTracerTestSymbol];
  });

  async function connect(withEvents = true, fetchSpy?: ReturnType<typeof vi.fn>) {
    harness = await startHttpServer(withEvents);
    client = new InternalMastraMCPClient({
      name: 'events-client',
      server: { url: harness.url, ...(fetchSpy ? { fetch: fetchSpy } : {}) },
    });
    await client.connect();
    return { client, fixture: harness.fixture! };
  }

  it('lists event types across pages', async () => {
    const { client } = await connect();
    const events = await client.events.list();
    expect(events.map(event => event.name)).toEqual(['repo.push', 'ticks']);
    expect(events[0]!.delivery).toEqual(['push', 'poll']);
  });

  it('delivers occurrences end to end over push', async () => {
    const { client, fixture } = await connect();
    const sub = await client.events.subscribe('repo.push', { repo: 'a' });
    expect(sub.mode).toBe('push');
    expect(fixture.streamRequests).toHaveLength(1);
    expect(fixture.streamRequests[0]).toMatchObject({ name: 'repo.push', arguments: { repo: 'a' }, cursor: null });

    const eventId = await fixture.emit('repo.push', { repo: 'a' }, { sha: 'abc' });
    const event = await nextEvent(sub);
    expect(event).toMatchObject({ eventId, name: 'repo.push', data: { sha: 'abc' } });
    expect(event._meta).toBeUndefined();
    expect(sub.cursor).toBe('1');
    await sub.cancel();
  });

  it('delivers occurrences end to end over poll', async () => {
    const { client, fixture } = await connect();
    const sub = await client.events.subscribe('repo.push', { repo: 'a' }, { delivery: 'poll', minPollIntervalMs: 20 });
    expect(sub.mode).toBe('poll');
    expect(fixture.pollRequests[0]).toMatchObject({ name: 'repo.push', arguments: { repo: 'a' }, cursor: null });

    const first = await fixture.emit('repo.push', { repo: 'a' }, { n: 1 });
    await fixture.emit('repo.push', { repo: 'other' }, { n: 2 });
    const third = await fixture.emit('repo.push', { repo: 'a' }, { n: 3 });
    expect((await nextEvent(sub)).eventId).toBe(first);
    expect((await nextEvent(sub)).eventId).toBe(third);
    expect(sub.cursor).toBe('3');
    await sub.cancel();
  });

  it('routes two concurrent push streams with different arguments to the right subscriptions', async () => {
    const { client, fixture } = await connect();
    const [subA, subB] = await Promise.all([
      client.events.subscribe('repo.push', { repo: 'a' }),
      client.events.subscribe('repo.push', { repo: 'b' }),
    ]);
    expect(fixture.liveStreams).toBe(2);

    const forB = await fixture.emit('repo.push', { repo: 'b' }, { to: 'b' });
    const forA = await fixture.emit('repo.push', { repo: 'a' }, { to: 'a' });
    expect(await nextEvent(subA)).toMatchObject({ eventId: forA, data: { to: 'a' } });
    expect(await nextEvent(subB)).toMatchObject({ eventId: forB, data: { to: 'b' } });

    const secondForA = await fixture.emit('repo.push', { repo: 'a' }, { to: 'a', n: 2 });
    expect((await nextEvent(subA)).eventId).toBe(secondForA);
    await Promise.all([subA.cancel(), subB.cancel()]);
  });

  it('cancel() releases the server-side stream handler', async () => {
    const { client, fixture } = await connect();
    const sub = await client.events.subscribe('repo.push', { repo: 'a' });
    expect(fixture.liveStreams).toBe(1);
    await sub.cancel();
    await waitFor(() => fixture.liveStreams === 0);
    expect(fixture.closedStreams).toBe(1);
  });

  it('restores a push subscription after forceReconnect from its last cursor', async () => {
    const { client, fixture } = await connect();
    const sub = await client.events.subscribe('repo.push', { repo: 'a' });
    await fixture.emit('repo.push', { repo: 'a' }, { n: 1 });
    await nextEvent(sub);
    expect(sub.cursor).toBe('1');

    await client.forceReconnect();
    await waitFor(() => fixture.streamRequests.length === 2 && fixture.liveStreams === 1);
    expect(fixture.streamRequests[1]).toMatchObject({ cursor: '1', arguments: { repo: 'a' } });

    const after = await fixture.emit('repo.push', { repo: 'a' }, { n: 2 });
    expect((await nextEvent(sub)).eventId).toBe(after);
    await sub.cancel();
  });

  it('restores a poll subscription after forceReconnect from its last cursor', async () => {
    const { client, fixture } = await connect();
    const sub = await client.events.subscribe('ticks', undefined, { minPollIntervalMs: 20 });
    expect(sub.mode).toBe('poll');
    await fixture.emit('ticks', undefined, { n: 1 });
    await nextEvent(sub);

    await client.forceReconnect();
    const pollsBefore = fixture.pollRequests.length;
    const after = await fixture.emit('ticks', undefined, { n: 2 });
    expect((await nextEvent(sub)).eventId).toBe(after);
    expect(fixture.pollRequests.slice(pollsBefore).some(request => request.cursor === '1')).toBe(true);
    await sub.cancel();
  });

  it('rejects subscribe when the server refuses the stream', async () => {
    const { client, fixture } = await connect();
    const error = await client.events.subscribe('repo.push', { repo: 'forbidden' }).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(MastraError);
    expect(error).toMatchObject({
      id: 'MCP_EVENTS_SUBSCRIPTION_FAILED',
      details: { code: EVENTS_ERROR_CODES.Forbidden },
    });
    expect(fixture.liveStreams).toBe(0);
  });

  it('rejects unknown events and unsupported forced modes before opening anything', async () => {
    const { client, fixture } = await connect();
    await expect(client.events.subscribe('nope')).rejects.toMatchObject({ id: 'MCP_EVENTS_UNKNOWN_EVENT' });
    await expect(client.events.subscribe('ticks', undefined, { delivery: 'push' })).rejects.toMatchObject({
      id: 'MCP_EVENTS_NO_COMPATIBLE_DELIVERY_MODE',
    });
    expect(fixture.streamRequests).toHaveLength(0);
    expect(fixture.pollRequests).toHaveLength(0);
  });

  it('sends no events/* traffic to a server without the extension', async () => {
    const fetchSpy = vi.fn((url: string | URL, init?: RequestInit) => fetch(url, init));
    const { client } = await connect(false, fetchSpy);

    await expect(client.events.list()).rejects.toMatchObject({ id: 'MCP_EVENTS_NOT_SUPPORTED' });
    await expect(client.events.subscribe('repo.push')).rejects.toMatchObject({ id: 'MCP_EVENTS_NOT_SUPPORTED' });
    expect(fetchSpy.mock.calls.length).toBeGreaterThan(0);
    expect(eventRequests(fetchSpy)).toHaveLength(0);
  });

  it('disconnect() ends live subscriptions cleanly', async () => {
    const { client, fixture } = await connect();
    const sub = await client.events.subscribe('repo.push', { repo: 'a' });
    const pending = sub[Symbol.asyncIterator]().next();
    await client.disconnect();
    await expect(pending).resolves.toEqual({ value: undefined, done: true });
    await waitFor(() => fixture.liveStreams === 0);
  });

  it('detaches the events/stream request from the active Datadog span', async () => {
    const fetchSpy = vi.fn((url: string | URL, init?: RequestInit) => fetch(url, init));
    const activateSpy = vi.fn((_span: unknown, callback: () => unknown) => callback());
    (globalThis as Record<PropertyKey, unknown>)[datadogTracerTestSymbol] = {
      scope: () => ({ activate: activateSpy }),
    };
    const { client } = await connect(true, fetchSpy);

    await client.events.list();
    expect(activateSpy).not.toHaveBeenCalled();

    const sub = await client.events.subscribe('repo.push', { repo: 'a' });
    const streamCalls = eventRequests(fetchSpy).filter(([, init]) => (init?.body as string).includes('events/stream'));
    expect(streamCalls).toHaveLength(1);
    expect(activateSpy).toHaveBeenCalledTimes(1);
    expect(activateSpy).toHaveBeenCalledWith(null, expect.any(Function));
    await sub.cancel();
  });
});

describe('MCP Events client over stdio', () => {
  const tsxCli = path.join(path.dirname(require.resolve('tsx/package.json')), 'dist', 'cli.mjs');
  let client: InternalMastraMCPClient | undefined;

  afterEach(async () => {
    await client?.disconnect().catch(() => {});
    client = undefined;
  });

  it('routes two push streams by subscription id and cancels with notifications/cancelled', async () => {
    client = new InternalMastraMCPClient({
      name: 'events-stdio',
      server: {
        command: process.execPath,
        args: [tsxCli, path.join(__dirname, '__fixtures__/events-stdio-server.ts')],
      },
      timeout: 20_000,
    });
    await client.connect();
    const tools = await client.tools();
    const emit = (repo: string, data: Record<string, unknown>) =>
      tools.emit!.execute!({ name: 'repo.push', arguments: { repo }, data }, {});
    // Tools with structured content resolve to it directly.
    const stats = async () => (await tools.stats!.execute!({}, {})) as { liveStreams: number; closedStreams: number };

    const [subA, subB] = await Promise.all([
      client.events.subscribe('repo.push', { repo: 'a' }),
      client.events.subscribe('repo.push', { repo: 'b' }),
    ]);
    expect([subA.mode, subB.mode]).toEqual(['push', 'push']);

    await emit('b', { to: 'b' });
    await emit('a', { to: 'a' });
    expect((await nextEvent(subA)).data).toEqual({ to: 'a' });
    expect((await nextEvent(subB)).data).toEqual({ to: 'b' });

    await subA.cancel();
    await waitFor(async () => (await stats()).closedStreams === 1);
    expect((await stats()).liveStreams).toBe(1);

    await emit('b', { to: 'b', n: 2 });
    expect((await nextEvent(subB)).data).toEqual({ to: 'b', n: 2 });
    await subB.cancel();
  }, 30_000);
});

describe('MCPClient.events', () => {
  let harness: Harness | undefined;
  let mcp: MCPClient | undefined;

  afterEach(async () => {
    await mcp?.disconnect().catch(() => {});
    mcp = undefined;
    harness?.httpServer.closeAllConnections();
    await new Promise<void>(resolve => (harness ? harness.httpServer.close(() => resolve()) : resolve()));
  });

  it('lists and subscribes per server and wraps failures in MastraError', async () => {
    harness = await startHttpServer(true);
    const plain = await startHttpServer(false);
    try {
      mcp = new MCPClient({
        id: 'events-config-test',
        servers: { ev: { url: harness.url }, plain: { url: plain.url } },
      });

      expect((await mcp.events.list('ev')).map(event => event.name)).toEqual(['repo.push', 'ticks']);
      const sub = await mcp.events.subscribe('ev', 'repo.push', { repo: 'a' });
      const eventId = await harness.fixture!.emit('repo.push', { repo: 'a' }, {});
      expect((await nextEvent(sub)).eventId).toBe(eventId);
      await sub.cancel();

      const listError = await mcp.events.list('plain').catch((e: unknown) => e);
      expect(listError).toBeInstanceOf(MastraError);
      expect(listError).toMatchObject({ id: 'MCP_CLIENT_LIST_EVENTS_FAILED', details: { serverName: 'plain' } });
      expect(String((listError as MastraError).message)).toContain('does not support events');

      await expect(mcp.events.subscribe('plain', 'repo.push')).rejects.toMatchObject({
        id: 'MCP_CLIENT_SUBSCRIBE_EVENT_FAILED',
        details: { serverName: 'plain', eventName: 'repo.push' },
      });
    } finally {
      await mcp?.disconnect().catch(() => {});
      plain.httpServer.closeAllConnections();
      await new Promise<void>(resolve => plain.httpServer.close(() => resolve()));
    }
  });
});
