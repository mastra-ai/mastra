import type { Server } from 'node:http';
import { serve } from '@hono/node-server';
import { MastraClient } from '@mastra/client-js';
import { Mastra } from '@mastra/core/mastra';
import { SimpleAuth } from '@mastra/core/server';
import { InMemoryStore } from '@mastra/core/storage';
import { MastraServer } from '@mastra/hono';
import { MCPServer } from '@mastra/mcp';
// The built package, as consumers install it.
import { MASTRA_API_TOOL, mastraApiTool } from '@mastra/mcp-apps-components';
import { Client, StreamableHTTPClientTransport } from '@modelcontextprotocol/client';
import { Hono } from 'hono';
import { afterAll, assert, beforeAll, describe, expect, it } from 'vitest';

const TOKEN = 'test-token';
const METRIC = 'mastra_relay_test';

async function startMastra() {
  const storage = new InMemoryStore();
  const observability = storage.stores.observability;
  assert(observability);
  await observability.batchCreateMetrics({
    metrics: [5, 7].map((value, index) => ({
      metricId: `metric-${index}`,
      timestamp: new Date(),
      name: METRIC,
      value,
      labels: {},
    })),
  });

  const mastra = new Mastra({
    logger: false,
    storage,
    server: { auth: new SimpleAuth({ tokens: { [TOKEN]: { sub: 'test-user' } } }) },
    mcpServers: {
      apps: new MCPServer({ id: 'apps', name: 'Apps', version: '1.0.0', tools: { [MASTRA_API_TOOL]: mastraApiTool } }),
    },
  });
  const app = new Hono();
  await new MastraServer({ app, mastra }).init();

  const server: Server = await new Promise(resolve => {
    const started = serve({ fetch: app.fetch, hostname: '127.0.0.1', port: 0 }, () => resolve(started as Server));
  });
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Server did not bind to a port');
  return {
    origin: `http://127.0.0.1:${address.port}`,
    url: new URL(`http://127.0.0.1:${address.port}/api/mcp/apps/mcp`),
    close: () => new Promise<void>(resolve => server.close(() => resolve())),
  };
}

async function connect(url: URL) {
  const client = new Client(
    { name: 'test-host', version: '1.0.0' },
    { versionNegotiation: { mode: { pin: '2026-07-28' } } },
  );
  await client.connect(
    new StreamableHTTPClientTransport(url, { requestInit: { headers: { authorization: `Bearer ${TOKEN}` } } }),
  );
  return client;
}

describe('mastraApiTool', () => {
  let mastra: Awaited<ReturnType<typeof startMastra>>;
  let client: Client;

  beforeAll(async () => {
    mastra = await startMastra();
    client = await connect(mastra.url);
  });

  afterAll(async () => {
    await client.close();
    await mastra.close();
  });

  describe('when an app reads a metrics route', () => {
    it("answers with the route's response, read as the caller", async () => {
      const result = await client.callTool({
        name: MASTRA_API_TOOL,
        arguments: {
          method: 'POST',
          path: '/observability/metrics/aggregate',
          body: { name: [METRIC], aggregation: 'sum' },
        },
      });

      // The route sits behind auth: a 200 means the caller's token reached it.
      expect(result.structuredContent).toEqual({ status: 200, body: expect.objectContaining({ value: 12 }) });
    });
  });

  describe("when Studio relays an app's request through its tool-execute route", () => {
    it("answers with the route's response, read as the caller", async () => {
      const studio = new MastraClient({ baseUrl: mastra.origin, headers: { authorization: `Bearer ${TOKEN}` } });

      const result = await studio.getMcpServerTool('apps', MASTRA_API_TOOL).execute({
        data: {
          method: 'POST',
          path: '/observability/metrics/aggregate',
          body: { name: [METRIC], aggregation: 'sum' },
        },
      });

      expect(result).toEqual({ result: { status: 200, body: expect.objectContaining({ value: 12 }) } });
    });
  });

  describe('when an app asks for a route outside the read-only allowlist', () => {
    it('refuses it without calling the server', async () => {
      const result = await client.callTool({
        name: MASTRA_API_TOOL,
        arguments: { method: 'GET', path: '/observability/metrics/../../agents' },
      });

      expect(result.structuredContent).toEqual({
        status: 403,
        body: { error: "GET /agents isn't readable from MCP Apps." },
      });
    });
  });

  describe('when a host lists the tools to give the model', () => {
    it('marks the tool as callable by apps only', async () => {
      const { tools } = await client.listTools();

      expect(tools.find(tool => tool.name === MASTRA_API_TOOL)?._meta).toEqual(
        expect.objectContaining({ ui: { visibility: ['app'] } }),
      );
    });
  });
});
