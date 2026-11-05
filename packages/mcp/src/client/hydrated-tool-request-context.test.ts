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
import type { LogHandler, SerializableMCPToolCatalog } from './types.js';

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

/**
 * With `logOnEventStream`, the echo tool also sends a server log that belongs to no request, so a
 * 2025-11-25 server delivers it on the client's long-lived event stream (the GET request).
 */
function buildMcpServer({ logOnEventStream = false } = {}) {
  const mcpServer = new McpServer(
    { name: 'per-user-server', version: '1.0.0' },
    { capabilities: { tools: {}, ...(logOnEventStream ? { logging: {} } : {}) } },
  );
  mcpServer.registerTool(
    'echo',
    { description: 'Echoes the text back', inputSchema: z.object({ text: z.string() }) },
    async ({ text }): Promise<CallToolResult> => {
      if (logOnEventStream) await mcpServer.sendLoggingMessage({ level: 'info', data: `echo ${text}` });
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
 */
function legacyHandler(options: { logOnEventStream?: boolean } = {}) {
  const sessions = new Map<string, NodeStreamableHTTPServerTransport>();
  return async (req: IncomingMessage, res: ServerResponse, body: unknown) => {
    const sessionId = req.headers['mcp-session-id'];
    let transport = typeof sessionId === 'string' ? sessions.get(sessionId) : undefined;
    if (!transport) {
      const created = new NodeStreamableHTTPServerTransport({
        sessionIdGenerator: () => randomUUID(),
        onsessioninitialized: id => {
          sessions.set(id, created);
        },
      });
      await buildMcpServer(options).connect(created);
      transport = created;
    }
    await transport.handleRequest(req, res, body);
  };
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
    await handler(req, res, body);
  });
  await new Promise<void>(resolve => httpServer.listen(0, '127.0.0.1', resolve));
  const { port } = httpServer.address() as AddressInfo;
  return {
    url: new URL(`http://127.0.0.1:${port}/mcp`),
    received,
    close: () =>
      new Promise<void>(resolve => {
        httpServer.closeAllConnections();
        httpServer.close(() => resolve());
      }),
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

/** A client whose custom fetch forwards the user in each request's requestContext. */
function perUserClient(url: URL, logger?: LogHandler) {
  const client = new MCPClient({
    id: `per-user-client-${++clientId}`,
    servers: {
      demo: {
        url,
        logger,
        fetch: (requestUrl, init, requestContext) => {
          const user = requestContext?.get('user');
          const headers = new Headers(init?.headers);
          headers.set('x-user', typeof user === 'string' ? user : NO_REQUEST_CONTEXT);
          return fetch(requestUrl, { ...init, headers });
        },
      },
    },
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
});
