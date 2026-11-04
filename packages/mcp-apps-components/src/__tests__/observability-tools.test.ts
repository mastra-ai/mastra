import type { Server } from 'node:http';
import { serve } from '@hono/node-server';
import { MastraClient } from '@mastra/client-js';
import { StaticRBACProvider } from '@mastra/core/auth/ee';
import { Mastra } from '@mastra/core/mastra';
import { SimpleAuth } from '@mastra/core/server';
import { InMemoryStore } from '@mastra/core/storage';
import { MastraServer } from '@mastra/hono';
import { MCPServer } from '@mastra/mcp';
// The built package, as consumers install it.
import {
  OBSERVABILITY_APP_TOOL_ROUTES,
  OBSERVABILITY_APP_TOOLS,
  observabilityAppTools,
} from '@mastra/mcp-apps-components/observability-tools';
import { Client, StreamableHTTPClientTransport } from '@modelcontextprotocol/client';
import { Hono } from 'hono';
import { afterAll, assert, beforeAll, describe, expect, it } from 'vitest';

const READER = 'reader-token';
const GUEST = 'guest-token';
const METRIC = 'mastra_app_tools_test';
const SUM = { name: [METRIC], aggregation: 'sum' };

type TestUser = { id: string; role: string };

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
    server: {
      auth: new SimpleAuth<TestUser>({
        tokens: { [READER]: { id: 'reader', role: 'reader' }, [GUEST]: { id: 'guest', role: 'guest' } },
      }),
      rbac: new StaticRBACProvider<TestUser>({
        roleMapping: { reader: ['mcp:execute', 'observability:read'], guest: ['mcp:execute'] },
        getUserRoles: user => [user.role],
      }),
    },
    mcpServers: {
      apps: new MCPServer({ id: 'apps', name: 'Apps', version: '1.0.0', tools: observabilityAppTools }),
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

async function connect(url: URL, token: string) {
  const client = new Client(
    { name: 'test-host', version: '1.0.0' },
    { versionNegotiation: { mode: { pin: '2026-07-28' } } },
  );
  await client.connect(
    new StreamableHTTPClientTransport(url, { requestInit: { headers: { authorization: `Bearer ${token}` } } }),
  );
  return client;
}

describe('observabilityAppTools', () => {
  let mastra: Awaited<ReturnType<typeof startMastra>>;
  let reader: Client;
  let guest: Client;

  beforeAll(async () => {
    mastra = await startMastra();
    reader = await connect(mastra.url, READER);
    guest = await connect(mastra.url, GUEST);
  });

  afterAll(async () => {
    await Promise.all([reader.close(), guest.close()]);
    await mastra.close();
  });

  describe('when an app reads metrics as a user allowed to', () => {
    it("answers with the route's response", async () => {
      const result = await reader.callTool({ name: 'observabilityMetricAggregate', arguments: SUM });

      expect(result.structuredContent).toEqual({ status: 200, body: expect.objectContaining({ value: 12 }) });
    });
  });

  describe('when an app lists scores through the GET route', () => {
    it('passes the query to the route', async () => {
      const result = await reader.callTool({ name: 'observabilityListScores', arguments: { page: '0', perPage: '5' } });

      expect(result.structuredContent).toEqual({ status: 200, body: expect.objectContaining({ scores: [] }) });
    });
  });

  describe("when Studio relays an app's call through its tool-execute route", () => {
    it("answers with the route's response, read as the signed-in user", async () => {
      const studio = new MastraClient({ baseUrl: mastra.origin, headers: { authorization: `Bearer ${READER}` } });

      const result = await studio.getMcpServerTool('apps', 'observabilityMetricAggregate').execute({ data: SUM });

      expect(result).toEqual({ result: { status: 200, body: expect.objectContaining({ value: 12 }) } });
    });
  });

  describe("when the caller lacks the route's permission", () => {
    it('refuses with 403, over MCP and through Studio alike', async () => {
      const result = await guest.callTool({ name: 'observabilityMetricAggregate', arguments: SUM });
      const studio = new MastraClient({ baseUrl: mastra.origin, headers: { authorization: `Bearer ${GUEST}` } });
      const relayed = await studio.getMcpServerTool('apps', 'observabilityMetricAggregate').execute({ data: SUM });

      const refusal = {
        status: 403,
        body: expect.objectContaining({ message: expect.stringContaining('observability:read') }),
      };
      expect(result.structuredContent).toEqual(refusal);
      expect(relayed).toEqual({ result: refusal });
    });
  });

  describe('when an app sends a body the route rejects', () => {
    it('fails without reaching the route', async () => {
      const result = await reader.callTool({
        name: 'observabilityMetricAggregate',
        arguments: { name: [METRIC], aggregation: 'not-an-aggregation' },
      });

      expect(result.isError).toBe(true);
    });
  });

  describe('when a host lists the tools to give the model', () => {
    it('marks every tool as callable by apps only, with the input its route accepts', async () => {
      const { tools } = await reader.listTools();
      const appTools = tools.filter(tool => tool.name in OBSERVABILITY_APP_TOOLS);

      expect(appTools.map(tool => tool.name).sort()).toEqual(Object.keys(OBSERVABILITY_APP_TOOLS).sort());
      for (const tool of appTools) {
        expect(tool._meta).toEqual(expect.objectContaining({ ui: { visibility: ['app'] } }));
      }
      expect(appTools.find(tool => tool.name === 'observabilityMetricAggregate')?.inputSchema.properties).toEqual(
        expect.objectContaining({ aggregation: expect.anything() }),
      );
    });
  });

  describe('when an app picks a tool by route', () => {
    it("names the route each tool actually runs, so the app's routing can't drift", () => {
      for (const [name, { method, path }] of Object.entries(OBSERVABILITY_APP_TOOLS)) {
        const route = OBSERVABILITY_APP_TOOL_ROUTES[name as keyof typeof OBSERVABILITY_APP_TOOLS];
        expect({ method: route.method, path: route.path }).toEqual({ method, path });
      }
    });
  });
});
