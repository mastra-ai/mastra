import type { ServerType } from '@hono/node-server';
import { serve } from '@hono/node-server';
import { createTool } from '@mastra/core/tools';
import getPort from 'get-port';
import { Hono } from 'hono';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { z } from 'zod/v3';
import { MCPClient } from '../client/configuration';
import { MCPServer } from './server';

/**
 * Regression coverage for https://github.com/mastra-ai/mastra/issues/17291.
 *
 * The Hono SSE transport has no Node request to carry `req.auth`, so auth resolved by
 * middleware never reached tool execution. `startHonoSSE` now accepts the resolved
 * auth info explicitly and surfaces it as `extra.authInfo`.
 */
describe('MCPServer Hono SSE auth info (issue #17291)', () => {
  let server: MCPServer;
  let honoServer: ServerType;
  let client: MCPClient;
  let PORT: number;

  const authInfo = { token: 'tok-abc', clientId: 'user-1', scopes: ['read'] };

  const whoamiTool = createTool({
    id: 'whoami',
    description: 'Returns the auth info visible to tool execution',
    inputSchema: z.object({}),
    execute: async (_input, options) => {
      return { authInfo: options?.requestContext?.get('authInfo') ?? null };
    },
  });

  beforeAll(async () => {
    server = new MCPServer({
      name: 'SSE Auth Test Server',
      version: '0.1.0',
      tools: { whoamiTool },
    });

    const hono = new Hono();
    const handle = async (c: any) =>
      server.startHonoSSE({
        url: new URL(c.req.url, `http://localhost:${PORT}`),
        ssePath: '/sse',
        messagePath: '/message',
        context: c,
        authInfo,
      });

    hono.get('/sse', handle);
    hono.post('/message', handle);

    PORT = await getPort();
    honoServer = serve({ fetch: hono.fetch, port: PORT });

    client = new MCPClient({
      servers: { local: { url: new URL(`http://localhost:${PORT}/sse`) } },
    });
  });

  afterAll(async () => {
    await client.disconnect();
    honoServer.close();
    await server.close();
  });

  it('surfaces the adapter-resolved auth info inside tool execution', async () => {
    const tools = await client.listTools();
    const tool = tools['local_whoamiTool'];
    expect(tool).toBeDefined();

    const result = await tool.execute!({});
    const payload = JSON.parse(result.content[0].text);

    expect(payload.authInfo).toEqual(authInfo);
  });
});
