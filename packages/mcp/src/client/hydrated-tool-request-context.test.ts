import { randomUUID } from 'node:crypto';
import { createServer } from 'node:http';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { createRequire } from 'node:module';
import type { AddressInfo } from 'node:net';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { RequestContext } from '@mastra/core/request-context';
import { NodeStreamableHTTPServerTransport, toNodeHandler } from '@modelcontextprotocol/node';
import { McpServer, createMcpHandler } from '@modelcontextprotocol/server';
import type { CallToolResult } from '@modelcontextprotocol/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { MCPClient } from './configuration.js';
import type { LogHandler, MastraFetchLike, SerializableMCPToolCatalog } from './types.js';

/**
 * Covers https://github.com/mastra-ai/mastra/issues/29531.
 *
 * The third argument of a server definition's custom `fetch` is the documented way to forward
 * per-user credentials. A tool rebuilt from a cached catalog with `toolsFromDefinitions()` opens
 * its connection on its first `execute()`, so that call's handshake must reach `fetch` with the
 * call's `requestContext`, like the `tools/call` that follows it. Otherwise a server that
 * authenticates every request sees the handshake as someone else (or no one) and refuses it.
 *
 * The HTTP tests run a real MCP server over HTTP. The server records the JSON-RPC method of every
 * request it receives with the user named in its `x-user` header, which the client's custom
 * `fetch` sets from `requestContext`: the user a per-user credential would identify.
 */

const NO_REQUEST_CONTEXT = 'no-request-context';
const EVENT_STREAM = 'GET (no JSON-RPC method)';

/** The echo tool's `text` argument, when the request is its `tools/call`. */
type ReceivedRequest = { method: string; user: string; text?: string };

const echoCallBody = z.object({ params: z.object({ arguments: z.object({ text: z.string() }) }) });

type LoggingOptions = { logOnEventStream?: boolean; logOnResponse?: boolean };

/**
 * With `logOnEventStream`, the echo tool also sends a server log that belongs to no request, so a
 * 2025-11-25 server delivers it on the client's long-lived event stream (the GET request). With
 * `logOnResponse`, it sends the log as part of the `tools/call`, on that request's response stream.
 */
function buildMcpServer({ logOnEventStream = false, logOnResponse = false }: LoggingOptions = {}) {
  const mcpServer = new McpServer(
    { name: 'per-user-server', version: '1.0.0' },
    { capabilities: { tools: {}, ...(logOnEventStream || logOnResponse ? { logging: {} } : {}) } },
  );
  mcpServer.registerTool(
    'echo',
    { description: 'Echoes the text back', inputSchema: z.object({ text: z.string() }) },
    async ({ text }, ctx): Promise<CallToolResult> => {
      if (logOnEventStream) await mcpServer.sendLoggingMessage({ level: 'info', data: `echo ${text}` });
      if (logOnResponse) {
        await ctx.mcpReq.notify({ method: 'notifications/message', params: { level: 'info', data: `echo ${text}` } });
      }
      return { content: [{ type: 'text', text: `echo: ${text}` }] };
    },
  );
  return mcpServer;
}

/**
 * The 2026-07-28 revision: the client opens with a `server/discover` probe.
 */
function modernHandler() {
  const handler = toNodeHandler(createMcpHandler(() => buildMcpServer().server, { legacy: 'reject' }));
  return (req: IncomingMessage, res: ServerResponse, body: unknown) => handler(req, res, body);
}

/**
 * A stateful 2025-11-25 server: after the rejected `server/discover` probe, the client's
 * handshake also sends `initialize` and `notifications/initialized`, each a separate HTTP request.
 * `mcpServers` holds the server of each session, so a test can send it a server-initiated request.
 * With `logDuringHandshake`, the server sends a log on the `initialize` response, before the
 * client's connect() returns.
 */
function legacyHandler(options: LoggingOptions & { logDuringHandshake?: boolean } = {}) {
  const sessions = new Map<string, NodeStreamableHTTPServerTransport>();
  const mcpServers: McpServer[] = [];
  const handler = async (req: IncomingMessage, res: ServerResponse, body: unknown) => {
    const sessionId = req.headers['mcp-session-id'];
    let transport = typeof sessionId === 'string' ? sessions.get(sessionId) : undefined;
    if (!transport) {
      const created = new NodeStreamableHTTPServerTransport({
        sessionIdGenerator: () => randomUUID(),
        onsessioninitialized: id => {
          sessions.set(id, created);
        },
      });
      const mcpServer = buildMcpServer({
        logOnEventStream: options.logOnEventStream || options.logDuringHandshake,
        logOnResponse: options.logOnResponse,
      });
      await mcpServer.connect(created);
      mcpServers.push(mcpServer);
      const deliver = created.onmessage;
      if (options.logDuringHandshake && deliver) {
        created.onmessage = (message, extra) => {
          if ('method' in message && message.method === 'initialize' && 'id' in message) {
            const log = {
              jsonrpc: '2.0' as const,
              method: 'notifications/message',
              params: { level: 'info', data: 'handshake log' },
            };
            void created.send(log, { relatedRequestId: message.id });
          }
          deliver.call(created, message, extra);
        };
      }
      transport = created;
    }
    await transport.handleRequest(req, res, body);
  };
  return Object.assign(handler, { mcpServers });
}

type Handler = ReturnType<typeof modernHandler>;

async function startServer(handler: Handler) {
  const received: ReceivedRequest[] = [];
  const httpServer = createServer(async (req, res) => {
    const chunks: Buffer[] = [];
    for await (const chunk of req) chunks.push(chunk as Buffer);
    const raw = Buffer.concat(chunks).toString('utf8');
    const body: unknown = raw ? JSON.parse(raw) : undefined;
    const method =
      body && typeof body === 'object' && 'method' in body && typeof body.method === 'string'
        ? body.method
        : `${req.method} (no JSON-RPC method)`;
    const user = req.headers['x-user'];
    received.push({
      method,
      user: typeof user === 'string' ? user : '(no x-user header)',
      text: echoCallBody.safeParse(body).data?.params.arguments.text,
    });
    // No keep-alive: while the server is stopped, a new request is refused rather than sent on a
    // socket the server already closed.
    res.setHeader('connection', 'close');
    await handler(req, res, body);
  });
  await new Promise<void>(resolve => httpServer.listen(0, '127.0.0.1', resolve));
  const { port } = httpServer.address() as AddressInfo;
  const close = () =>
    new Promise<void>(resolve => {
      httpServer.closeAllConnections();
      httpServer.close(() => resolve());
    });
  return {
    url: new URL(`http://127.0.0.1:${port}/mcp`),
    received,
    close,
    /** Takes the server down, so new requests are refused, until `restart()`. */
    stop: close,
    restart: () => {
      if (!httpServer.listening) httpServer.listen(port, '127.0.0.1');
    },
  };
}

let clientId = 0;
const clients: MCPClient[] = [];

afterEach(async () => {
  await Promise.all(clients.map(client => client.disconnect().catch(() => {})));
  clients.length = 0;
});

/** Lists the server's tools once, the way an app builds the catalog it caches. */
async function cachedCatalog(url: URL): Promise<SerializableMCPToolCatalog> {
  const lister = new MCPClient({
    id: `catalog-lister-${++clientId}`,
    servers: { demo: { url, requestInit: { headers: { 'x-user': 'catalog-builder' } } } },
  });
  clients.push(lister);
  const catalog = await lister.listToolDefinitions();
  await lister.disconnect();
  return catalog;
}

/** A custom fetch that forwards the user in each request's requestContext. */
const perUserFetch: MastraFetchLike = (requestUrl, init, requestContext) => {
  const user = requestContext?.get('user');
  const headers = new Headers(init?.headers);
  headers.set('x-user', typeof user === 'string' ? user : NO_REQUEST_CONTEXT);
  return fetch(requestUrl, { ...init, headers });
};

/** A client whose custom fetch forwards the user in each request's requestContext. */
function perUserClient(url: URL, logger?: LogHandler) {
  const client = new MCPClient({
    id: `per-user-client-${++clientId}`,
    servers: { demo: { url, logger, fetch: perUserFetch } },
  });
  clients.push(client);
  return client;
}

const callAs = (user: string) => {
  const requestContext = new RequestContext();
  requestContext.set('user', user);
  return { requestContext };
};

/** Records each server log the client's `logger` receives, with the user in its requestContext. */
function recordServerLogs() {
  const logs: { text: string; user: unknown }[] = [];
  const logger: LogHandler = entry => {
    if (!entry.message.includes('[MCP SERVER LOG]')) return;
    logs.push({ text: JSON.stringify(entry.details), user: entry.requestContext?.get('user') ?? null });
  };
  const find = (text: string) => logs.find(log => log.text.includes(text));
  return { logger, find };
}

const servers = [
  { revision: '2026-07-28', handler: modernHandler, handshake: ['server/discover'] },
  {
    revision: '2025-11-25',
    handler: legacyHandler,
    // The client probes with `server/discover` first, then falls back to `initialize`.
    handshake: ['server/discover', 'initialize', 'notifications/initialized'],
  },
] as const;

describe.each(servers)('hydrated MCP tool against a $revision server (issue #29531)', ({ handler, handshake }) => {
  let server: Awaited<ReturnType<typeof startServer>> | undefined;

  afterEach(async () => {
    await server?.close();
    server = undefined;
  });

  it("sends the lazy connect's handshake with the requestContext of the call that opened it", async () => {
    server = await startServer(handler());
    const catalog = await cachedCatalog(server.url);
    const tools = await perUserClient(server.url).toolsFromDefinitions({ definitions: catalog });
    server.received.length = 0;

    const result = await tools.demo_echo!.execute!({ text: 'hi' }, callAs('alice'));

    expect(result).toMatchObject({ content: [{ type: 'text', text: 'echo: hi' }] });
    const methods = server.received.map(request => request.method);
    expect(methods.slice(0, handshake.length)).toEqual(handshake);
    expect(methods.indexOf('tools/call')).toBeGreaterThanOrEqual(handshake.length);
    expect(server.received.filter(request => request.user !== 'alice')).toEqual([]);
  });

  it('opens one connection for concurrent first calls and sends each tools/call as its own user', async () => {
    server = await startServer(handler());
    const catalog = await cachedCatalog(server.url);
    const tools = await perUserClient(server.url).toolsFromDefinitions({ definitions: catalog });
    server.received.length = 0;

    const [aliceResult, bobResult] = await Promise.all([
      tools.demo_echo!.execute!({ text: 'from alice' }, callAs('alice')),
      tools.demo_echo!.execute!({ text: 'from bob' }, callAs('bob')),
    ]);

    expect(aliceResult).toMatchObject({ content: [{ type: 'text', text: 'echo: from alice' }] });
    expect(bobResult).toMatchObject({ content: [{ type: 'text', text: 'echo: from bob' }] });
    const handshakeRequests = server.received.filter(request => handshake.some(method => method === request.method));
    expect(handshakeRequests.map(request => request.method)).toEqual(handshake);
    // The memoised connect runs once, as the call that started it.
    expect(new Set(handshakeRequests.map(request => request.user)).size).toBe(1);
    expect(['alice', 'bob']).toContain(handshakeRequests[0]!.user);
    const toolCalls = server.received.filter(request => request.method === 'tools/call');
    expect(toolCalls.map(({ user, text }) => ({ user, text }))).toEqual(
      expect.arrayContaining([
        { user: 'alice', text: 'from alice' },
        { user: 'bob', text: 'from bob' },
      ]),
    );
    expect(toolCalls).toHaveLength(2);
  });

  it('keeps a null requestContext for a handshake that no tool call started', async () => {
    server = await startServer(handler());
    const client = perUserClient(server.url);

    await client.listTools();

    const methods = server.received.map(request => request.method);
    expect(methods.slice(0, handshake.length)).toEqual(handshake);
    expect(methods.indexOf('tools/list')).toBeGreaterThanOrEqual(handshake.length);
    expect(new Set(server.received.map(request => request.user))).toEqual(new Set([NO_REQUEST_CONTEXT]));
  });
});

/**
 * The event stream a 2025-11-25 connection keeps open must authenticate like the handshake that
 * opened it, but a server log arriving on it belongs to no call: labelling it with the opening
 * call's requestContext would attribute a later user's server logs to the first user.
 */
describe('hydrated MCP tool on a 2025-11-25 server event stream (issue #29531)', () => {
  let server: Awaited<ReturnType<typeof startServer>> | undefined;

  afterEach(async () => {
    await server?.close();
    server = undefined;
  });

  it("opens the event stream as the first call but does not label a later call's server logs with it", async () => {
    server = await startServer(legacyHandler({ logOnEventStream: true }));
    const catalog = await cachedCatalog(server.url);
    const serverLogs = recordServerLogs();
    const tools = await perUserClient(server.url, serverLogs.logger).toolsFromDefinitions({ definitions: catalog });
    server.received.length = 0;

    await tools.demo_echo!.execute!({ text: 'first' }, callAs('alice'));
    const { received } = server;
    await vi.waitFor(() => expect(received.some(request => request.method === EVENT_STREAM)).toBe(true));
    await tools.demo_echo!.execute!({ text: 'second' }, callAs('bob'));
    await vi.waitFor(() => expect(serverLogs.find('echo second')).toBeDefined());

    const eventStreams = received.filter(request => request.method === EVENT_STREAM);
    expect(new Set(eventStreams.map(request => request.user))).toEqual(new Set(['alice']));
    expect(serverLogs.find('echo second')!.user).toBeNull();
  });

  it('sends the reply to a server request on the event stream as the call that opened it', async () => {
    const handler = legacyHandler();
    server = await startServer(handler);
    const catalog = await cachedCatalog(server.url);
    const client = new MCPClient({
      id: `per-user-elicitation-client-${++clientId}`,
      servers: {
        demo: {
          url: server.url,
          inputRequests: async () => ({ action: 'accept', content: { approved: true } }),
          fetch: perUserFetch,
        },
      },
    });
    clients.push(client);
    const tools = await client.toolsFromDefinitions({ definitions: catalog });
    server.received.length = 0;

    await tools.demo_echo!.execute!({ text: 'first' }, callAs('alice'));
    const { received } = server;
    await vi.waitFor(() => expect(received.some(request => request.method === EVENT_STREAM)).toBe(true));
    received.length = 0;
    // No related request: the server sends it on the event stream alice's call opened.
    const result = await handler.mcpServers.at(-1)!.server.elicitInput({
      mode: 'form',
      message: 'Approve?',
      requestedSchema: { type: 'object', properties: { approved: { type: 'boolean' } } },
    });

    expect(result).toMatchObject({ action: 'accept', content: { approved: true } });
    expect(received.map(({ method, user }) => ({ method, user }))).toEqual([
      { method: 'POST (no JSON-RPC method)', user: 'alice' },
    ]);
  });

  it('does not send requests a server log on the event stream starts as the call that opened the stream', async () => {
    server = await startServer(legacyHandler({ logOnEventStream: true }));
    const catalog = await cachedCatalog(server.url);
    const serverLogs = recordServerLogs();
    let startedFromLog: Promise<unknown> | undefined;
    const logger: LogHandler = entry => {
      serverLogs.logger(entry);
      // This log arrives on the event stream alice's call opened, but no call of alice's started
      // what the callback does next: a tool call without a requestContext and a tools/list.
      if (!startedFromLog && serverLogs.find('echo second')) {
        startedFromLog = Promise.all([tools.demo_echo!.execute!({ text: 'from log' }, {}), client.listTools()]);
      }
    };
    const client = perUserClient(server.url, logger);
    const tools = await client.toolsFromDefinitions({ definitions: catalog });
    server.received.length = 0;

    await tools.demo_echo!.execute!({ text: 'first' }, callAs('alice'));
    const { received } = server;
    await vi.waitFor(() => expect(received.some(request => request.method === EVENT_STREAM)).toBe(true));
    await tools.demo_echo!.execute!({ text: 'second' }, callAs('alice'));
    await vi.waitFor(() => expect(startedFromLog).toBeDefined());
    await startedFromLog;

    const fromLog = received.filter(
      request => request.method === 'tools/list' || (request.method === 'tools/call' && request.text === 'from log'),
    );
    expect(fromLog.map(({ method, user }) => ({ method, user }))).toEqual(
      expect.arrayContaining([
        { method: 'tools/call', user: NO_REQUEST_CONTEXT },
        { method: 'tools/list', user: NO_REQUEST_CONTEXT },
      ]),
    );
    expect(fromLog).toHaveLength(2);
  });

  it('sends replies on a connection that a server log reconnects as no call', async () => {
    const handler = legacyHandler({ logOnEventStream: true });
    server = await startServer(handler);
    const catalog = await cachedCatalog(server.url);
    let reconnect: Promise<void> | undefined;
    const client = new MCPClient({
      id: `per-user-reconnect-from-log-${++clientId}`,
      servers: {
        demo: {
          url: server.url,
          inputRequests: async () => ({ action: 'accept', content: { approved: true } }),
          fetch: perUserFetch,
          logger: entry => {
            if (!reconnect && JSON.stringify(entry.details ?? {}).includes('reconnect now')) {
              reconnect = client.reconnectServer('demo');
            }
          },
        },
      },
    });
    clients.push(client);
    const tools = await client.toolsFromDefinitions({ definitions: catalog });

    await tools.demo_echo!.execute!({ text: 'first' }, callAs('alice'));
    const { received } = server;
    await vi.waitFor(() => expect(received.some(request => request.method === EVENT_STREAM)).toBe(true));
    const serversBefore = handler.mcpServers.length;
    received.length = 0;
    // A log on the event stream alice's call opened; its callback reconnects, as no call.
    await handler.mcpServers.at(-1)!.sendLoggingMessage({ level: 'info', data: 'reconnect now' });
    await vi.waitFor(() => expect(reconnect).toBeDefined());
    await reconnect;
    expect(handler.mcpServers.length).toBeGreaterThan(serversBefore);
    await vi.waitFor(() => expect(received.some(request => request.method === EVENT_STREAM)).toBe(true));
    expect(new Set(received.map(request => request.user))).toEqual(new Set([NO_REQUEST_CONTEXT]));
    received.length = 0;
    const result = await handler.mcpServers.at(-1)!.server.elicitInput({
      mode: 'form',
      message: 'Approve?',
      requestedSchema: { type: 'object', properties: { approved: { type: 'boolean' } } },
    });

    expect(result).toMatchObject({ action: 'accept', content: { approved: true } });
    expect(received.map(({ method, user }) => ({ method, user }))).toEqual([
      { method: 'POST (no JSON-RPC method)', user: NO_REQUEST_CONTEXT },
    ]);
  });

  it("labels a server log on a call's own response stream with that call's requestContext", async () => {
    server = await startServer(legacyHandler({ logOnResponse: true }));
    const catalog = await cachedCatalog(server.url);
    const serverLogs = recordServerLogs();
    const tools = await perUserClient(server.url, serverLogs.logger).toolsFromDefinitions({ definitions: catalog });

    await tools.demo_echo!.execute!({ text: 'first' }, callAs('alice'));
    await tools.demo_echo!.execute!({ text: 'second' }, callAs('bob'));

    expect(serverLogs.find('echo first')?.user).toBe('alice');
    expect(serverLogs.find('echo second')?.user).toBe('bob');
  });

  it("opens a connection as the call that opens it, even from a callback inside another call's scope", async () => {
    server = await startServer(legacyHandler({ logOnResponse: true }));
    const catalog = await cachedCatalog(server.url);
    let nested: Promise<unknown> | undefined;
    // The log on alice's own response stream runs this callback inside alice's call. It drops the
    // connection, so bob's call that follows opens a new one.
    const logger: LogHandler = entry => {
      if (!nested && JSON.stringify(entry.details ?? {}).includes('echo trigger')) {
        nested = (async () => {
          await client.disconnect();
          server!.received.length = 0;
          return tools.demo_echo!.execute!({ text: 'nested' }, callAs('bob'));
        })();
      }
    };
    const client = perUserClient(server.url, logger);
    const tools = await client.toolsFromDefinitions({ definitions: catalog });

    // The disconnect may abort alice's own call; only bob's connection matters here.
    await tools.demo_echo!.execute!({ text: 'trigger' }, callAs('alice')).catch(() => {});
    await vi.waitFor(() => expect(nested).toBeDefined());

    expect(await nested).toMatchObject({ content: [{ type: 'text', text: 'echo: nested' }] });
    const { received } = server;
    expect(received.filter(request => request.method === 'initialize').map(request => request.user)).toEqual(['bob']);
    expect(received.filter(request => request.user !== 'bob')).toEqual([]);
  });
});

/**
 * The handshake runs as the call that opened the connection, but a server log delivered during it
 * belongs to no call. A request the log's handler starts must not be sent as that call either.
 */
describe('hydrated MCP tool whose 2025-11-25 server logs during the handshake (issue #29531)', () => {
  let server: Awaited<ReturnType<typeof startServer>> | undefined;

  afterEach(async () => {
    await server?.close();
    server = undefined;
  });

  it('does not send a request a handshake log starts as the call that opened the connection', async () => {
    server = await startServer(legacyHandler({ logDuringHandshake: true }));
    const catalog = await cachedCatalog(server.url);
    let startedFromLog: Promise<unknown> | undefined;
    const logger: LogHandler = entry => {
      if (!startedFromLog && JSON.stringify(entry.details ?? {}).includes('handshake log')) {
        startedFromLog = client.listTools();
      }
    };
    const client = perUserClient(server.url, logger);
    const tools = await client.toolsFromDefinitions({ definitions: catalog });
    server.received.length = 0;

    await tools.demo_echo!.execute!({ text: 'first' }, callAs('alice'));
    expect(startedFromLog).toBeDefined();
    await startedFromLog;

    const { received } = server;
    expect(received.filter(request => request.method === 'initialize').map(request => request.user)).toEqual(['alice']);
    expect(received.filter(request => request.method === 'tools/list').map(request => request.user)).toEqual([
      NO_REQUEST_CONTEXT,
    ]);
  });
});

/**
 * A tool call that the server refuses while it restarts reconnects, and the new connection's handshake and event
 * stream go out as that call, like a hydrated tool's first connect. The reconnect runs inside the
 * call, but a server message arriving on the new event stream still belongs to no call: it must not
 * be labelled with the reconnecting caller's requestContext, nor send its handler's requests as them.
 */
describe('MCP tool call that reconnects to a 2025-11-25 server (issue #29531)', () => {
  let server: Awaited<ReturnType<typeof startServer>> | undefined;

  afterEach(async () => {
    await server?.close();
    server = undefined;
  });

  /**
   * Opens the connection with no requestContext and takes the server down, so alice's next call is
   * refused and reconnects. `restartOnReconnect` brings the server back as the client starts to.
   */
  async function reconnectAs(client: MCPClient, handler: ReturnType<typeof legacyHandler>) {
    const tools = await client.listTools();
    const { received } = server!;
    await vi.waitFor(() => expect(received.some(request => request.method === EVENT_STREAM)).toBe(true));
    await server!.stop();
    const serversBefore = handler.mcpServers.length;
    received.length = 0;

    const result = await tools.demo_echo!.execute!({ text: 'after restart' }, callAs('alice'));

    expect(result).toMatchObject({ content: [{ type: 'text', text: 'echo: after restart' }] });
    expect(handler.mcpServers.length).toBeGreaterThan(serversBefore);
    await vi.waitFor(() => expect(received.some(request => request.method === EVENT_STREAM)).toBe(true));
    return handler.mcpServers.at(-1)!;
  }

  /** Restarts the stopped server once the client logs that it is reconnecting. */
  const restartOnReconnect: LogHandler = entry => {
    if (entry.message.includes('attempting reconnection')) server?.restart();
  };

  it('opens the new connection as the reconnecting call but does not label its server logs with it', async () => {
    const handler = legacyHandler({ logOnEventStream: true });
    server = await startServer(handler);
    const serverLogs = recordServerLogs();
    let startedFromLog: Promise<unknown> | undefined;
    const logger: LogHandler = entry => {
      restartOnReconnect(entry);
      serverLogs.logger(entry);
      if (!startedFromLog && serverLogs.find('after reconnect')) startedFromLog = client.listTools();
    };
    const client = perUserClient(server.url, logger);

    const reconnected = await reconnectAs(client, handler);
    const { received } = server;
    const reconnectRequests = [...received];
    // No related request: the server sends it on the event stream the reconnect opened.
    await reconnected.sendLoggingMessage({ level: 'info', data: 'after reconnect' });
    await vi.waitFor(() => expect(startedFromLog).toBeDefined());
    await startedFromLog;

    // Refused requests never reach the server, so these are the reconnect and the retried call.
    expect(reconnectRequests.map(request => request.method)).toEqual(
      expect.arrayContaining(['initialize', 'notifications/initialized', EVENT_STREAM, 'tools/call']),
    );
    expect(reconnectRequests.filter(request => request.user !== 'alice')).toEqual([]);
    expect(serverLogs.find('after reconnect')!.user).toBeNull();
    expect(received.filter(request => request.method === 'tools/list').map(request => request.user)).toEqual([
      NO_REQUEST_CONTEXT,
    ]);
  });

  it('sends the reply to a server request on the new event stream as the reconnecting call', async () => {
    const handler = legacyHandler();
    server = await startServer(handler);
    const client = new MCPClient({
      id: `per-user-elicitation-client-${++clientId}`,
      servers: {
        demo: {
          url: server.url,
          logger: restartOnReconnect,
          inputRequests: async () => ({ action: 'accept', content: { approved: true } }),
          fetch: perUserFetch,
        },
      },
    });
    clients.push(client);

    const reconnected = await reconnectAs(client, handler);
    const { received } = server;
    received.length = 0;
    const result = await reconnected.server.elicitInput({
      mode: 'form',
      message: 'Approve?',
      requestedSchema: { type: 'object', properties: { approved: { type: 'boolean' } } },
    });

    expect(result).toMatchObject({ action: 'accept', content: { approved: true } });
    expect(received.map(({ method, user }) => ({ method, user }))).toEqual([
      { method: 'POST (no JSON-RPC method)', user: 'alice' },
    ]);
  });
});

/**
 * A stdio server has no `fetch` to authenticate, and its child process delivers all its output in
 * the async context it was spawned in. Spawned inside the first call's context, every later server
 * log would reach `logger` labelled as the first caller.
 */
describe('hydrated MCP tool against a stdio server (issue #29531)', () => {
  const require = createRequire(import.meta.url);
  const tsxCli = join(dirname(require.resolve('tsx/package.json')), 'dist', 'cli.mjs');
  const fixturePath = fileURLToPath(new URL('../__fixtures__/logging-echo-server.ts', import.meta.url));

  it("does not label a later call's server logs with the first caller's requestContext", async () => {
    const lister = new MCPClient({
      id: `stdio-lister-${++clientId}`,
      servers: { logging: { command: process.execPath, args: [tsxCli, fixturePath] } },
    });
    clients.push(lister);
    const catalog = await lister.listToolDefinitions();
    await lister.disconnect();

    const serverLogs = recordServerLogs();
    const client = new MCPClient({
      id: `stdio-caller-${++clientId}`,
      servers: { logging: { command: process.execPath, args: [tsxCli, fixturePath], logger: serverLogs.logger } },
    });
    clients.push(client);
    const tools = await client.toolsFromDefinitions({ definitions: catalog });

    const first = await tools.logging_echo!.execute!({ text: 'first' }, callAs('alice'));
    const second = await tools.logging_echo!.execute!({ text: 'second' }, callAs('bob'));

    expect(first).toMatchObject({ content: [{ type: 'text', text: 'echo: first' }] });
    expect(second).toMatchObject({ content: [{ type: 'text', text: 'echo: second' }] });
    expect(serverLogs.find('echo first')).toBeDefined();
    expect(serverLogs.find('echo second')?.user).toBeNull();
  }, 30_000);

  it('does not label later server logs with the requestContext of a call that respawned the server', async () => {
    const serverLogs = recordServerLogs();
    let closed = false;
    const logger: LogHandler = entry => {
      serverLogs.logger(entry);
      if (entry.message.includes('connection closed')) closed = true;
    };
    const client = new MCPClient({
      id: `stdio-respawn-${++clientId}`,
      servers: { logging: { command: process.execPath, args: [tsxCli, fixturePath], logger } },
    });
    clients.push(client);
    // Tools from listTools() run on the connection it opened; a call that finds it gone reconnects.
    const tools = await client.listTools();

    await tools.logging_echo!.execute!({ text: 'exit' }, {});
    await vi.waitFor(() => expect(closed).toBe(true), { timeout: 10_000 });
    // The server is gone, so bob's call spawns a new one before it runs.
    const respawned = await tools.logging_echo!.execute!({ text: 'respawned' }, callAs('bob'));
    const later = await tools.logging_echo!.execute!({ text: 'later' }, callAs('carol'));

    expect(respawned).toMatchObject({ content: [{ type: 'text', text: 'echo: respawned' }] });
    expect(later).toMatchObject({ content: [{ type: 'text', text: 'echo: later' }] });
    expect(serverLogs.find('echo later')?.user).toBeNull();
  }, 30_000);
});
