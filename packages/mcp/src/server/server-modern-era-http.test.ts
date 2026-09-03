import http from 'node:http';
import { createTool } from '@mastra/core/tools';
import {
  Client,
  LOG_LEVEL_META_KEY,
  SdkError,
  SdkErrorCode,
  StreamableHTTPClientTransport,
} from '@modelcontextprotocol/client';
import type { AuthInfo } from '@modelcontextprotocol/server';
import getPort from 'get-port';
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { z } from 'zod/v3';
import { InternalMastraMCPClient } from '../client/client';
import { MCPServer } from './server';

vi.setConfig({ testTimeout: 20000, hookTimeout: 20000 });

const listenOnFreePort = async (server: http.Server): Promise<number> => {
  const port = await getPort();
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, () => resolve());
  });
  return port;
};

const makeTools = () => ({
  echoTool: createTool({
    id: 'echoTool',
    description: 'Echoes the input back',
    inputSchema: z.object({ text: z.string() }),
    execute: async inputData => `echo: ${inputData.text}`,
  }),
  loggingTool: createTool({
    id: 'loggingTool',
    description: 'Emits a log message during execution',
    inputSchema: z.object({}),
    execute: async (_inputData, options) => {
      await options?.mcp?.log?.('info', 'log from loggingTool');
      return 'logged';
    },
  }),
  authTool: createTool({
    id: 'authTool',
    description: 'Returns the authenticated client ID',
    inputSchema: z.object({}),
    execute: async (_inputData, options) => options?.mcp?.extra?.authInfo?.clientId ?? 'missing',
  }),
  traceContextTool: createTool({
    id: 'traceContextTool',
    description: 'Returns request trace metadata and authenticated client ID',
    inputSchema: z.object({}),
    execute: async (_inputData, options) => {
      const meta = options?.mcp?.extra?._meta;
      return JSON.stringify({
        traceparent: meta?.traceparent,
        tracestate: meta?.tracestate,
        baggage: meta?.baggage,
        clientId: options?.mcp?.extra?.authInfo?.clientId,
      });
    },
  }),
  nullTool: createTool({
    id: 'nullTool',
    description: 'Returns a null structured result',
    inputSchema: z.object({}),
    outputSchema: z.null(),
    execute: async () => null,
  }),
});

const authInfo: AuthInfo = {
  token: 'modern-era-test-token',
  clientId: 'modern-era-test-client',
  scopes: ['tools:call'],
};

type StartHTTPTransportOptions = NonNullable<Parameters<MCPServer['startHTTP']>[0]['options']>;

const requestServerWithOptions = async ({
  options,
  headers,
  modernEra,
}: {
  options: StartHTTPTransportOptions;
  headers?: Record<string, string>;
  modernEra?: boolean;
}): Promise<{ statusCode: number; body: string; startError?: unknown }> => {
  const server = new MCPServer({
    name: 'HTTP Option Test Server',
    version: '1.0.0',
    ...(modernEra === undefined
      ? {}
      : { protocolVersion: modernEra ? ('2026-07-28' as const) : ('2025-11-25' as const) }),
    tools: makeTools(),
  });
  let startError: unknown;
  const httpServer = http.createServer(async (req, res) => {
    try {
      await server.startHTTP({
        url: new URL(req.url || '', 'http://localhost'),
        httpPath: '/mcp',
        req,
        res,
        options,
      });
    } catch (error) {
      startError = error;
      res.writeHead(500, { 'Content-Type': 'text/plain' });
      res.end('Failed to start MCP request');
    }
  });
  const port = await listenOnFreePort(httpServer);

  try {
    const response = await new Promise<{ statusCode: number; body: string }>((resolve, reject) => {
      const request = http.request(
        {
          hostname: 'localhost',
          port,
          path: '/mcp',
          headers,
        },
        response => {
          const chunks: Buffer[] = [];
          response.on('data', chunk => chunks.push(Buffer.from(chunk)));
          response.on('end', () => {
            resolve({ statusCode: response.statusCode ?? 0, body: Buffer.concat(chunks).toString('utf8') });
          });
        },
      );
      request.on('error', reject);
      request.end();
    });
    return { ...response, startError };
  } finally {
    await server.close();
    await new Promise<void>(resolve => httpServer.close(() => resolve()));
  }
};

describe('MCPServer with protocolVersion 2026-07-28 (dual-era HTTP)', () => {
  let server: MCPServer;
  let httpServer: http.Server;
  let baseUrl: URL;

  beforeAll(async () => {
    server = new MCPServer({
      name: 'Modern Test Server',
      version: '1.0.0',
      protocolVersion: '2026-07-28',
      cacheHints: { 'tools/list': { ttlMs: 60_000, cacheScope: 'private' } },
      tools: makeTools(),
      resources: {
        listResources: async () => [{ uri: 'test://resource', name: 'Test resource' }],
        getResourceContent: async () => ({ text: 'resource content' }),
      },
    });
    httpServer = http.createServer(async (req, res) => {
      (req as typeof req & { auth: AuthInfo }).auth = authInfo;
      await server.startHTTP({
        url: new URL(req.url || '', 'http://localhost'),
        httpPath: '/mcp',
        req,
        res,
        options: {
          serverless: true,
          serverlessStreaming: true,
          sessionIdGenerator: undefined,
        },
      });
    });
    const port = await listenOnFreePort(httpServer);
    baseUrl = new URL(`http://localhost:${port}/mcp`);
  });

  afterAll(async () => {
    await server?.close();
    await new Promise<void>(resolve => httpServer.close(() => resolve()));
  });

  it('accepts stateless transport declarations and serves a client pinned to 2026-07-28', async () => {
    const client = new Client(
      { name: 'pinned-client', version: '1.0.0' },
      { versionNegotiation: { mode: { pin: '2026-07-28' } } },
    );
    await client.connect(new StreamableHTTPClientTransport(baseUrl));
    try {
      const tools = await client.listTools();
      expect(tools.tools.map(t => t.name)).toContain('echoTool');

      const result = await client.callTool({ name: 'echoTool', arguments: { text: 'hi' } });
      expect((result as any).content[0].text).toBe('echo: hi');
    } finally {
      await client.close();
    }
  });

  it('preserves null structuredContent as a valid modern tool result', async () => {
    const client = new Client(
      { name: 'null-result-client', version: '1.0.0' },
      { versionNegotiation: { mode: { pin: '2026-07-28' } } },
    );
    await client.connect(new StreamableHTTPClientTransport(baseUrl));
    try {
      const tools = await client.listTools();
      expect(tools.tools.find(tool => tool.name === 'nullTool')?.outputSchema?.$schema).toBe(
        'http://json-schema.org/draft-07/schema#',
      );
      const result = await client.callTool({ name: 'nullTool', arguments: {} });

      expect(result.isError).not.toBe(true);
      expect(result.structuredContent).toBeNull();
      expect(result.content).toEqual([{ type: 'text', text: 'null' }]);
    } finally {
      await client.close();
    }
  });

  it('keeps W3C trace metadata request-scoped without using baggage for authorization', async () => {
    const client = new Client(
      { name: 'trace-context-http-client', version: '1.0.0' },
      { versionNegotiation: { mode: { pin: '2026-07-28' } } },
    );
    await client.connect(new StreamableHTTPClientTransport(baseUrl));
    const readTrace = async (_meta?: Record<string, unknown>) => {
      const result = (await client.callTool({ name: 'traceContextTool', arguments: {}, _meta })) as {
        content: Array<{ text?: string }>;
      };
      return JSON.parse(result.content[0]?.text ?? '{}');
    };

    try {
      await expect(
        readTrace({
          traceparent: '00-11111111111111111111111111111111-1111111111111111-01',
          tracestate: 'vendor=first',
          baggage: 'clientId=attacker,tenant=one',
        }),
      ).resolves.toEqual({
        traceparent: '00-11111111111111111111111111111111-1111111111111111-01',
        tracestate: 'vendor=first',
        baggage: 'clientId=attacker,tenant=one',
        clientId: authInfo.clientId,
      });
      await expect(
        readTrace({ traceparent: '00-22222222222222222222222222222222-2222222222222222-01' }),
      ).resolves.toEqual({
        traceparent: '00-22222222222222222222222222222222-2222222222222222-01',
        clientId: authInfo.clientId,
      });
      await expect(readTrace()).resolves.toEqual({ clientId: authInfo.clientId });
    } finally {
      await client.close();
    }
  });

  it('exposes malformed and oversized W3C values opaquely without crashing tool execution', async () => {
    const client = new Client(
      { name: 'trace-context-invalid-http-client', version: '1.0.0' },
      { versionNegotiation: { mode: { pin: '2026-07-28' } } },
    );
    await client.connect(new StreamableHTTPClientTransport(baseUrl));
    const baggage = `value=${'x'.repeat(9000)}`;
    try {
      const result = (await client.callTool({
        name: 'traceContextTool',
        arguments: {},
        _meta: { traceparent: 'not-a-traceparent', baggage },
      })) as { content: Array<{ text?: string }> };
      expect(JSON.parse(result.content[0]?.text ?? '{}')).toEqual({
        traceparent: 'not-a-traceparent',
        baggage,
        clientId: authInfo.clientId,
      });
    } finally {
      await client.close();
    }
  });

  it('forwards Node request auth to modern-era tool execution', async () => {
    const client = new Client(
      { name: 'auth-client', version: '1.0.0' },
      { versionNegotiation: { mode: { pin: '2026-07-28' } } },
    );
    await client.connect(new StreamableHTTPClientTransport(baseUrl));
    try {
      const result = await client.callTool({ name: 'authTool', arguments: {} });
      expect((result as { content: Array<{ text?: string }> }).content[0]?.text).toBe(authInfo.clientId);
    } finally {
      await client.close();
    }
  });

  it('advertises configured cacheHints (ttlMs) on tools/list for modern clients', async () => {
    const client = new Client(
      { name: 'cache-client', version: '1.0.0' },
      { versionNegotiation: { mode: { pin: '2026-07-28' } } },
    );
    await client.connect(new StreamableHTTPClientTransport(baseUrl));
    try {
      const tools = await client.listTools();
      expect((tools as any).ttlMs).toBe(60_000);
      expect((tools as any).cacheScope).toBe('private');
    } finally {
      await client.close();
    }
  });

  it('serves a legacy (default-mode) client from the same endpoint via the stateless fallback', async () => {
    const client = new Client({ name: 'legacy-client', version: '1.0.0' }, {});
    await client.connect(new StreamableHTTPClientTransport(baseUrl));
    try {
      const tools = await client.listTools();
      expect(tools.tools.map(t => t.name)).toContain('echoTool');
      expect(tools.tools.find(tool => tool.name === 'nullTool')?.outputSchema?.$schema).toBeUndefined();

      const result = await client.callTool({ name: 'echoTool', arguments: { text: 'legacy' } });
      expect((result as any).content[0].text).toBe('echo: legacy');
    } finally {
      await client.close();
    }
  });

  it('negotiates the modern era with a Mastra client configured with protocolVersion auto', async () => {
    const client = new InternalMastraMCPClient({
      name: 'auto-client',
      server: {
        url: baseUrl,
        protocolVersion: 'auto',
      },
    });
    await client.connect();
    try {
      const tools = await client.tools();
      expect(Object.keys(tools)).toContain('echoTool');
      const sdkClient = (client as unknown as { client: Client }).client;
      expect(sdkClient.getDiscoverResult()).toBeDefined();
    } finally {
      await client.disconnect();
    }
  });

  it('manages modern resource subscriptions through one replaceable listen stream', async () => {
    const wireMethods: string[] = [];
    const client = new InternalMastraMCPClient({
      name: 'mastra-resource-listen-client',
      server: {
        url: baseUrl,
        protocolVersion: '2026-07-28',
        fetch: async (url, init) => {
          if (typeof init?.body === 'string') {
            const message = JSON.parse(init.body) as { method?: string };
            if (message.method) wireMethods.push(message.method);
          }
          return fetch(url, init);
        },
      },
    });
    const updated = new Promise<string>(resolve => {
      client.setResourceUpdatedNotificationHandler(params => resolve(params.uri));
    });

    await client.connect();
    try {
      await client.subscribeResource('test://resource');
      await client.subscribeResource('test://resource');
      expect(wireMethods.filter(method => method === 'subscriptions/listen')).toHaveLength(1);

      await client.subscribeResource('test://second');
      await client.unsubscribeResource('test://resource');
      await client.forceReconnect();
      await server.resources.notifyUpdated({ uri: 'test://second' });
      await expect(updated).resolves.toBe('test://second');

      await client.unsubscribeResource('test://second');
      await client.subscribeResource('test://second');
    } finally {
      await client.disconnect();
    }

    expect(wireMethods.filter(method => method === 'subscriptions/listen')).toHaveLength(5);
    expect(wireMethods.filter(method => method === 'notifications/cancelled')).toHaveLength(5);
    expect(wireMethods).not.toContain('resources/subscribe');
    expect(wireMethods).not.toContain('resources/unsubscribe');
  });

  it('serializes concurrent subscription mutations and replays only the final filter after reconnect', async () => {
    const wireMethods: string[] = [];
    const client = new InternalMastraMCPClient({
      name: 'concurrent-resource-listen-client',
      server: {
        url: baseUrl,
        protocolVersion: '2026-07-28',
        fetch: async (url, init) => {
          if (typeof init?.body === 'string') {
            const message = JSON.parse(init.body) as { method?: string };
            if (message.method) wireMethods.push(message.method);
          }
          return fetch(url, init);
        },
      },
    });
    const uris = Array.from({ length: 12 }, (_, index) => `test://concurrent/${index}`);
    const retainedUris = uris.filter((_, index) => index % 2 === 1);
    const removedUris = uris.filter((_, index) => index % 2 === 0);
    const updatedUris: string[] = [];
    client.setResourceUpdatedNotificationHandler(params => updatedUris.push(params.uri));

    await client.connect();
    try {
      await Promise.all(uris.map(uri => client.subscribeResource(uri)));
      await Promise.all(removedUris.map(uri => client.unsubscribeResource(uri)));
      await client.forceReconnect();

      await server.resources.notifyUpdated({ uri: removedUris[0]! });
      await new Promise(resolve => setTimeout(resolve, 100));
      expect(updatedUris).not.toContain(removedUris[0]);

      await server.resources.notifyUpdated({ uri: retainedUris[0]! });
      await vi.waitFor(() => expect(updatedUris).toContain(retainedUris[0]));
    } finally {
      await client.disconnect();
    }

    const listenCount = wireMethods.filter(method => method === 'subscriptions/listen').length;
    expect(listenCount).toBeGreaterThan(0);
    expect(wireMethods.filter(method => method === 'notifications/cancelled')).toHaveLength(listenCount);
    expect(wireMethods).not.toContain('resources/subscribe');
    expect(wireMethods).not.toContain('resources/unsubscribe');
  });

  it('keeps the connection usable when restoring resource subscriptions fails', async () => {
    const client = new InternalMastraMCPClient({
      name: 'resource-listen-restore-failure-client',
      server: {
        url: baseUrl,
        protocolVersion: '2026-07-28',
      },
    });

    const updated = new Promise<string>(resolve => {
      client.setResourceUpdatedNotificationHandler(params => resolve(params.uri));
    });
    await client.connect();
    await client.subscribeResource('test://resource');
    const sdkClient = (client as unknown as { client: Client }).client;
    const listenSpy = vi.spyOn(sdkClient, 'listen').mockRejectedValueOnce(new Error('listen restore failed'));

    try {
      await expect(client.forceReconnect()).resolves.toBeUndefined();
      expect(sdkClient.transport).toBeDefined();
      expect(Object.keys(await client.tools())).toContain('echoTool');

      await client.subscribeResource('test://resource');
      expect(listenSpy).toHaveBeenCalledTimes(2);
      await server.resources.notifyUpdated({ uri: 'test://resource' });
      await expect(updated).resolves.toBe('test://resource');
    } finally {
      listenSpy.mockRestore();
      await client.disconnect();
    }
  });

  it('rejects a resource subscription the server does not honor', async () => {
    const client = new InternalMastraMCPClient({
      name: 'resource-listen-declined-client',
      server: {
        url: baseUrl,
        protocolVersion: '2026-07-28',
      },
    });

    await client.connect();
    const sdkClient = (client as unknown as { client: Client }).client;
    const close = vi.fn().mockResolvedValue(undefined);
    const listenSpy = vi.spyOn(sdkClient, 'listen').mockResolvedValueOnce({
      honoredFilter: {},
      close,
      closed: new Promise(() => {}),
    });

    try {
      await expect(client.subscribeResource('test://declined')).rejects.toThrow(
        'Server declined resource subscriptions for: test://declined',
      );
      expect(close).toHaveBeenCalledOnce();
    } finally {
      listenSpy.mockRestore();
      await client.disconnect();
    }
  });

  it('does not emit removed roots notifications on the modern leg', async () => {
    const wireMethods: string[] = [];
    const client = new InternalMastraMCPClient({
      name: 'modern-roots-client',
      server: {
        url: baseUrl,
        protocolVersion: '2026-07-28',
        roots: [{ uri: 'file:///initial' }],
        fetch: async (url, init) => {
          if (typeof init?.body === 'string') {
            const message = JSON.parse(init.body) as { method?: string };
            if (message.method) wireMethods.push(message.method);
          }
          return fetch(url, init);
        },
      },
    });

    await client.connect();
    try {
      await client.setRoots([{ uri: 'file:///updated' }]);
    } finally {
      await client.disconnect();
    }

    expect(wireMethods).not.toContain('notifications/roots/list_changed');
  });

  it('delivers toolsChanged via subscriptions/listen on the modern leg', async () => {
    const client = new Client(
      { name: 'listen-client', version: '1.0.0' },
      { versionNegotiation: { mode: { pin: '2026-07-28' } } },
    );
    await client.connect(new StreamableHTTPClientTransport(baseUrl));
    const changed = new Promise<void>(resolve => {
      client.setNotificationHandler('notifications/tools/list_changed', async () => resolve());
    });
    const subscription = await client.listen({ toolsListChanged: true });
    try {
      expect(subscription.honoredFilter.toolsListChanged).toBe(true);
      await server.toolActions.add({
        dynamicTool: createTool({
          id: 'dynamicTool',
          description: 'Added at runtime',
          inputSchema: z.object({}),
          execute: async () => 'dynamic',
        }),
      });
      await expect(changed).resolves.toBeUndefined();
    } finally {
      await subscription.close();
      await client.close();
    }
  });

  it('delivers URI-filtered resource updates via subscriptions/listen on the modern leg', async () => {
    const client = new Client(
      { name: 'resource-listen-client', version: '1.0.0' },
      { versionNegotiation: { mode: { pin: '2026-07-28' } } },
    );
    await client.connect(new StreamableHTTPClientTransport(baseUrl));
    const uri = 'test://resource';
    const updated = new Promise<string>(resolve => {
      client.setNotificationHandler('notifications/resources/updated', async notification => {
        resolve(notification.params.uri);
      });
    });
    const subscription = await client.listen({ resourceSubscriptions: [uri] });
    try {
      await server.resources.notifyUpdated({ uri });
      await expect(updated).resolves.toBe(uri);
    } finally {
      await subscription.close();
      await client.close();
    }
  });

  it('delivers opted-in tool logs through the per-request modern-era log context', async () => {
    const client = new Client(
      { name: 'log-client', version: '1.0.0' },
      { versionNegotiation: { mode: { pin: '2026-07-28' } } },
    );
    await client.connect(new StreamableHTTPClientTransport(baseUrl));
    const logged = new Promise<unknown>(resolve => {
      client.setNotificationHandler('notifications/message', async notification => {
        resolve(notification.params.data);
      });
    });
    try {
      const result = await client.callTool({
        name: 'loggingTool',
        arguments: {},
        _meta: { [LOG_LEVEL_META_KEY]: 'info' },
      });
      const toolResult = result as { isError?: boolean; content: Array<{ text?: string }> };
      expect(toolResult.isError).toBeFalsy();
      expect(toolResult.content[0]?.text).toBe('logged');
      await expect(logged).resolves.toEqual({ message: 'log from loggingTool' });
    } finally {
      await client.close();
    }
  });

  it('delivers opted-in tool logs to a legacy client through the stateless fallback', async () => {
    const client = new Client({ name: 'legacy-log-client', version: '1.0.0' });
    await client.connect(new StreamableHTTPClientTransport(baseUrl));
    const logged = new Promise<unknown>(resolve => {
      client.setNotificationHandler('notifications/message', async notification => {
        resolve(notification.params.data);
      });
    });
    try {
      await client.setLoggingLevel('info');
      const result = await client.callTool({ name: 'loggingTool', arguments: {} });
      const toolResult = result as { isError?: boolean; content: Array<{ text?: string }> };
      expect(toolResult.isError).toBeFalsy();
      expect(toolResult.content[0]?.text).toBe('logged');
      await expect(logged).resolves.toEqual({ message: 'log from loggingTool' });
    } finally {
      await client.close();
    }
  });

  it('rejects session and handler-lifetime options instead of ignoring them', async () => {
    const cases: Array<[string, StartHTTPTransportOptions]> = [
      ['sessionIdGenerator', { sessionIdGenerator: () => 'session-id' }],
      ['onsessioninitialized', { onsessioninitialized: () => {} }],
      ['onsessionclosed', { onsessionclosed: () => {} }],
      [
        'eventStore',
        {
          eventStore: {
            storeEvent: async () => 'event-id',
            replayEventsAfter: async () => 'stream-id',
          },
        },
      ],
      ['enableJsonResponse', { enableJsonResponse: true }],
      ['retryInterval', { retryInterval: 1_000 }],
      ['keepAliveMs', { keepAliveMs: 1_000 }],
      ['supportedProtocolVersions', { supportedProtocolVersions: ['2026-07-28'] }],
      ['serverless', { serverless: false }],
      ['serverlessStreaming', { serverlessStreaming: false }],
    ];

    for (const [name, options] of cases) {
      const result = await requestServerWithOptions({ options });
      expect(result.statusCode).toBe(500);
      expect(result.startError).toBeInstanceOf(Error);
      expect((result.startError as Error).message).toContain(`startHTTP options \"${name}\" are incompatible`);
      expect(result.body).toBe('Failed to start MCP request');
    }
  });

  it('preserves DNS rebinding protection on the modern HTTP path', async () => {
    const blockedHost = await requestServerWithOptions({
      options: {
        enableDnsRebindingProtection: true,
        allowedHosts: ['allowed.example'],
      },
      headers: { Host: 'blocked.example' },
    });
    expect(blockedHost.statusCode).toBe(403);
    expect(blockedHost.body).toContain('Invalid Host: blocked.example');

    const blockedOrigin = await requestServerWithOptions({
      options: {
        enableDnsRebindingProtection: true,
        allowedOrigins: ['https://allowed.example'],
      },
      headers: { Origin: 'https://blocked.example' },
    });
    expect(blockedOrigin.statusCode).toBe(403);
    expect(blockedOrigin.body).toContain('Invalid Origin: blocked.example');

    const allowedHostAndOrigin = await requestServerWithOptions({
      options: {
        enableDnsRebindingProtection: true,
        allowedHosts: ['allowed.example'],
        allowedOrigins: ['https://allowed.example'],
      },
      headers: { Host: 'allowed.example', Origin: 'https://allowed.example' },
    });
    expect(allowedHostAndOrigin.statusCode).not.toBe(403);
    expect(allowedHostAndOrigin.startError).toBeUndefined();

    const missingOrigin = await requestServerWithOptions({
      options: {
        enableDnsRebindingProtection: true,
        allowedOrigins: ['https://allowed.example'],
      },
    });
    expect(missingOrigin.statusCode).not.toBe(403);
    expect(missingOrigin.startError).toBeUndefined();
  });
});

describe('MCPServer without protocolVersion (modern default)', () => {
  it('rejects legacy session options', async () => {
    const response = await requestServerWithOptions({
      options: { sessionIdGenerator: () => 'legacy-session' },
    });

    expect(response.startError).toBeInstanceOf(Error);
    expect((response.startError as Error).message).toMatch(/sessionIdGenerator/);
  });

  it('still serves an old 2025 client through the stateless fallback', async () => {
    const server = new MCPServer({
      name: 'Default Modern Test Server',
      version: '1.0.0',
      tools: makeTools(),
    });
    const httpServer = http.createServer(async (req, res) => {
      await server.startHTTP({
        url: new URL(req.url || '', 'http://localhost'),
        httpPath: '/mcp',
        req,
        res,
      });
    });
    const port = await listenOnFreePort(httpServer);
    const client = new Client({ name: 'old-client', version: '1.0.0' }, { versionNegotiation: { mode: 'legacy' } });
    const transport = new StreamableHTTPClientTransport(new URL(`http://localhost:${port}/mcp`));

    try {
      await client.connect(transport);
      const tools = await client.listTools();
      expect(tools.tools.map(tool => tool.name)).toContain('echoTool');
      expect(transport.sessionId).toBeUndefined();
    } finally {
      await client.close().catch(() => {});
      await server.close();
      await new Promise<void>(resolve => httpServer.close(() => resolve()));
    }
  });
});

describe("MCPServer with explicit protocolVersion '2025-11-25'", () => {
  let server: MCPServer;
  let httpServer: http.Server;
  let baseUrl: URL;

  beforeAll(async () => {
    server = new MCPServer({
      name: 'Legacy Test Server',
      version: '1.0.0',
      protocolVersion: '2025-11-25',
      tools: makeTools(),
    });
    httpServer = http.createServer(async (req, res) => {
      await server.startHTTP({
        url: new URL(req.url || '', 'http://localhost'),
        httpPath: '/mcp',
        req,
        res,
      });
    });
    const port = await listenOnFreePort(httpServer);
    baseUrl = new URL(`http://localhost:${port}/mcp`);
  });

  afterAll(async () => {
    await server?.close();
    await new Promise<void>(resolve => httpServer.close(() => resolve()));
  });

  it('keeps serving legacy sessionful clients unchanged', async () => {
    const client = new Client({ name: 'legacy-client', version: '1.0.0' }, {});
    const transport = new StreamableHTTPClientTransport(baseUrl);
    await client.connect(transport);
    try {
      // Sessionful behavior: the server assigned a session ID during initialize.
      expect(transport.sessionId).toBeDefined();
      const tools = await client.listTools();
      expect(tools.tools.map(t => t.name)).toContain('echoTool');
    } finally {
      await client.close();
    }
  });

  it('applies DNS rebinding protection before legacy transport dispatch', async () => {
    const blockedHost = await requestServerWithOptions({
      modernEra: false,
      options: {
        serverless: true,
        enableDnsRebindingProtection: true,
        allowedHosts: ['allowed.example'],
      },
      headers: { Host: 'blocked.example' },
    });

    expect(blockedHost.statusCode).toBe(403);
    expect(blockedHost.body).toContain('Invalid Host: blocked.example');
  });

  it('fails loudly when a client pinned to 2026-07-28 connects to a legacy-only server', async () => {
    const client = new InternalMastraMCPClient({
      name: 'pinned-client',
      server: {
        url: baseUrl,
        protocolVersion: '2026-07-28',
      },
    });
    const error = await client.connect().then(
      () => undefined,
      error => error,
    );
    expect(error).toBeInstanceOf(SdkError);
    expect((error as SdkError).code).toBe(SdkErrorCode.EraNegotiationFailed);
    await client.disconnect().catch(() => {});
  });
});

describe('MCPServer default-modern elicitation (multi-round-trip)', () => {
  let server: MCPServer;
  let httpServer: http.Server;
  let baseUrl: URL;
  const executions = { ask: 0, twoStep: 0 };

  beforeAll(async () => {
    server = new MCPServer({
      name: 'MRTR Elicitation Server',
      version: '1.0.0',
      tools: {
        askTool: createTool({
          id: 'askTool',
          description: 'Asks the user for their favorite color',
          inputSchema: z.object({}),
          execute: async (_inputData, options) => {
            executions.ask += 1;
            const result = await options!.mcp!.elicitation.sendRequest({
              message: 'What is your favorite color?',
              requestedSchema: {
                type: 'object',
                properties: { color: { type: 'string' } },
                required: ['color'],
              },
            });
            if (result.action !== 'accept') return 'declined';
            return `color: ${(result.content as { color: string }).color}`;
          },
        }),
        twoStepTool: createTool({
          id: 'twoStepTool',
          description: 'Asks the user two sequential questions',
          inputSchema: z.object({}),
          execute: async (_inputData, options) => {
            executions.twoStep += 1;
            const sendRequest = options!.mcp!.elicitation.sendRequest;
            const first = await sendRequest({
              message: 'first',
              requestedSchema: { type: 'object', properties: { answer: { type: 'string' } }, required: ['answer'] },
            });
            const second = await sendRequest({
              message: 'second',
              requestedSchema: { type: 'object', properties: { answer: { type: 'string' } }, required: ['answer'] },
            });
            const a = (first.content as { answer: string }).answer;
            const b = (second.content as { answer: string }).answer;
            return `${a}+${b}`;
          },
        }),
      },
    });
    httpServer = http.createServer(async (req, res) => {
      await server.startHTTP({
        url: new URL(req.url || '', 'http://localhost'),
        httpPath: '/mcp',
        req,
        res,
      });
    });
    const port = await listenOnFreePort(httpServer);
    baseUrl = new URL(`http://localhost:${port}/mcp`);
  });

  afterAll(async () => {
    await server?.close();
    await new Promise<void>(resolve => httpServer.close(() => resolve()));
  });

  const makeModernElicitingClient = (answers: Record<string, string>) => {
    const client = new Client(
      { name: 'elicit-client', version: '1.0.0' },
      {
        capabilities: { elicitation: { form: {} } },
        versionNegotiation: { mode: { pin: '2026-07-28' } },
      },
    );
    client.setRequestHandler('elicitation/create', async request => {
      const key = request.params.message;
      const answer = answers[key];
      if (answer === undefined) return { action: 'decline' as const };
      const field = 'color' in ((request.params as any).requestedSchema?.properties ?? {}) ? 'color' : 'answer';
      return { action: 'accept' as const, content: { [field]: answer } };
    });
    return client;
  };

  it('completes a tool that elicits: the client answers and retries transparently', async () => {
    executions.ask = 0;
    const client = makeModernElicitingClient({ 'What is your favorite color?': 'blue' });
    await client.connect(new StreamableHTTPClientTransport(baseUrl));
    try {
      const result = await client.callTool({ name: 'askTool', arguments: {} });
      expect((result as any).isError).toBeFalsy();
      expect((result as any).content[0].text).toBe('color: blue');
      // Round 1 interrupts, round 2 replays with the answer.
      expect(executions.ask).toBe(2);
    } finally {
      await client.close();
    }
  });

  it('supports sequential elicitations across rounds via requestState accumulation', async () => {
    executions.twoStep = 0;
    const client = makeModernElicitingClient({ first: 'one', second: 'two' });
    await client.connect(new StreamableHTTPClientTransport(baseUrl));
    try {
      const result = await client.callTool({ name: 'twoStepTool', arguments: {} });
      expect((result as any).isError).toBeFalsy();
      expect((result as any).content[0].text).toBe('one+two');
      // Three rounds: interrupt on first, interrupt on second (first answered
      // from requestState), then complete.
      expect(executions.twoStep).toBe(3);
    } finally {
      await client.close();
    }
  });

  it('surfaces a declined elicitation to the tool', async () => {
    executions.ask = 0;
    const client = makeModernElicitingClient({});
    await client.connect(new StreamableHTTPClientTransport(baseUrl));
    try {
      const result = await client.callTool({ name: 'askTool', arguments: {} });
      expect((result as any).content[0].text).toBe('declined');
    } finally {
      await client.close();
    }
  });

  it('works through the Mastra client with a pinned protocolVersion and an elicitation handler', async () => {
    const client = new InternalMastraMCPClient({
      name: 'mastra-elicit-client',
      server: {
        url: baseUrl,
        protocolVersion: '2026-07-28',
      },
    });
    client.elicitation.onRequest(async request => {
      expect(request.message).toBe('What is your favorite color?');
      return { action: 'accept', content: { color: 'green' } };
    });
    await client.connect();
    try {
      const tools = await client.tools();
      const result = await tools.askTool.execute!({}, {} as any);
      expect(JSON.stringify(result)).toContain('color: green');
    } finally {
      await client.disconnect();
    }
  });
});
