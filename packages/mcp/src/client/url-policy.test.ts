import { randomUUID } from 'node:crypto';
import { createServer } from 'node:http';
import type { IncomingMessage, Server as HttpServer, ServerResponse } from 'node:http';
import type { AddressInfo } from 'node:net';
import { NodeStreamableHTTPServerTransport } from '@modelcontextprotocol/node';
import { McpServer } from '@modelcontextprotocol/server';
import type { CallToolResult } from '@modelcontextprotocol/server';
import { SSEServerTransport } from '@modelcontextprotocol/server-legacy/sse';
import { describe, it, expect, afterEach, vi } from 'vitest';
import { z } from 'zod';

import { InternalMastraMCPClient } from './client.js';
import { isReconnectableMCPError } from './error-utils.js';
import { MCPOAuthClientProvider, InMemoryOAuthStorage } from './oauth-provider.js';
import {
  assertHostAllowed,
  assertResponseHostAllowed,
  fetchFollowingAllowedRedirects,
  wrapFetchWithHostPolicy,
} from './url-policy.js';

// =============================================================================
// Unit tests: assertHostAllowed
// =============================================================================

describe('assertHostAllowed', () => {
  it('passes an exactly matching host', () => {
    expect(() => assertHostAllowed('https://api.example.com/mcp', ['api.example.com'])).not.toThrow();
  });

  it('matches case-insensitively on the hostname', () => {
    expect(() => assertHostAllowed('https://API.Example.COM/mcp', ['api.example.com'])).not.toThrow();
    expect(() => assertHostAllowed('https://api.example.com/mcp', ['API.EXAMPLE.COM'])).not.toThrow();
  });

  it('elides default ports per WHATWG URL: https://x.com:443 has host x.com', () => {
    expect(() => assertHostAllowed('https://x.com:443/a', ['x.com'])).not.toThrow();
    expect(() => assertHostAllowed('http://x.com:80/a', ['x.com'])).not.toThrow();
  });

  it('requires the port in the entry when the URL carries a non-default port', () => {
    expect(() => assertHostAllowed('https://x.com:8443/a', ['x.com'])).toThrow(/allowedHosts/);
    expect(() => assertHostAllowed('https://x.com:8443/a', ['x.com:8443'])).not.toThrow();
  });

  it('matches IPv6 hosts with brackets, as rendered by URL.host', () => {
    expect(() => assertHostAllowed('http://[::1]:8080/', ['[::1]:8080'])).not.toThrow();
    expect(() => assertHostAllowed('http://[::1]:8080/', ['::1:8080'])).toThrow(/allowedHosts/);
  });

  it('denies every host when the allowlist is empty', () => {
    expect(() => assertHostAllowed('https://anything.example/', [])).toThrow(/allowedHosts/);
    expect(() => assertHostAllowed('http://localhost:3000/', [])).toThrow(/allowedHosts/);
  });

  it('throws an error that is not treated as reconnectable', () => {
    let thrown: unknown;
    try {
      assertHostAllowed('https://blocked.example/', ['allowed.example']);
    } catch (e) {
      thrown = e;
    }
    expect(thrown).toBeInstanceOf(Error);
    expect((thrown as Error).message).toContain('blocked.example');
    expect((thrown as Error).message).toContain('allowedHosts');
    // A policy violation must never feed the reconnect machinery.
    expect(isReconnectableMCPError(thrown)).toBe(false);
  });
});

// =============================================================================
// Unit tests: assertResponseHostAllowed (post-hoc validation)
// =============================================================================

describe('assertResponseHostAllowed', () => {
  it('returns the response when the final URL host is allowed', () => {
    const response = { url: 'https://api.example.com/mcp' };
    expect(assertResponseHostAllowed(response, ['api.example.com'])).toBe(response);
  });

  it('throws when the final URL landed on a disallowed host', () => {
    const response = { url: 'https://internal.attacker.example/steal' };
    expect(() => assertResponseHostAllowed(response, ['api.example.com'])).toThrow(/allowedHosts/);
  });

  it('fails open for a hand-built Response with an empty url (documented limitation)', () => {
    const handBuilt = new Response('{}', { status: 200 });
    expect(handBuilt.url).toBe('');
    expect(assertResponseHostAllowed(handBuilt, ['api.example.com'])).toBe(handBuilt);
  });
});

// =============================================================================
// Unit tests: wrapFetchWithHostPolicy (custom fetch / eventSourceInit.fetch path)
// =============================================================================

describe('wrapFetchWithHostPolicy', () => {
  it('checks the request URL before the wrapped fetch runs', async () => {
    const inner = vi.fn(async () => ({ url: '' }));
    const wrapped = wrapFetchWithHostPolicy(inner, ['api.example.com']);
    await expect(wrapped('https://blocked.example/')).rejects.toThrow(/allowedHosts/);
    expect(inner).not.toHaveBeenCalled();
  });

  it('validates the response post-hoc when the wrapped fetch auto-followed to a disallowed host', async () => {
    const inner = vi.fn(async () => ({ url: 'https://internal.example/secret' }));
    const wrapped = wrapFetchWithHostPolicy(inner, ['api.example.com']);
    await expect(wrapped('https://api.example.com/mcp')).rejects.toThrow(/allowedHosts/);
    expect(inner).toHaveBeenCalledTimes(1);
  });

  it('passes an allowed response through unchanged', async () => {
    const response = { url: 'https://api.example.com/mcp' };
    const inner = vi.fn(async () => response);
    const wrapped = wrapFetchWithHostPolicy(inner, ['api.example.com']);
    await expect(wrapped('https://api.example.com/mcp')).resolves.toBe(response);
  });
});

// =============================================================================
// Unit tests: fetchFollowingAllowedRedirects (manual redirect loop)
// =============================================================================

function redirectResponse(status: number, location?: string): Response {
  return new Response(null, { status, headers: location ? { location } : {} });
}

describe('fetchFollowingAllowedRedirects', () => {
  const allowed = ['a.example', 'b.example'];

  it('dispatches with redirect: manual and returns a non-redirect response', async () => {
    const impl = vi.fn(async () => new Response('ok', { status: 200 }));
    const res = await fetchFollowingAllowedRedirects(impl, 'https://a.example/x', undefined, allowed);
    expect(res.status).toBe(200);
    expect(impl).toHaveBeenCalledTimes(1);
    expect(impl.mock.calls[0]![1]).toMatchObject({ redirect: 'manual' });
  });

  it('follows an absolute-Location redirect to an allowed host', async () => {
    const impl = vi
      .fn()
      .mockResolvedValueOnce(redirectResponse(302, 'https://b.example/next'))
      .mockResolvedValueOnce(new Response('ok', { status: 200 }));
    const res = await fetchFollowingAllowedRedirects(impl, 'https://a.example/x', undefined, allowed);
    expect(res.status).toBe(200);
    expect(impl).toHaveBeenCalledTimes(2);
    expect(String(impl.mock.calls[1]![0])).toBe('https://b.example/next');
  });

  it('resolves a relative Location against the current hop URL', async () => {
    const impl = vi
      .fn()
      .mockResolvedValueOnce(redirectResponse(302, '/moved/here'))
      .mockResolvedValueOnce(new Response('ok', { status: 200 }));
    await fetchFollowingAllowedRedirects(impl, 'https://a.example/base/path', undefined, allowed);
    expect(String(impl.mock.calls[1]![0])).toBe('https://a.example/moved/here');
  });

  it('blocks a redirect hop to a disallowed host before it is sent', async () => {
    const impl = vi.fn().mockResolvedValueOnce(redirectResponse(302, 'https://evil.example/steal'));
    await expect(fetchFollowingAllowedRedirects(impl, 'https://a.example/x', undefined, allowed)).rejects.toThrow(
      /allowedHosts/,
    );
    // The disallowed hop was never dispatched.
    expect(impl).toHaveBeenCalledTimes(1);
  });

  it('throws after more than 5 redirect hops', async () => {
    const impl = vi.fn(async () => redirectResponse(302, 'https://a.example/again'));
    await expect(fetchFollowingAllowedRedirects(impl, 'https://a.example/x', undefined, allowed)).rejects.toThrow(
      /redirect hops/i,
    );
    // Initial request + 5 followed hops = 6 dispatches; the 6th redirect overflows.
    expect(impl).toHaveBeenCalledTimes(6);
  });

  it('switches POST to GET and drops the body on 303', async () => {
    const impl = vi
      .fn()
      .mockResolvedValueOnce(redirectResponse(303, 'https://b.example/next'))
      .mockResolvedValueOnce(new Response('ok', { status: 200 }));
    await fetchFollowingAllowedRedirects(
      impl,
      'https://a.example/x',
      { method: 'POST', body: '{"x":1}', headers: { 'content-type': 'application/json' } },
      allowed,
    );
    const secondInit = impl.mock.calls[1]![1]!;
    expect(secondInit.method).toBe('GET');
    expect(secondInit.body).toBeUndefined();
    expect((secondInit.headers as Headers).get('content-type')).toBeNull();
  });

  it('preserves method and string body on 307', async () => {
    const impl = vi
      .fn()
      .mockResolvedValueOnce(redirectResponse(307, 'https://b.example/next'))
      .mockResolvedValueOnce(new Response('ok', { status: 200 }));
    await fetchFollowingAllowedRedirects(impl, 'https://a.example/x', { method: 'POST', body: '{"x":1}' }, allowed);
    const secondInit = impl.mock.calls[1]![1]!;
    expect(secondInit.method).toBe('POST');
    expect(secondInit.body).toBe('{"x":1}');
  });

  it('throws on 307 when the body is not replayable instead of silently re-sending an empty body', async () => {
    const impl = vi.fn().mockResolvedValueOnce(redirectResponse(307, 'https://b.example/next'));
    const streamBody = new ReadableStream();
    await expect(
      fetchFollowingAllowedRedirects(
        impl,
        'https://a.example/x',
        { method: 'POST', body: streamBody, duplex: 'half' } as RequestInit,
        allowed,
      ),
    ).rejects.toThrow(/not replayable/);
  });

  it('throws on a 302 that preserves a non-replayable body (non-POST method) instead of re-sending it', async () => {
    // A 302 only switches to GET for POST; a PUT keeps its method and body, so
    // a consumed one-shot body must fail loudly rather than be re-sent empty.
    const impl = vi.fn().mockResolvedValueOnce(redirectResponse(302, 'https://b.example/next'));
    const streamBody = new ReadableStream();
    await expect(
      fetchFollowingAllowedRedirects(
        impl,
        'https://a.example/x',
        { method: 'PUT', body: streamBody, duplex: 'half' } as RequestInit,
        allowed,
      ),
    ).rejects.toThrow(/not replayable/);
    expect(impl).toHaveBeenCalledTimes(1);
  });

  it('strips the Authorization header on a hop to a different host but keeps it same-host', async () => {
    const crossHost = vi
      .fn()
      .mockResolvedValueOnce(redirectResponse(302, 'https://b.example/next'))
      .mockResolvedValueOnce(new Response('ok', { status: 200 }));
    await fetchFollowingAllowedRedirects(
      crossHost,
      'https://a.example/x',
      { headers: { authorization: 'Bearer secret' } },
      allowed,
    );
    expect((crossHost.mock.calls[1]![1]!.headers as Headers).get('authorization')).toBeNull();

    const sameHost = vi
      .fn()
      .mockResolvedValueOnce(redirectResponse(302, 'https://a.example/next'))
      .mockResolvedValueOnce(new Response('ok', { status: 200 }));
    await fetchFollowingAllowedRedirects(
      sameHost,
      'https://a.example/x',
      { headers: { authorization: 'Bearer secret' } },
      allowed,
    );
    expect((sameHost.mock.calls[1]![1]!.headers as Headers).get('authorization')).toBe('Bearer secret');
  });

  it('strips the Authorization header on a same-host scheme downgrade (origin change)', async () => {
    // WHATWG Fetch strips credentials when the ORIGIN changes, not just the host:
    // https://a.example -> http://a.example must not re-send the bearer token in cleartext.
    const downgrade = vi
      .fn()
      .mockResolvedValueOnce(redirectResponse(302, 'http://a.example/next'))
      .mockResolvedValueOnce(new Response('ok', { status: 200 }));
    await fetchFollowingAllowedRedirects(
      downgrade,
      'https://a.example/x',
      { headers: { authorization: 'Bearer secret' } },
      allowed,
    );
    expect((downgrade.mock.calls[1]![1]!.headers as Headers).get('authorization')).toBeNull();
  });

  it('throws only non-reconnectable errors from the redirect loop', async () => {
    // Every terminal redirect-loop error must dodge isReconnectableMCPError, or a
    // final failure gets misclassified as transient and fed to the reconnect
    // machinery. The hop-overflow case is the sharpest: the request URL contains
    // "sessionId" (as legacy SSE POST endpoints do), which would match the
    // reconnectable "session" substring if the message interpolated the full URL.
    const alwaysRedirect = vi.fn().mockResolvedValue(redirectResponse(302, 'https://a.example/loop'));
    const overflow = await fetchFollowingAllowedRedirects(
      alwaysRedirect,
      'https://a.example/messages?sessionId=abc123',
      undefined,
      allowed,
    ).then(
      () => undefined,
      e => e,
    );
    expect(overflow).toBeInstanceOf(Error);
    expect(isReconnectableMCPError(overflow)).toBe(false);

    const noLocation = await fetchFollowingAllowedRedirects(
      vi.fn().mockResolvedValueOnce(redirectResponse(301)),
      'https://a.example/messages?sessionId=abc123',
      undefined,
      allowed,
    ).then(
      () => undefined,
      e => e,
    );
    expect(noLocation).toBeInstanceOf(Error);
    expect(isReconnectableMCPError(noLocation)).toBe(false);

    const notReplayable = await fetchFollowingAllowedRedirects(
      vi.fn().mockResolvedValueOnce(redirectResponse(307, 'https://a.example/next')),
      'https://a.example/messages?sessionId=abc123',
      { method: 'POST', body: new Uint8Array([1]) },
      allowed,
    ).then(
      () => undefined,
      e => e,
    );
    expect(notReplayable).toBeInstanceOf(Error);
    expect(isReconnectableMCPError(notReplayable)).toBe(false);
  });

  it('throws on a redirect status with no Location header', async () => {
    const impl = vi.fn().mockResolvedValueOnce(redirectResponse(301));
    await expect(fetchFollowingAllowedRedirects(impl, 'https://a.example/x', undefined, allowed)).rejects.toThrow(
      /Location/,
    );
  });
});

// =============================================================================
// Integration helpers: real MCP servers over node:http
// =============================================================================

type TestMcpServer = {
  httpServer: HttpServer;
  baseUrl: URL;
  host: string;
  /** All requests received, in order. */
  requests: { method: string; url: string }[];
  close: () => Promise<void>;
};

function buildMcpServer(): McpServer {
  const mcpServer = new McpServer({ name: 'url-policy-test-server', version: '1.0.0' }, { capabilities: { tools: {} } });
  mcpServer.registerTool(
    'greet',
    {
      description: 'A simple greeting tool',
      inputSchema: z.object({ name: z.string().describe('Name to greet').default('World') }),
    },
    async ({ name }): Promise<CallToolResult> => ({ content: [{ type: 'text', text: `Hello, ${name}!` }] }),
  );
  return mcpServer;
}

function listen(httpServer: HttpServer, pathname: string): Promise<URL> {
  return new Promise<URL>(resolve => {
    httpServer.listen(0, '127.0.0.1', () => {
      const addr = httpServer.address() as AddressInfo;
      resolve(new URL(`http://127.0.0.1:${addr.port}${pathname}`));
    });
  });
}

function closeServer(httpServer: HttpServer): Promise<void> {
  return new Promise<void>(resolve => {
    httpServer.closeAllConnections?.();
    httpServer.close(() => resolve());
  });
}

/**
 * Stateless Streamable HTTP MCP server (SDK 1.27+ requires a fresh transport per
 * request). `intercept` runs first for every request; returning true means the
 * interceptor handled the response.
 */
async function startStreamableServer(
  intercept?: (req: IncomingMessage, res: ServerResponse) => boolean,
): Promise<TestMcpServer> {
  const mcpServer = buildMcpServer();
  const requests: { method: string; url: string }[] = [];

  const httpServer = createServer();
  httpServer.on('request', async (req, res) => {
    requests.push({ method: req.method ?? '', url: req.url ?? '' });
    if (intercept?.(req, res)) {
      return;
    }
    await mcpServer.close().catch(() => {});
    const transport = new NodeStreamableHTTPServerTransport({ sessionIdGenerator: undefined });
    await mcpServer.connect(transport);
    await transport.handleRequest(req, res);
  });

  const baseUrl = await listen(httpServer, '/mcp');
  return {
    httpServer,
    baseUrl,
    host: baseUrl.host,
    requests,
    close: async () => {
      await mcpServer.close().catch(() => {});
      await closeServer(httpServer);
    },
  };
}

/** Stateful Streamable HTTP MCP server — needed for the persistent GET event stream. */
async function startStatefulStreamableServer(): Promise<TestMcpServer> {
  const mcpServer = buildMcpServer();
  const requests: { method: string; url: string }[] = [];
  const serverTransport = new NodeStreamableHTTPServerTransport({ sessionIdGenerator: () => randomUUID() });
  await mcpServer.connect(serverTransport);

  const httpServer = createServer();
  httpServer.on('request', async (req, res) => {
    requests.push({ method: req.method ?? '', url: req.url ?? '' });
    await serverTransport.handleRequest(req, res);
  });

  const baseUrl = await listen(httpServer, '/mcp');
  return {
    httpServer,
    baseUrl,
    host: baseUrl.host,
    requests,
    close: async () => {
      await mcpServer.close().catch(() => {});
      await serverTransport.close().catch(() => {});
      await closeServer(httpServer);
    },
  };
}

/** Legacy HTTP+SSE MCP server, for exercising the eventSourceInit.fetch path. */
async function startSseServer(): Promise<TestMcpServer> {
  const mcpServer = buildMcpServer();
  const requests: { method: string; url: string }[] = [];
  const transports = new Map<string, SSEServerTransport>();

  const httpServer = createServer();
  httpServer.on('request', async (req, res) => {
    requests.push({ method: req.method ?? '', url: req.url ?? '' });
    const requestUrl = new URL(req.url ?? '', 'http://127.0.0.1');
    if (req.method === 'GET' && requestUrl.pathname === '/sse') {
      const transport = new SSEServerTransport('/messages', res);
      transports.set(transport.sessionId, transport);
      await mcpServer.connect(transport);
      return;
    }
    if (req.method === 'POST' && requestUrl.pathname === '/messages') {
      const sessionId = requestUrl.searchParams.get('sessionId') ?? '';
      const transport = transports.get(sessionId);
      if (!transport) {
        res.writeHead(404).end();
        return;
      }
      await transport.handlePostMessage(req, res);
      return;
    }
    res.writeHead(404).end();
  });

  const baseUrl = await listen(httpServer, '/sse');
  return {
    httpServer,
    baseUrl,
    host: baseUrl.host,
    requests,
    close: async () => {
      await mcpServer.close().catch(() => {});
      await closeServer(httpServer);
    },
  };
}

/** A plain HTTP server standing in for a disallowed internal service. Counts requests. */
async function startDecoyServer(): Promise<TestMcpServer> {
  const requests: { method: string; url: string }[] = [];
  const httpServer = createServer((req, res) => {
    requests.push({ method: req.method ?? '', url: req.url ?? '' });
    res.writeHead(200, { 'content-type': 'text/plain' }).end('decoy');
  });
  const baseUrl = await listen(httpServer, '/mcp');
  return { httpServer, baseUrl, host: baseUrl.host, requests, close: () => closeServer(httpServer) };
}

// =============================================================================
// Integration tests: InternalMastraMCPClient with allowedHosts
// =============================================================================

describe('MastraMCPClient allowedHosts policy', () => {
  const datadogTracerTestSymbol = Symbol.for('mastra.mcp.dd-trace-test-tracer');
  let client: InternalMastraMCPClient | undefined;
  const cleanups: Array<() => Promise<void>> = [];

  const track = <T extends TestMcpServer>(server: T): T => {
    cleanups.push(server.close);
    return server;
  };

  afterEach(async () => {
    await client?.disconnect().catch(() => {});
    client = undefined;
    while (cleanups.length) {
      await cleanups.pop()!().catch(() => {});
    }
    delete (globalThis as Record<PropertyKey, unknown>)[datadogTracerTestSymbol];
    vi.restoreAllMocks();
  });

  it('connects and calls tools when the host (with its explicit port) is allowlisted', async () => {
    const server = track(await startStreamableServer());
    client = new InternalMastraMCPClient({
      name: 'allowed-host-test',
      server: { url: server.baseUrl, allowedHosts: [server.host] },
    });
    await client.connect();
    const tools = await client.tools();
    const result = await tools['greet']!.execute({ name: 'Policy' });
    expect(JSON.stringify(result)).toContain('Hello, Policy!');
  }, 15000);

  it('rejects a disallowed host at connect time without dispatching any request', async () => {
    const decoy = track(await startDecoyServer());
    const fetchSpy = vi.fn((url: string | URL, init?: RequestInit) => fetch(url, init));
    client = new InternalMastraMCPClient({
      name: 'disallowed-host-test',
      server: { url: decoy.baseUrl, allowedHosts: ['allowed.example'], fetch: fetchSpy },
    });
    await expect(client.connect()).rejects.toThrow(/allowedHosts/);
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(decoy.requests).toHaveLength(0);
  }, 15000);

  it('denies everything with an empty allowlist', async () => {
    const server = track(await startStreamableServer());
    client = new InternalMastraMCPClient({
      name: 'empty-allowlist-test',
      server: { url: server.baseUrl, allowedHosts: [] },
    });
    await expect(client.connect()).rejects.toThrow(/allowedHosts/);
    expect(server.requests).toHaveLength(0);
  }, 15000);

  it('leaves the default path untouched when allowedHosts is unset', async () => {
    const server = track(await startStreamableServer());
    const fetchSpy = vi.fn((url: string | URL, init?: RequestInit) => fetch(url, init));
    client = new InternalMastraMCPClient({
      name: 'default-path-test',
      server: { url: server.baseUrl, fetch: fetchSpy },
    });
    await client.connect();
    await client.tools();
    expect(fetchSpy.mock.calls.length).toBeGreaterThan(0);
    // No forced redirect mode leaks into the default path.
    for (const [, init] of fetchSpy.mock.calls) {
      expect(init?.redirect).toBeUndefined();
    }
  }, 15000);

  it('blocks a mid-connection redirect to a disallowed host before it is sent and does not reconnect-retry', async () => {
    const decoy = track(await startDecoyServer());
    let redirectServed = 0;
    let redirecting = false;
    const server = track(
      await startStreamableServer((req, res) => {
        if (redirecting && req.method === 'POST') {
          redirectServed += 1;
          res.writeHead(302, { location: `http://${decoy.host}/mcp` }).end();
          return true;
        }
        return false;
      }),
    );

    client = new InternalMastraMCPClient({
      name: 'mid-stream-redirect-test',
      server: { url: server.baseUrl, allowedHosts: [server.host] },
    });
    await client.connect();
    const tools = await client.tools();

    redirecting = true;
    await expect(tools['greet']!.execute({ name: 'X' })).rejects.toThrow(/allowedHosts/);

    // The blocked host never saw a request, and the policy error was not fed
    // into the reconnect machinery (a retry would have served a second redirect).
    expect(decoy.requests).toHaveLength(0);
    expect(redirectServed).toBe(1);
  }, 15000);

  it('keeps the Datadog span-detach behavior for persistent GET streams with the policy on', async () => {
    const server = track(await startStatefulStreamableServer());
    const globalFetchSpy = vi.spyOn(globalThis, 'fetch');
    const activateSpy = vi.fn((_span: unknown, callback: () => unknown) => callback());
    (globalThis as Record<PropertyKey, unknown>)[datadogTracerTestSymbol] = {
      scope: () => ({ activate: activateSpy }),
    };

    client = new InternalMastraMCPClient({
      name: 'datadog-policy-test',
      server: { url: server.baseUrl, allowedHosts: [server.host] },
    });
    await client.connect();

    const getCalls = globalFetchSpy.mock.calls.filter(
      ([, init]) => ((init?.method as string | undefined) ?? 'GET').toUpperCase() === 'GET',
    );
    expect(getCalls.length).toBeGreaterThan(0);
    expect(activateSpy).toHaveBeenCalledTimes(getCalls.length);
    expect(activateSpy).toHaveBeenNthCalledWith(1, null, expect.any(Function));
    // The policy path dispatches with manual redirect handling.
    expect(globalFetchSpy.mock.calls.every(([, init]) => init?.redirect === 'manual')).toBe(true);

    activateSpy.mockClear();
    globalFetchSpy.mockClear();
    await client.tools();
    const postCalls = globalFetchSpy.mock.calls.filter(
      ([, init]) => ((init?.method as string | undefined) ?? 'GET').toUpperCase() === 'POST',
    );
    expect(postCalls.length).toBeGreaterThan(0);
    expect(activateSpy).not.toHaveBeenCalled();
  }, 15000);

  it('validates a custom fetch post-hoc when it auto-follows a redirect to a disallowed host', async () => {
    const decoy = track(await startDecoyServer());
    const server = track(
      await startStreamableServer((req, res) => {
        if (req.method === 'POST') {
          res.writeHead(302, { location: `http://${decoy.host}/mcp` }).end();
        } else {
          // Fail the SSE fallback's GET stream fast instead of leaving it open.
          res.writeHead(404).end();
        }
        return true;
      }),
    );

    // A pass-through custom fetch auto-follows redirects (platform default).
    const userFetch = vi.fn((url: string | URL, init?: RequestInit) => fetch(url, init));
    client = new InternalMastraMCPClient({
      name: 'posthoc-test',
      server: { url: server.baseUrl, allowedHosts: [server.host], fetch: userFetch },
    });

    // The policy error surfaces directly (no SSE-fallback burial into a
    // generic "could not connect" message) …
    await expect(client.connect()).rejects.toThrow(/allowedHosts/);
    expect(userFetch.mock.calls.length).toBeGreaterThan(0);
    // … and post-hoc semantics: the outbound hop DID reach the disallowed host
    // (documented limitation of the custom-fetch path) — exactly once, because
    // a policy violation must not trigger a second connect attempt over SSE.
    expect(decoy.requests.length).toBe(1);
  }, 15000);

  it('wraps a caller-supplied eventSourceInit.fetch (SSE stream) with the policy', async () => {
    const sse = track(await startSseServer());
    const sseFetchSpy = vi.fn((url: string | URL, init?: RequestInit) => fetch(url, init));
    client = new InternalMastraMCPClient({
      name: 'sse-wrap-positive-test',
      server: {
        url: sse.baseUrl,
        allowedHosts: [sse.host],
        eventSourceInit: { fetch: sseFetchSpy as any },
      },
    });
    await client.connect();
    // The caller's fetch was used for the SSE stream (wrapping preserves it).
    expect(sseFetchSpy.mock.calls.length).toBeGreaterThan(0);
    const tools = await client.tools();
    expect(tools['greet']).toBeDefined();
  }, 15000);

  it('blocks the SSE stream post-hoc when eventSourceInit.fetch lands on a disallowed host', async () => {
    const decoy = track(await startDecoyServer());
    const sse = track(await startSseServer());
    // A caller fetch that (like a redirect-following or rewriting proxy) ends up
    // on a different host than requested.
    const sseFetchSpy = vi.fn((_url: string | URL, init?: RequestInit) => fetch(decoy.baseUrl, init));
    client = new InternalMastraMCPClient({
      name: 'sse-wrap-negative-test',
      server: {
        url: sse.baseUrl,
        allowedHosts: [sse.host],
        eventSourceInit: { fetch: sseFetchSpy as any },
      },
    });
    // The policy error surfaces directly instead of the generic connect error.
    const thrown = await client.connect().then(
      () => undefined,
      (e: unknown) => e,
    );
    expect(thrown).toBeInstanceOf(Error);
    expect((thrown as Error).message).toMatch(/allowedHosts/);
    // The error that crossed the eventsource boundary (flattened to a message
    // string and re-wrapped as SseError) must STILL be non-reconnectable, or
    // the reconnect machinery would retry the blocked host.
    expect(isReconnectableMCPError(thrown)).toBe(false);
    // Pre-request check passed (requested URL was allowed), the fetch ran …
    expect(sseFetchSpy.mock.calls.length).toBeGreaterThan(0);
    // … exactly one outbound hop reached the decoy: no retry, no reconnect.
    expect(decoy.requests.length).toBe(1);
  }, 15000);
});

// =============================================================================
// OAuth discovery + allowedHosts
//
// Observed branch (SDK 1.29.0): the transports route auth() through
// _fetchWithInit, built from the transport's `fetch` option — OAuth discovery
// goes THROUGH the policy-wrapped fetch. These tests pin that observation:
// a change in SDK routing flips them visibly.
// =============================================================================

describe('allowedHosts and OAuth discovery', () => {
  let client: InternalMastraMCPClient | undefined;
  const cleanups: Array<() => Promise<void>> = [];

  afterEach(async () => {
    await client?.disconnect().catch(() => {});
    client = undefined;
    while (cleanups.length) {
      await cleanups.pop()!().catch(() => {});
    }
  });

  /** Minimal fake authorization server: metadata + dynamic registration. */
  async function startAuthServer() {
    const requests: string[] = [];
    const httpServer = createServer((req, res) => {
      requests.push(req.url ?? '');
      const requestUrl = new URL(req.url ?? '', 'http://127.0.0.1');
      const base = `http://127.0.0.1:${(httpServer.address() as AddressInfo).port}`;
      if (requestUrl.pathname === '/.well-known/oauth-authorization-server') {
        res.writeHead(200, { 'content-type': 'application/json' }).end(
          JSON.stringify({
            issuer: base,
            authorization_endpoint: `${base}/authorize`,
            token_endpoint: `${base}/token`,
            registration_endpoint: `${base}/register`,
            response_types_supported: ['code'],
            grant_types_supported: ['authorization_code'],
            code_challenge_methods_supported: ['S256'],
            token_endpoint_auth_methods_supported: ['none'],
          }),
        );
        return;
      }
      if (requestUrl.pathname === '/register' && req.method === 'POST') {
        let body = '';
        req.on('data', chunk => (body += chunk));
        req.on('end', () => {
          const metadata = JSON.parse(body);
          res.writeHead(201, { 'content-type': 'application/json' }).end(
            JSON.stringify({ ...metadata, client_id: `client-${randomUUID()}`, token_endpoint_auth_method: 'none' }),
          );
        });
        return;
      }
      res.writeHead(404).end();
    });
    const baseUrl = await listen(httpServer, '/');
    const close = () => closeServer(httpServer);
    cleanups.push(close);
    return { host: baseUrl.host, url: `http://${baseUrl.host}`, requests };
  }

  /** Protected MCP server: 401s everything, advertises the auth server via RFC 9728 metadata. */
  async function startProtectedServer(authServerUrl: string) {
    const requests: string[] = [];
    const httpServer = createServer((req, res) => {
      requests.push(req.url ?? '');
      const requestUrl = new URL(req.url ?? '', 'http://127.0.0.1');
      const base = `http://127.0.0.1:${(httpServer.address() as AddressInfo).port}`;
      if (requestUrl.pathname === '/.well-known/oauth-protected-resource') {
        res.writeHead(200, { 'content-type': 'application/json' }).end(
          JSON.stringify({
            resource: `${base}/mcp`,
            authorization_servers: [authServerUrl],
            bearer_methods_supported: ['header'],
          }),
        );
        return;
      }
      res
        .writeHead(401, {
          'www-authenticate': `Bearer resource_metadata="${base}/.well-known/oauth-protected-resource"`,
        })
        .end();
    });
    const baseUrl = await listen(httpServer, '/mcp');
    const close = () => closeServer(httpServer);
    cleanups.push(close);
    return { host: baseUrl.host, baseUrl, requests };
  }

  function createProvider(authorizationUrls: URL[]) {
    return new MCPOAuthClientProvider({
      redirectUrl: 'http://127.0.0.1:39999/oauth/callback',
      clientMetadata: {
        redirect_uris: ['http://127.0.0.1:39999/oauth/callback'],
        client_name: 'URL Policy Test Client',
        grant_types: ['authorization_code'],
        response_types: ['code'],
        token_endpoint_auth_method: 'none',
      },
      storage: new InMemoryOAuthStorage(),
      onRedirectToAuthorization: url => void authorizationUrls.push(url),
    });
  }

  it('blocks OAuth discovery when the authorization server host is not allowlisted', async () => {
    const authServer = await startAuthServer();
    const mcpServer = await startProtectedServer(authServer.url);
    const authorizationUrls: URL[] = [];

    client = new InternalMastraMCPClient({
      name: 'oauth-blocked-test',
      server: {
        url: mcpServer.baseUrl,
        authProvider: createProvider(authorizationUrls),
        allowedHosts: [mcpServer.host], // auth server host deliberately absent
      },
    });

    await expect(client.connect()).rejects.toThrow();
    // Discovery went through the policy-wrapped fetch: the MCP host was reached,
    // the auth server was never contacted, and no authorization redirect happened.
    expect(mcpServer.requests.length).toBeGreaterThan(0);
    expect(authServer.requests).toHaveLength(0);
    expect(authorizationUrls).toHaveLength(0);
  }, 15000);

  it('lets the OAuth flow proceed when the authorization server host is allowlisted', async () => {
    const authServer = await startAuthServer();
    const mcpServer = await startProtectedServer(authServer.url);
    const authorizationUrls: URL[] = [];

    client = new InternalMastraMCPClient({
      name: 'oauth-allowed-test',
      server: {
        url: mcpServer.baseUrl,
        authProvider: createProvider(authorizationUrls),
        allowedHosts: [mcpServer.host, authServer.host],
      },
    });

    // Connect still rejects (interactive authorization is required), but the
    // flow reached the authorization redirect through the allowlisted hosts.
    await expect(client.connect()).rejects.toThrow();
    expect(authServer.requests.length).toBeGreaterThan(0);
    expect(authorizationUrls).toHaveLength(1);
  }, 15000);
});
