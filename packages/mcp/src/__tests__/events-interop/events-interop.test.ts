import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import http from 'node:http';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { noopObserve } from '@mastra/core/tools';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import { MCPClient } from '../../client/configuration';
import type { MCPEventOccurrence, MCPEventSubscribeOptions, MCPEventSubscription } from '../../client/events';
import { serveHTTP } from '../../server/__tests__/harness.mock';
import { createEventsServer, createPlainServer, POLL_INTERVAL_MS } from './fixture';
import { rejectionOf, take } from './helpers';

vi.setConfig({ testTimeout: 30_000, hookTimeout: 30_000 });

const tsxCli = path.join(path.dirname(require.resolve('tsx/package.json')), 'dist', 'cli.mjs');
const fixture = (name: string) => path.join(__dirname, name);
const fastPoll = { minPollIntervalMs: POLL_INTERVAL_MS } satisfies MCPEventSubscribeOptions;

let clientCount = 0;
const newClient = (servers: ConstructorParameters<typeof MCPClient>[0]['servers']) =>
  new MCPClient({ id: `events-interop-${++clientCount}`, servers });

/** One transport's view of the interop server: a connected `MCPClient` plus ways to cause occurrences. */
interface Harness {
  mcp: MCPClient;
  emitTicket(id: string, project: string): Promise<void>;
  recordBuild(branch: string, n: number): Promise<void>;
  close(): Promise<void>;
}

/** Server in a child process; occurrences are caused by calling its tools through the same client. */
async function stdioHarness(): Promise<Harness> {
  const mcp = newClient({ events: { command: process.execPath, args: [tsxCli, fixture('stdio-server.fixture.ts')] } });
  const tools = (await mcp.listToolsets()).events!;
  const call = async (tool: string, input: Record<string, unknown>) => {
    await tools[tool]!.execute!(input, { observe: noopObserve });
  };
  return {
    mcp,
    emitTicket: (id, project) => call('emitTicket', { id, project }),
    recordBuild: (branch, n) => call('recordBuild', { branch, n }),
    close: () => mcp.disconnect(),
  };
}

/** Server in this process behind a real HTTP listener; occurrences are caused directly on the server. */
async function httpHarness(): Promise<Harness> {
  const { server, recordBuild } = createEventsServer();
  const served = await serveHTTP(server);
  const mcp = newClient({ events: { url: served.url } });
  return {
    mcp,
    emitTicket: async (id, project) => {
      await server.events.emit('ticket.created', { id, project }, { eventId: id });
    },
    recordBuild: async (branch, n) => {
      recordBuild({ branch, n });
    },
    close: async () => {
      await mcp.disconnect();
      await served.close();
    },
  };
}

const ticketIds = (occurrences: MCPEventOccurrence[]) => occurrences.map(occurrence => occurrence.data.id);

describe.each([
  ['stdio', stdioHarness],
  ['Streamable HTTP', httpHarness],
] as const)('MCPClient ↔ MCPServer events over %s', (_transport, createHarness) => {
  let harness: Harness;
  const open: MCPEventSubscription[] = [];
  const subscribe = async (
    ...args: Parameters<MCPClient['events']['subscribe']> extends [string, ...infer R] ? R : never
  ) => {
    const subscription = await harness.mcp.events.subscribe('events', ...args);
    open.push(subscription);
    return subscription;
  };

  beforeAll(async () => {
    harness = await createHarness();
  });

  afterAll(async () => {
    await Promise.all(open.map(subscription => subscription.cancel()));
    await harness?.close();
  });

  it('lists both event types with their delivery modes and schemas', async () => {
    const descriptors = await harness.mcp.events.list('events');

    expect(descriptors).toEqual([
      expect.objectContaining({
        name: 'ticket.created',
        description: 'A ticket was created',
        delivery: ['push', 'poll'],
        inputSchema: expect.objectContaining({ properties: { project: { type: 'string' } } }),
        payloadSchema: expect.objectContaining({ required: ['id', 'project'] }),
      }),
      expect.objectContaining({
        name: 'build.finished',
        delivery: ['poll'],
        inputSchema: expect.objectContaining({ properties: { branch: { type: 'string' } } }),
      }),
    ]);
  });

  it('pushes only matching emitted events, routing concurrent streams by their arguments', async () => {
    const projectA = await subscribe('ticket.created', { project: 'push-a' });
    const projectB = await subscribe('ticket.created', { project: 'push-b' });
    expect([projectA.mode, projectB.mode]).toEqual(['push', 'push']);

    await harness.emitTicket('push-a1', 'push-a');
    await harness.emitTicket('push-b1', 'push-b');
    await harness.emitTicket('push-a2', 'push-a');

    // push-b1 was emitted between push-a1 and push-a2, so ordered delivery proves it was filtered out.
    expect(ticketIds(await take(projectA, 2))).toEqual(['push-a1', 'push-a2']);
    expect(ticketIds(await take(projectB, 1))).toEqual(['push-b1']);
    expect(projectA.cursor).toEqual(expect.any(String));
  });

  it('polls emitted events from the ring buffer, starting from the moment of subscription', async () => {
    await harness.emitTicket('poll-before', 'poll-a');
    const subscription = await subscribe('ticket.created', { project: 'poll-a' }, { delivery: 'poll', ...fastPoll });
    expect(subscription.mode).toBe('poll');

    await harness.emitTicket('poll-a1', 'poll-a');
    await harness.emitTicket('poll-b1', 'poll-b');
    await harness.emitTicket('poll-a2', 'poll-a');

    expect(ticketIds(await take(subscription, 2))).toEqual(['poll-a1', 'poll-a2']);
  });

  it('polls a poll() source, receiving only the builds for the subscribed branch', async () => {
    await harness.recordBuild('source-main', 0);
    const subscription = await subscribe('build.finished', { branch: 'source-main' }, fastPoll);
    expect(subscription.mode).toBe('poll');

    await harness.recordBuild('source-main', 1);
    await harness.recordBuild('source-dev', 2);
    await harness.recordBuild('source-main', 3);

    const builds = await take(subscription, 2);
    expect(builds.map(build => build.data)).toEqual([
      { branch: 'source-main', n: 1 },
      { branch: 'source-main', n: 3 },
    ]);
    expect(builds.map(build => build.eventId)).toEqual([
      expect.stringMatching(/^build-\d+$/),
      expect.stringMatching(/^build-\d+$/),
    ]);
    expect(new Set(builds.map(build => build.eventId)).size).toBe(2);
  });

  describe('subscription errors', () => {
    it('rejects arguments that fail the inputSchema for push and poll', async () => {
      for (const options of [{ delivery: 'push' }, { delivery: 'poll', ...fastPoll }] as const) {
        await expect(rejectionOf(subscribe('ticket.created', { project: 42 }, options))).resolves.toMatchObject({
          id: 'MCP_CLIENT_SUBSCRIBE_EVENT_FAILED',
          cause: { id: 'MCP_EVENTS_SUBSCRIPTION_FAILED' },
        });
      }
    });

    it('rejects an event name the server does not offer', async () => {
      await expect(rejectionOf(subscribe('ticket.deleted', {}))).resolves.toMatchObject({
        id: 'MCP_CLIENT_SUBSCRIBE_EVENT_FAILED',
        cause: { id: 'MCP_EVENTS_UNKNOWN_EVENT' },
      });
    });

    it('rejects a forced delivery mode the event does not offer', async () => {
      await expect(
        rejectionOf(subscribe('build.finished', { branch: 'main' }, { delivery: 'push' })),
      ).resolves.toMatchObject({
        id: 'MCP_CLIENT_SUBSCRIBE_EVENT_FAILED',
        cause: { id: 'MCP_EVENTS_NO_COMPATIBLE_DELIVERY_MODE' },
      });
    });
  });

  describe('cursor resume', () => {
    const cases = [
      {
        label: 'push from the ring buffer',
        event: 'ticket.created',
        args: { project: 'resume-push' },
        options: { delivery: 'push' },
        fire: (n: number) => harness.emitTicket(`resume-push-${n}`, 'resume-push'),
        key: (occurrence: MCPEventOccurrence) => occurrence.data.id,
        firstKey: 'resume-push-1',
        expected: ['resume-push-2', 'resume-push-3', 'resume-push-4'],
      },
      {
        label: 'poll from the ring buffer',
        event: 'ticket.created',
        args: { project: 'resume-buffer' },
        options: { delivery: 'poll', ...fastPoll },
        fire: (n: number) => harness.emitTicket(`resume-buffer-${n}`, 'resume-buffer'),
        key: (occurrence: MCPEventOccurrence) => occurrence.data.id,
        firstKey: 'resume-buffer-1',
        expected: ['resume-buffer-2', 'resume-buffer-3', 'resume-buffer-4'],
      },
      {
        label: 'poll from a poll() source',
        event: 'build.finished',
        args: { branch: 'resume-source' },
        options: fastPoll,
        fire: (n: number) => harness.recordBuild('resume-source', n),
        key: (occurrence: MCPEventOccurrence) => occurrence.data.n,
        firstKey: 1,
        expected: [2, 3, 4],
      },
    ] satisfies Array<{ options: MCPEventSubscribeOptions } & Record<string, unknown>>;

    it.each(cases)(
      '$label delivers only what was missed, without duplicates',
      async ({ event, args, options, fire, key, firstKey, expected }) => {
        const first = await subscribe(event, args, options);
        await fire(1);
        const [one] = await take(first, 1);
        expect(key(one!)).toEqual(firstKey);
        const cursor = first.cursor;
        expect(cursor).toEqual(expect.any(String));
        await first.cancel();

        await fire(2);
        await fire(3);

        const resumed = await subscribe(event, args, { ...options, cursor });
        expect(resumed.mode).toBe(first.mode);
        await fire(4);

        const received = await take(resumed, 3);
        expect(received.map(key)).toEqual(expected);
        expect(new Set(received.map(occurrence => occurrence.eventId)).size).toBe(3);
        expect(received.map(occurrence => occurrence.eventId)).not.toContain(one!.eventId);
      },
    );
  });

  it('keeps a push subscription delivering across reconnectServer()', async () => {
    const subscription = await subscribe('ticket.created', { project: 'reconnect' });
    await harness.emitTicket('reconnect-1', 'reconnect');
    expect(ticketIds(await take(subscription, 1))).toEqual(['reconnect-1']);

    await harness.mcp.reconnectServer('events');
    await harness.emitTicket('reconnect-2', 'reconnect');

    expect(ticketIds(await take(subscription, 1))).toEqual(['reconnect-2']);
  });
});

describe('MCPClient ↔ MCPServer without events', () => {
  const expectNotSupported = async (mcp: MCPClient) => {
    await expect(rejectionOf(mcp.events.list('plain'))).resolves.toMatchObject({
      id: 'MCP_CLIENT_LIST_EVENTS_FAILED',
      cause: {
        id: 'MCP_EVENTS_NOT_SUPPORTED',
        message: expect.stringContaining("'io.modelcontextprotocol/events'"),
      },
    });
    await expect(rejectionOf(mcp.events.subscribe('plain', 'ticket.created', {}))).resolves.toMatchObject({
      id: 'MCP_CLIENT_SUBSCRIBE_EVENT_FAILED',
      cause: { id: 'MCP_EVENTS_NOT_SUPPORTED' },
    });
    // The connection itself works: the client did talk to the server, just never about events.
    const tools = (await mcp.listToolsets()).plain!;
    await expect(tools.echo!.execute!({ text: 'hi' }, { observe: noopObserve })).resolves.toBeDefined();
  };

  it('rejects clearly over stdio and sends no events/* request', async () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'events-interop-'));
    const methodLog = path.join(dir, 'methods.log');
    const mcp = newClient({
      plain: {
        command: process.execPath,
        args: [tsxCli, fixture('plain-server.fixture.ts')],
        env: { EVENTS_INTEROP_METHOD_LOG: methodLog },
      },
    });
    // Positive control: the same recorder on the events server does see events/* requests.
    const controlLog = path.join(dir, 'control.log');
    const control = newClient({
      events: {
        command: process.execPath,
        args: [tsxCli, fixture('stdio-server.fixture.ts')],
        env: { EVENTS_INTEROP_METHOD_LOG: controlLog },
      },
    });
    try {
      await expectNotSupported(mcp);
      const methods = readFileSync(methodLog, 'utf8').trim().split('\n');
      expect(methods).toContain('tools/call');
      expect(methods.filter(method => method.startsWith('events/'))).toEqual([]);

      await control.events.list('events');
      expect(readFileSync(controlLog, 'utf8').trim().split('\n')).toContain('events/list');
    } finally {
      await Promise.all([mcp.disconnect(), control.disconnect()]);
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('rejects clearly over Streamable HTTP and sends no events/* request', async () => {
    const server = createPlainServer();
    const methods: string[] = [];
    const httpServer = http.createServer(async (req, res) => {
      // Read and record the JSON-RPC body, then hand the parsed body to startHTTP (the Express pattern).
      const chunks: Buffer[] = [];
      for await (const chunk of req) chunks.push(chunk as Buffer);
      const raw = Buffer.concat(chunks).toString('utf8');
      if (raw) {
        const body = JSON.parse(raw) as { method?: string } | Array<{ method?: string }>;
        for (const message of Array.isArray(body) ? body : [body]) if (message.method) methods.push(message.method);
        (req as http.IncomingMessage & { body?: unknown }).body = body;
      }
      await server.startHTTP({ url: new URL(req.url ?? '', 'http://localhost'), httpPath: '/mcp', req, res });
    });
    await new Promise<void>(resolve => httpServer.listen(0, '127.0.0.1', () => resolve()));
    const address = httpServer.address();
    if (!address || typeof address === 'string') throw new Error('HTTP server did not bind to a port');
    const mcp = newClient({ plain: { url: new URL(`http://127.0.0.1:${address.port}/mcp`) } });
    try {
      await expectNotSupported(mcp);
      expect(methods.length).toBeGreaterThan(0);
      expect(methods).toContain('tools/call');
      expect(methods.filter(method => method.startsWith('events/'))).toEqual([]);
    } finally {
      await mcp.disconnect();
      await server.close();
      httpServer.closeAllConnections();
      await new Promise<void>(resolve => httpServer.close(() => resolve()));
    }
  });
});
