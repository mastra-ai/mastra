import { createServer } from 'node:http';
import type { Server as HttpServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { createMCPTool } from '@mastra/core/mcp';
import { createTool } from '@mastra/core/tools';
import type { Client } from '@modelcontextprotocol/client';
import { CLIENT_CAPABILITIES_META_KEY, createRequestStateCodec, inputRequired } from '@modelcontextprotocol/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod/v4';
import { serveHTTP } from '../server/__tests__/harness';
import type { ServedHTTP } from '../server/__tests__/harness';
import { MCPServer } from '../server/server';
import { InternalMastraMCPClient } from './client';
import { MCPClient } from './configuration';
import type { LogMessage, MCPInputRequestHandler, MCPTraceContext } from './types';

vi.setConfig({ testTimeout: 20_000, hookTimeout: 20_000 });

/**
 * End-to-end coverage of the Mastra v2 client against the Mastra v2 server:
 * native input rounds answered by the keyed `inputRequests` handler, per-request
 * logging and the 2026-07-28 wire (no initialize/session/SSE fallback/legacy
 * subscriptions).
 */

type BookingState =
  | { phase: 'address'; opKey: string }
  | { phase: 'confirm'; opKey: string; address: string }
  | { phase: 'gate'; opKey: string };
const codec = createRequestStateCodec<BookingState>({ key: 'k'.repeat(32) });

function makeServer(journal: { writes: number; rounds: string[] }) {
  const bookDelivery = createMCPTool({
    id: 'bookDelivery',
    description: 'Books a delivery after collecting an address and a confirmation',
    inputSchema: z.object({ opKey: z.string() }),
    outputSchema: z.object({ status: z.string(), address: z.string().optional(), writes: z.number() }),
    execute: async ({ opKey }, { request }) => {
      const state = request.requestState as BookingState | undefined;
      const responses = request.inputResponses ?? {};
      journal.rounds.push(state?.phase ?? 'start');
      await request.log('info', { message: `round ${state?.phase ?? 'start'}` });
      await request.log('warning', { message: `warn ${state?.phase ?? 'start'}` });

      if (!state) {
        return {
          kind: 'input_required',
          result: inputRequired({
            inputRequests: {
              address: inputRequired.elicit({
                message: 'Delivery address?',
                requestedSchema: { type: 'object', properties: { address: { type: 'string' } }, required: ['address'] },
              }),
            },
            requestState: await codec.mint({ phase: 'address', opKey }),
          }),
        };
      }
      if (state.phase === 'address') {
        const address = responses.address;
        if (address?.action !== 'accept') return { kind: 'completed', value: { status: 'declined', writes: journal.writes } };
        return {
          kind: 'input_required',
          result: inputRequired({
            inputRequests: {
              confirm: inputRequired.elicit({
                message: 'Confirm?',
                requestedSchema: { type: 'object', properties: { ok: { type: 'boolean' } }, required: ['ok'] },
              }),
            },
            requestState: await codec.mint({
              phase: 'confirm',
              opKey,
              address: (address.content as { address: string }).address,
            }),
          }),
        };
      }
      const confirm = responses.confirm;
      if (confirm?.action !== 'accept' || !(confirm.content as { ok: boolean }).ok) {
        return { kind: 'completed', value: { status: 'cancelled', writes: journal.writes } };
      }
      journal.writes += 1;
      return { kind: 'completed', value: { status: 'booked', address: state.address, writes: journal.writes } };
    },
  });

  const traceTool = createTool({
    id: 'traceTool',
    description: 'Echoes the W3C trace context a business tool sees on the request context',
    inputSchema: z.object({}),
    outputSchema: z.object({ traceparent: z.string().optional(), baggage: z.string().optional() }),
    execute: async (_input, context) => {
      const trace = context?.requestContext?.get('traceContext') as MCPTraceContext | undefined;
      return { traceparent: trace?.traceparent, baggage: trace?.baggage };
    },
  });

  const nativeTraceTool = createMCPTool({
    id: 'nativeTraceTool',
    description: 'Echoes the W3C trace context a native tool sees on the request metadata',
    inputSchema: z.object({}),
    outputSchema: z.object({ traceparent: z.string().optional() }),
    execute: async (_input, { request }) => ({
      kind: 'completed',
      value: { traceparent: request.metadata?.traceparent as string | undefined },
    }),
  });

  return new MCPServer({
    name: 'Lifecycle Server',
    version: '1.0.0',
    tools: { bookDelivery, traceTool, nativeTraceTool },
    requestState: { verify: codec.verify },
    resources: {
      listResources: async () => [
        { uri: 'policy://public', name: 'Policy' },
        { uri: 'policy://gated', name: 'Gated policy' },
      ],
      getResourceContent: async ({ uri, request }) => {
        if (uri !== 'policy://gated') return { text: 'policy' };
        const state = request.requestState as GateState | undefined;
        if (!state) {
          journal.rounds.push('resource:start');
          return {
            kind: 'input_required',
            result: inputRequired({
              inputRequests: { region: regionRequest },
              requestState: await codec.mint({ phase: 'gate', opKey: uri }),
            }),
          };
        }
        journal.rounds.push('resource:gate');
        const region = request.inputResponses?.region;
        if (region?.action !== 'accept') return { text: 'policy: declined' };
        return { text: `policy for ${(region.content as { region: string }).region}` };
      },
    },
    prompts: {
      listPrompts: async () => [{ name: 'gated-reply', description: 'Reply drafted for a region' }],
      getPromptMessages: async ({ request }) => {
        const state = request.requestState as GateState | undefined;
        if (!state) {
          journal.rounds.push('prompt:start');
          return {
            kind: 'input_required',
            result: inputRequired({
              inputRequests: { region: regionRequest },
              requestState: await codec.mint({ phase: 'gate', opKey: 'gated-reply' }),
            }),
          };
        }
        journal.rounds.push('prompt:gate');
        const region = request.inputResponses?.region;
        const text = region?.action === 'accept' ? `Reply for ${(region.content as { region: string }).region}` : 'declined';
        return [{ role: 'user', content: { type: 'text', text } }];
      },
    },
  });
}

type GateState = { phase: 'gate'; opKey: string };
const regionRequest = inputRequired.elicit({
  message: 'Which region?',
  requestedSchema: { type: 'object', properties: { region: { type: 'string' } }, required: ['region'] },
});

describe('InternalMastraMCPClient - native input rounds', () => {
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

  it('answers each keyed round through inputRequests and completes with one write', async () => {
    const seen: string[] = [];
    const inputRequests: MCPInputRequestHandler = async ({ key, params }) => {
      seen.push(`${key}:${params.mode === 'url' ? 'url' : 'form'}`);
      if (key === 'address') return { action: 'accept', content: { address: '1 Main St' } };
      if (key === 'confirm') return { action: 'accept', content: { ok: true } };
      return { action: 'decline' };
    };
    client = new InternalMastraMCPClient({ name: 'rounds', server: { url: served.url, inputRequests } });
    await client.connect();

    const tools = await client.tools();
    const result = await tools.bookDelivery!.execute!({ opKey: 'op-1' });

    expect(result).toEqual({ status: 'booked', address: '1 Main St', writes: 1 });
    expect(seen).toEqual(['address:form', 'confirm:form']);
    expect(journal.rounds).toEqual(['start', 'address', 'confirm']);
  });

  it('completes with the declined outcome when the handler declines a round', async () => {
    client = new InternalMastraMCPClient({
      name: 'decline',
      server: { url: served.url, inputRequests: async () => ({ action: 'decline' }) },
    });
    await client.connect();

    const tools = await client.tools();
    expect(await tools.bookDelivery!.execute!({ opKey: 'op-2' })).toEqual({ status: 'declined', writes: 0 });
    expect(journal.rounds).toEqual(['start', 'address']);
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
        inputRequests: async () => ({ action: 'decline' }),
      },
    });
    await client.connect();
    const tools = await client.tools();
    await tools.bookDelivery!.execute!({ opKey: 'op-4' });

    expect(messages.map(m => m.level)).toEqual(['warning', 'warning']);
    expect(messages.map(m => (m.details as any)?.data?.message)).toEqual(['warn start', 'warn address']);
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
        inputRequests: async () => ({ action: 'decline' }),
      },
    });
    await client.connect();
    const tools = await client.tools();
    await tools.bookDelivery!.execute!({ opKey: 'op-5' });

    expect(messages).toEqual([]);
  });

  it('continues native resources/read and prompts/get rounds through MCPClient', async () => {
    const keys: string[] = [];
    const mcpClient = new MCPClient({
      id: 'continuation',
      servers: {
        lifecycle: {
          url: served.url,
          inputRequests: async ({ key }) => {
            keys.push(key);
            return { action: 'accept', content: { region: 'north' } };
          },
        },
      },
    });
    try {
      const resource = await mcpClient.resources.read('lifecycle', 'policy://gated');
      expect(resource.contents).toEqual([{ uri: 'policy://gated', text: 'policy for north' }]);

      const prompt = await mcpClient.prompts.get({ serverName: 'lifecycle', name: 'gated-reply' });
      expect(prompt.messages).toEqual([{ role: 'user', content: { type: 'text', text: 'Reply for north' } }]);

      expect(keys).toEqual(['region', 'region']);
      expect(journal.rounds).toEqual(['resource:start', 'resource:gate', 'prompt:start', 'prompt:gate']);
      // Ungated reads never open a round.
      const plain = await mcpClient.resources.read('lifecycle', 'policy://public');
      expect(plain.contents).toEqual([{ uri: 'policy://public', text: 'policy' }]);
      expect(keys).toHaveLength(2);
    } finally {
      await mcpClient.disconnect();
    }
  });

  it('returns the declined branch when a resource or prompt round is declined', async () => {
    const mcpClient = new MCPClient({
      id: 'continuation-decline',
      servers: { lifecycle: { url: served.url, inputRequests: async () => ({ action: 'decline' }) } },
    });
    try {
      const resource = await mcpClient.resources.read('lifecycle', 'policy://gated');
      expect(resource.contents).toEqual([{ uri: 'policy://gated', text: 'policy: declined' }]);
      const prompt = await mcpClient.prompts.get({ serverName: 'lifecycle', name: 'gated-reply' });
      expect(prompt.messages[0]!.content).toEqual({ type: 'text', text: 'declined' });
    } finally {
      await mcpClient.disconnect();
    }
  });

  it('fails a gated resource read when no inputRequests handler is configured', async () => {
    const mcpClient = new MCPClient({ id: 'continuation-none', servers: { lifecycle: { url: served.url } } });
    try {
      await expect(mcpClient.resources.read('lifecycle', 'policy://gated')).rejects.toThrow();
      expect(journal.rounds).toEqual(['resource:start']);
    } finally {
      await mcpClient.disconnect();
    }
  });

  it('carries the client trace context to business and native tools on every request', async () => {
    let calls = 0;
    const traceContext = (): MCPTraceContext => {
      calls += 1;
      return {
        traceparent: `00-${String(calls).padStart(32, '0')}-${String(calls).padStart(16, '0')}-01`,
        baggage: `call=${calls}`,
      };
    };
    const mcpClient = new MCPClient({ id: 'trace', servers: { lifecycle: { url: served.url, traceContext } } });
    try {
      const tools = await mcpClient.listTools();
      const first = (await tools.lifecycle_traceTool!.execute!({})) as { traceparent?: string; baggage?: string };
      const second = (await tools.lifecycle_traceTool!.execute!({})) as { traceparent?: string; baggage?: string };
      const native = (await tools.lifecycle_nativeTraceTool!.execute!({})) as { traceparent?: string };

      expect(first.traceparent).toMatch(/^00-0{31}\d-0{15}\d-01$/);
      expect(first.baggage).toMatch(/^call=\d+$/);
      // The provider is consulted per request, so consecutive calls carry distinct contexts.
      expect(second.traceparent).not.toBe(first.traceparent);
      expect(native.traceparent).toMatch(/^00-0{31}\d-0{15}\d-01$/);
      expect(native.traceparent).not.toBe(second.traceparent);
    } finally {
      await mcpClient.disconnect();
    }
  });

  it('leaves the trace context empty on the server when the client provides none', async () => {
    const mcpClient = new MCPClient({ id: 'no-trace', servers: { lifecycle: { url: served.url } } });
    try {
      const tools = await mcpClient.listTools();
      expect(await tools.lifecycle_traceTool!.execute!({})).toEqual({});
    } finally {
      await mcpClient.disconnect();
    }
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

    const methods = methodsSeen(fetchSpy);
    expect(methods).toContain('server/discover');
    expect(methods).toContain('tools/list');
    expect(methods).not.toContain('initialize');
    expect(methods).not.toContain('notifications/initialized');
    expect(fetchSpy.mock.calls.every(([, init]) => (init?.method ?? 'GET').toUpperCase() === 'POST')).toBe(true);
    expect(fetchSpy.mock.calls.every(([, init]) => !new Headers(init?.headers).has('mcp-session-id'))).toBe(true);
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

  it('fails against a legacy-only server without downgrading or falling back to SSE', async () => {
    const methods: string[] = [];
    const httpMethods: string[] = [];
    const httpServer: HttpServer = createServer(async (req, res) => {
      httpMethods.push(req.method ?? '');
      const chunks: Buffer[] = [];
      for await (const chunk of req) chunks.push(chunk as Buffer);
      const body = chunks.length ? JSON.parse(Buffer.concat(chunks).toString('utf8')) : undefined;
      if (body?.method) methods.push(body.method);
      // A 2025-era server: only `initialize` is understood.
      if (body?.method === 'initialize') {
        res.writeHead(200, { 'content-type': 'application/json', 'mcp-session-id': 'legacy-session' }).end(
          JSON.stringify({
            jsonrpc: '2.0',
            id: body.id,
            result: { protocolVersion: '2025-11-25', capabilities: {}, serverInfo: { name: 'legacy', version: '1' } },
          }),
        );
        return;
      }
      res.writeHead(200, { 'content-type': 'application/json' }).end(
        JSON.stringify({ jsonrpc: '2.0', id: body?.id ?? null, error: { code: -32601, message: 'Method not found' } }),
      );
    });
    const url = await new Promise<URL>(resolve =>
      httpServer.listen(0, '127.0.0.1', () =>
        resolve(new URL(`http://127.0.0.1:${(httpServer.address() as AddressInfo).port}/mcp`)),
      ),
    );
    try {
      client = new InternalMastraMCPClient({ name: 'legacy-peer', server: { url } });
      await expect(client.connect()).rejects.toThrow();
      expect(methods).toEqual(['server/discover']);
      expect(httpMethods).toEqual(['POST']);
    } finally {
      httpServer.closeAllConnections();
      await new Promise<void>(resolve => httpServer.close(() => resolve()));
    }
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
