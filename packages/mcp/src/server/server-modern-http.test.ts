import http from 'node:http';
import { createTool } from '@mastra/core/tools';
import { Client, StreamableHTTPClientTransport } from '@modelcontextprotocol/client';
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
});

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

  it('serves a client pinned to 2026-07-28: lists and calls tools', async () => {
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
    } finally {
      await client.disconnect();
    }
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

  it('does not break tools that log on the modern leg (per-request log context)', async () => {
    const client = new Client(
      { name: 'log-client', version: '1.0.0' },
      { versionNegotiation: { mode: { pin: '2026-07-28' } } },
    );
    await client.connect(new StreamableHTTPClientTransport(baseUrl));
    try {
      const result = await client.callTool({ name: 'loggingTool', arguments: {} });
      expect((result as any).isError).toBeFalsy();
      expect((result as any).content[0].text).toBe('logged');
    } finally {
      await client.close();
    }
  });
});

describe('MCPServer without protocolVersion (legacy default)', () => {
  let server: MCPServer;
  let httpServer: http.Server;
  let baseUrl: URL;

  beforeAll(async () => {
    server = new MCPServer({
      name: 'Legacy Test Server',
      version: '1.0.0',
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

  it('fails loudly when a client pinned to 2026-07-28 connects to a legacy-only server', async () => {
    const client = new InternalMastraMCPClient({
      name: 'pinned-client',
      server: {
        url: baseUrl,
        protocolVersion: '2026-07-28',
      },
    });
    await expect(client.connect()).rejects.toThrow();
    await client.disconnect().catch(() => {});
  });
});
