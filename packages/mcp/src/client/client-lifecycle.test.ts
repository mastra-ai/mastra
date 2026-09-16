import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { createTool } from '@mastra/core/tools';
import type { Client } from '@modelcontextprotocol/client';
import { CLIENT_CAPABILITIES_META_KEY } from '@modelcontextprotocol/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod/v4';
import { serveHTTP } from '../server/__tests__/harness';
import type { ServedHTTP } from '../server/__tests__/harness';
import { MCPServer } from '../server/server';
import { InternalMastraMCPClient } from './client';
import { MCPClient } from './configuration';
import type { LogMessage, MCPInputRequestHandler } from './types';

vi.setConfig({ testTimeout: 20_000, hookTimeout: 20_000 });

/**
 * End-to-end coverage of the Mastra client against the Mastra server: input
 * rounds answered by the keyed `inputRequests` handler, per-request logging, the
 * 2026-07-28 wire (no initialize/session/SSE fallback/legacy subscriptions) and
 * revision negotiation against servers that have not upgraded.
 */

function makeServer(journal: { writes: number; rounds: string[] }) {
  const bookDelivery = createTool({
    id: 'bookDelivery',
    description: 'Books a delivery after collecting an address and a confirmation',
    inputSchema: z.object({ opKey: z.string() }),
    outputSchema: z.object({ status: z.string(), address: z.string().optional(), writes: z.number() }),
    suspendSchema: z.object({ phase: z.enum(['address', 'confirm']), message: z.string(), address: z.string().optional() }),
    resumeSchema: z.object({ address: z.string().optional(), ok: z.boolean().optional() }),
    execute: async ({ opKey }, context) => {
      const phase = context.suspendPayload?.phase ?? 'start';
      journal.rounds.push(phase);
      await context.mcp?.log?.('info', `round ${phase}`);
      await context.mcp?.log?.('warning', `warn ${phase}`);

      if (!context.resumeData) {
        await context.suspend?.({ phase: 'address', message: 'Delivery address?' });
        return;
      }
      if (phase === 'address') {
        await context.suspend?.({ phase: 'confirm', message: 'Confirm?', address: context.resumeData.address ?? '' });
        return;
      }
      if (!context.resumeData.ok) return { status: 'not confirmed', writes: journal.writes };
      journal.writes += 1;
      return { status: 'booked', address: context.suspendPayload!.address, writes: journal.writes };
    },
  });

  return new MCPServer({
    name: 'Lifecycle Server',
    version: '1.0.0',
    tools: { bookDelivery },
    requestState: { key: 'k'.repeat(32) },
    resources: {
      listResources: async () => [{ uri: 'policy://public', name: 'Policy' }],
      getResourceContent: async () => ({ text: 'policy' }),
    },
  });
}

/** A 2025-era Streamable HTTP server: it only understands the legacy handshake and the shared verbs. */
async function legacyServer() {
  const methods: string[] = [];
  const httpMethods: string[] = [];
  const httpServer = createServer(async (req, res) => {
    httpMethods.push(req.method ?? '');
    if (req.method !== 'POST') {
      res.writeHead(405).end();
      return;
    }
    const chunks: Buffer[] = [];
    for await (const chunk of req) chunks.push(chunk as Buffer);
    const body = JSON.parse(Buffer.concat(chunks).toString('utf8'));
    methods.push(body.method);
    const reply = (result: unknown) =>
      res
        .writeHead(200, { 'content-type': 'application/json', 'mcp-session-id': 'legacy-session' })
        .end(JSON.stringify({ jsonrpc: '2.0', id: body.id, result }));
    switch (body.method) {
      case 'initialize':
        return reply({
          protocolVersion: '2025-11-25',
          capabilities: { tools: {} },
          serverInfo: { name: 'legacy', version: '1' },
        });
      case 'notifications/initialized':
        return res.writeHead(202).end();
      case 'tools/list':
        return reply({ tools: [{ name: 'legacyEcho', inputSchema: { type: 'object' } }] });
      case 'tools/call':
        return reply({ content: [{ type: 'text', text: `legacy: ${body.params.arguments?.text ?? ''}` }] });
      default:
        return res
          .writeHead(200, { 'content-type': 'application/json' })
          .end(JSON.stringify({ jsonrpc: '2.0', id: body.id ?? null, error: { code: -32601, message: 'Method not found' } }));
    }
  });
  const url = await new Promise<URL>(resolve =>
    httpServer.listen(0, '127.0.0.1', () =>
      resolve(new URL(`http://127.0.0.1:${(httpServer.address() as AddressInfo).port}/mcp`)),
    ),
  );
  return {
    url,
    methods,
    httpMethods,
    close: async () => {
      httpServer.closeAllConnections();
      await new Promise<void>(resolve => httpServer.close(() => resolve()));
    },
  };
}

describe('InternalMastraMCPClient - input rounds', () => {
  let journal: { writes: number; rounds: string[] };
  let server: MCPServer;
  let served: ServedHTTP;
  let client: InternalMastraMCPClient | undefined;

  beforeEach(async () => {
    journal = { writes: 0, rounds: [] };
    server = makeServer(journal);
    served = await serveHTTP(server);
  });

  afterEach(async () => {
    await client?.disconnect().catch(() => {});
    client = undefined;
    await served.close();
  });

  it('answers each round through inputRequests and completes with one write', async () => {
    const seen: string[] = [];
    const inputRequests: MCPInputRequestHandler = async ({ key, params }) => {
      if (params.mode === 'url') return { action: 'decline' };
      seen.push(`${key}:${params.message}`);
      if (params.message === 'Delivery address?') return { action: 'accept', content: { address: '1 Main St' } };
      return { action: 'accept', content: { ok: true } };
    };
    client = new InternalMastraMCPClient({ name: 'rounds', server: { url: served.url, inputRequests } });
    await client.connect();

    const tools = await client.tools();
    const result = await tools.bookDelivery!.execute!({ opKey: 'op-1' });

    expect(result).toEqual({ status: 'booked', address: '1 Main St', writes: 1 });
    expect(seen).toEqual(['input:Delivery address?', 'input:Confirm?']);
    expect(journal.rounds).toEqual(['start', 'address', 'confirm']);
  });

  it('fails the call when the handler declines a round', async () => {
    client = new InternalMastraMCPClient({
      name: 'decline',
      server: { url: served.url, inputRequests: async () => ({ action: 'decline' }) },
    });
    await client.connect();

    const tools = await client.tools();
    await expect(tools.bookDelivery!.execute!({ opKey: 'op-2' })).rejects.toThrow(/declined/);
    expect(journal.rounds).toEqual(['start']);
    expect(journal.writes).toBe(0);
  });

  it('surfaces input_required as a failure when no inputRequests handler is configured', async () => {
    client = new InternalMastraMCPClient({ name: 'no-handler', server: { url: served.url } });
    await client.connect();

    const tools = await client.tools();
    await expect(tools.bookDelivery!.execute!({ opKey: 'op-3' })).rejects.toThrow();
    // The server never got past the first round; nothing was written.
    expect(journal.rounds).toEqual(['start']);
    expect(journal.writes).toBe(0);
  });

  it('advertises elicitation on the wire only when a handler is configured', async () => {
    expect(
      () => new InternalMastraMCPClient({ name: 'bad', server: { url: served.url, capabilities: { elicitation: {} } } }),
    ).toThrow(/inputRequests/);

    const advertised = async (inputRequests?: MCPInputRequestHandler) => {
      const fetchSpy = vi.fn((url: string | URL, init?: RequestInit) => fetch(url, init));
      const probe = new InternalMastraMCPClient({
        name: 'caps',
        server: { url: served.url, fetch: fetchSpy, inputRequests },
      });
      await probe.connect();
      await probe.disconnect();
      const discover = JSON.parse(fetchSpy.mock.calls[0]![1]!.body as string);
      return discover.params._meta[CLIENT_CAPABILITIES_META_KEY];
    };

    expect(await advertised(async () => ({ action: 'decline' }))).toMatchObject({ elicitation: { form: {} } });
    expect((await advertised()).elicitation).toBeUndefined();
    expect((await advertised()).roots).toBeUndefined();
    expect((await advertised()).sampling).toBeUndefined();
  });

  it('forwards opted-in per-request server logs to the logger with severity filtering', async () => {
    const messages: LogMessage[] = [];
    client = new InternalMastraMCPClient({
      name: 'logs',
      server: {
        url: served.url,
        serverLogLevel: 'warning',
        logger: message => {
          if (message.message.includes('[MCP SERVER LOG]')) messages.push(message);
        },
        inputRequests: async () => ({ action: 'accept', content: { address: 'x', ok: false } }),
      },
    });
    await client.connect();
    const tools = await client.tools();
    await tools.bookDelivery!.execute!({ opKey: 'op-4' });

    expect(messages.map(m => m.level)).toEqual(['warning', 'warning', 'warning']);
    expect(messages.map(m => (m.details as any)?.data?.message)).toEqual(['warn start', 'warn address', 'warn confirm']);
  });

  it('receives nothing from the server log channel when server logs are disabled', async () => {
    const messages: LogMessage[] = [];
    client = new InternalMastraMCPClient({
      name: 'no-logs',
      server: {
        url: served.url,
        enableServerLogs: false,
        logger: message => {
          if (message.message.includes('[MCP SERVER LOG]')) messages.push(message);
        },
        inputRequests: async () => ({ action: 'accept', content: { address: 'x', ok: false } }),
      },
    });
    await client.connect();
    const tools = await client.tools();
    await tools.bookDelivery!.execute!({ opKey: 'op-5' });

    expect(messages).toEqual([]);
  });
});

describe('InternalMastraMCPClient - 2026-07-28 wire', () => {
  let served: ServedHTTP | undefined;
  let client: InternalMastraMCPClient | undefined;

  afterEach(async () => {
    await client?.disconnect().catch(() => {});
    client = undefined;
    await served?.close();
    served = undefined;
  });

  function methodsSeen(fetchSpy: ReturnType<typeof vi.fn>): string[] {
    return fetchSpy.mock.calls.flatMap(([, init]) => {
      if (typeof init?.body !== 'string') return [];
      const parsed = JSON.parse(init.body);
      return Array.isArray(parsed) ? parsed.map(m => m.method) : [parsed.method];
    });
  }

  it('discovers with self-contained requests: no initialize, no session header, no GET stream', async () => {
    const journal = { writes: 0, rounds: [] };
    served = await serveHTTP(makeServer(journal));
    const fetchSpy = vi.fn((url: string | URL, init?: RequestInit) => fetch(url, init));
    client = new InternalMastraMCPClient({ name: 'wire', server: { url: served.url, fetch: fetchSpy } });
    await client.connect();
    await client.tools();

    expect(client.negotiatedProtocolVersion).toBe('2026-07-28');
    const methods = methodsSeen(fetchSpy);
    expect(methods).toContain('server/discover');
    expect(methods).toContain('tools/list');
    expect(methods).not.toContain('initialize');
    expect(methods).not.toContain('notifications/initialized');
    expect(fetchSpy.mock.calls.every(([, init]) => (init?.method ?? 'GET').toUpperCase() === 'POST')).toBe(true);
    expect(fetchSpy.mock.calls.every(([, init]) => !new Headers(init?.headers).has('mcp-session-id'))).toBe(true);
  });

  it('skips the probe on reconnect by reusing the negotiated verdict', async () => {
    const journal = { writes: 0, rounds: [] };
    served = await serveHTTP(makeServer(journal));
    const fetchSpy = vi.fn((url: string | URL, init?: RequestInit) => fetch(url, init));
    client = new InternalMastraMCPClient({ name: 'again', server: { url: served.url, fetch: fetchSpy } });
    await client.connect();
    await client.disconnect();
    await client.connect();
    await client.tools();

    expect(methodsSeen(fetchSpy).filter(m => m === 'server/discover')).toHaveLength(1);
    expect(client.negotiatedProtocolVersion).toBe('2026-07-28');
  });

  it('manages resource subscriptions through one replaceable listen stream that survives reconnects', async () => {
    const server = makeServer({ writes: 0, rounds: [] });
    served = await serveHTTP(server);
    const fetchSpy = vi.fn((url: string | URL, init?: RequestInit) => fetch(url, init));
    client = new InternalMastraMCPClient({ name: 'listen', server: { url: served.url, fetch: fetchSpy } });
    const updated = new Promise<string>(resolve => {
      client!.setResourceUpdatedNotificationHandler(params => resolve(params.uri));
    });
    await client.connect();
    const listens = () => methodsSeen(fetchSpy).filter(m => m === 'subscriptions/listen').length;

    await client.subscribeResource('policy://public');
    await client.subscribeResource('policy://public');
    expect(listens()).toBe(1);

    await client.subscribeResource('policy://second');
    await client.unsubscribeResource('policy://public');
    await client.forceReconnect();
    await server.resources.notifyUpdated({ uri: 'policy://second' });
    await expect(updated).resolves.toBe('policy://second');

    await client.unsubscribeResource('policy://second');
    await client.subscribeResource('policy://second');
    await client.disconnect();

    const methods = methodsSeen(fetchSpy);
    // subscribe, +second, -public, reconnect restore, -second (closes), +second
    expect(listens()).toBe(5);
    // Every replaced or closed stream is cancelled; the one severed by the reconnect is not.
    expect(methods.filter(m => m === 'notifications/cancelled')).toHaveLength(4);
    expect(methods).not.toContain('resources/subscribe');
    expect(methods).not.toContain('resources/unsubscribe');
  });

  it('serializes concurrent subscription mutations and replays only the final filter after reconnect', async () => {
    const server = makeServer({ writes: 0, rounds: [] });
    served = await serveHTTP(server);
    const fetchSpy = vi.fn((url: string | URL, init?: RequestInit) => fetch(url, init));
    client = new InternalMastraMCPClient({ name: 'concurrent', server: { url: served.url, fetch: fetchSpy } });
    const uris = Array.from({ length: 12 }, (_, i) => `policy://concurrent/${i}`);
    const retained = uris.filter((_, i) => i % 2 === 1);
    const removed = uris.filter((_, i) => i % 2 === 0);
    const updatedUris: string[] = [];
    client.setResourceUpdatedNotificationHandler(params => updatedUris.push(params.uri));
    await client.connect();

    await Promise.all(uris.map(uri => client!.subscribeResource(uri)));
    await Promise.all(removed.map(uri => client!.unsubscribeResource(uri)));
    await client.forceReconnect();

    await server.resources.notifyUpdated({ uri: removed[0]! });
    await new Promise(resolve => setTimeout(resolve, 100));
    expect(updatedUris).not.toContain(removed[0]);
    await server.resources.notifyUpdated({ uri: retained[0]! });
    await vi.waitFor(() => expect(updatedUris).toContain(retained[0]));
    await client.disconnect();

    const methods = methodsSeen(fetchSpy);
    const listenCount = methods.filter(m => m === 'subscriptions/listen').length;
    expect(listenCount).toBeGreaterThan(0);
    expect(methods.filter(m => m === 'notifications/cancelled')).toHaveLength(listenCount - 1);
    expect(methods).not.toContain('resources/subscribe');
  });

  it('keeps the connection usable when restoring subscriptions after reconnect fails', async () => {
    const server = makeServer({ writes: 0, rounds: [] });
    served = await serveHTTP(server);
    client = new InternalMastraMCPClient({ name: 'restore-failure', server: { url: served.url } });
    const updated = new Promise<string>(resolve => {
      client!.setResourceUpdatedNotificationHandler(params => resolve(params.uri));
    });
    await client.connect();
    await client.subscribeResource('policy://public');
    const sdkClient = (client as unknown as { client: Client }).client;
    const listenSpy = vi.spyOn(sdkClient, 'listen').mockRejectedValueOnce(new Error('listen restore failed'));

    await expect(client.forceReconnect()).resolves.toBeUndefined();
    expect(Object.keys(await client.tools())).toContain('bookDelivery');

    await client.subscribeResource('policy://public');
    expect(listenSpy).toHaveBeenCalledTimes(2);
    await server.resources.notifyUpdated({ uri: 'policy://public' });
    await expect(updated).resolves.toBe('policy://public');
    listenSpy.mockRestore();
  });

  it('rejects a resource subscription the server does not honor and keeps the previous interest', async () => {
    const server = makeServer({ writes: 0, rounds: [] });
    served = await serveHTTP(server);
    client = new InternalMastraMCPClient({ name: 'declined', server: { url: served.url } });
    await client.connect();
    const sdkClient = (client as unknown as { client: Client }).client;
    const close = vi.fn().mockResolvedValue(undefined);
    const listenSpy = vi
      .spyOn(sdkClient, 'listen')
      .mockResolvedValueOnce({ honoredFilter: {}, close, closed: new Promise(() => {}) });

    await expect(client.subscribeResource('policy://declined')).rejects.toThrow(
      'Server declined resource subscriptions for: policy://declined',
    );
    expect(close).toHaveBeenCalledOnce();

    // Interest was rolled back, so a later valid subscription opens a stream for it alone.
    await client.subscribeResource('policy://public');
    expect(listenSpy).toHaveBeenLastCalledWith({ resourceSubscriptions: ['policy://public'] }, expect.anything());
    listenSpy.mockRestore();
  });

  it('registers list-changed interest on the shared listen stream', async () => {
    const server = makeServer({ writes: 0, rounds: [] });
    served = await serveHTTP(server);
    const fetchSpy = vi.fn((url: string | URL, init?: RequestInit) => fetch(url, init));
    client = new InternalMastraMCPClient({ name: 'list-changed', server: { url: served.url, fetch: fetchSpy } });
    const changed = new Promise<void>(resolve => {
      void client!.setToolListChangedNotificationHandler(() => resolve());
    });
    await client.connect();
    await client.subscribeResource('policy://public');
    await server.toolActions.notifyListChanged();
    await expect(changed).resolves.toBeUndefined();
    const listenBodies = fetchSpy.mock.calls
      .map(([, init]) => (typeof init?.body === 'string' ? JSON.parse(init.body) : undefined))
      .filter(m => m?.method === 'subscriptions/listen');
    expect(listenBodies.at(-1).params.notifications).toMatchObject({
      toolsListChanged: true,
      resourceSubscriptions: ['policy://public'],
    });
  });

  it('does not expose the removed session, roots, elicitation or SSE surfaces', async () => {
    const journal = { writes: 0, rounds: [] };
    served = await serveHTTP(makeServer(journal));
    client = new InternalMastraMCPClient({ name: 'surface', server: { url: served.url } });
    const mcpClient = new MCPClient({ id: 'surface', servers: { lifecycle: { url: served.url } } });
    try {
      for (const target of [client, mcpClient] as unknown[]) {
        for (const member of ['sessionId', 'sessionIds', 'roots', 'setRoots', 'sendRootsListChanged', 'elicitation']) {
          expect((target as Record<string, unknown>)[member], member).toBeUndefined();
        }
      }
      // Raw listen streams are not exposed; subscriptions are managed through resources.subscribe.
      expect((client as unknown as Record<string, unknown>).listen).toBeUndefined();
      expect((mcpClient as unknown as Record<string, unknown>).subscriptions).toBeUndefined();
    } finally {
      await mcpClient.disconnect();
    }
  });
});

describe('InternalMastraMCPClient - revision negotiation with servers that have not upgraded', () => {
  let legacy: Awaited<ReturnType<typeof legacyServer>>;
  let client: InternalMastraMCPClient | undefined;

  beforeEach(async () => {
    legacy = await legacyServer();
  });

  afterEach(async () => {
    await client?.disconnect().catch(() => {});
    client = undefined;
    await legacy.close();
  });

  it('probes by default and speaks the legacy revision the server offers', async () => {
    client = new InternalMastraMCPClient({ name: 'auto', server: { url: legacy.url } });
    await client.connect();

    expect(client.negotiatedProtocolVersion).toBe('2025-11-25');
    expect(legacy.methods.slice(0, 2)).toEqual(['server/discover', 'initialize']);
    const tools = await client.tools();
    expect(await tools.legacyEcho!.execute!({ text: 'hi' })).toMatchObject({ content: [{ type: 'text', text: 'legacy: hi' }] });
  });

  it('refuses the facilities the legacy revision lacks instead of emulating them', async () => {
    client = new InternalMastraMCPClient({ name: 'auto-listen', server: { url: legacy.url } });
    await client.connect();

    await expect(client.subscribeResource('policy://public')).rejects.toThrow(
      "subscriptions/listen needs MCP 2026-07-28, but server 'auto-listen' negotiated 2025-11-25",
    );
    expect(legacy.methods).not.toContain('resources/subscribe');
    expect(legacy.methods).not.toContain('subscriptions/listen');
  });

  it("skips the probe when pinned to 'legacy'", async () => {
    client = new InternalMastraMCPClient({ name: 'pinned-legacy', server: { url: legacy.url, protocolVersion: 'legacy' } });
    await client.connect();

    expect(client.negotiatedProtocolVersion).toBe('2025-11-25');
    expect(legacy.methods[0]).toBe('initialize');
    expect(legacy.methods).not.toContain('server/discover');
  });

  it("fails loudly when pinned to '2026-07-28', without downgrading or falling back to SSE", async () => {
    client = new InternalMastraMCPClient({ name: 'pinned', server: { url: legacy.url, protocolVersion: '2026-07-28' } });
    await expect(client.connect()).rejects.toThrow();
    expect(legacy.methods).toEqual(['server/discover']);
    expect(legacy.httpMethods).toEqual(['POST']);
  });

  it('reports the negotiated revision per server on MCPClient', async () => {
    const journal = { writes: 0, rounds: [] };
    const served = await serveHTTP(makeServer(journal));
    const mcpClient = new MCPClient({
      id: 'mixed',
      servers: { current: { url: served.url }, older: { url: legacy.url } },
    });
    try {
      expect(mcpClient.getServerProtocolVersions()).toEqual({ current: undefined, older: undefined });
      await mcpClient.listTools();
      expect(mcpClient.getServerProtocolVersions()).toEqual({ current: '2026-07-28', older: '2025-11-25' });
    } finally {
      await mcpClient.disconnect();
      await served.close();
    }
  });
});
