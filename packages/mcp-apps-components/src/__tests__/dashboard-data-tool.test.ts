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
  DASHBOARD_DATA_REQUESTS,
  DASHBOARD_DATA_TOOL_NAME,
  dashboardDataTool,
} from '@mastra/mcp-apps-components/dashboard-renderer';
import { Client, InMemoryTransport, StreamableHTTPClientTransport } from '@modelcontextprotocol/client';
import { App } from '@modelcontextprotocol/ext-apps';
import { AppBridge } from '@modelcontextprotocol/ext-apps/app-bridge';
import { Hono } from 'hono';
import { afterAll, afterEach, assert, beforeAll, describe, expect, it } from 'vitest';
import { createDashboardDataFetch } from '../apps/dashboard-renderer/data-fetch';
import { DASHBOARD_DATA_ROUTES } from '../apps/dashboard-renderer/data-tool';

const READER = 'reader-token';
const GUEST = 'guest-token';
const METRIC = 'mastra_dashboard_data_test';
const SUM = { name: [METRIC], aggregation: 'sum' as const };

type TestUser = { id: string; role: string };

async function seededStorage() {
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
  return storage;
}

async function startMastra() {
  const mastra = new Mastra({
    logger: false,
    storage: await seededStorage(),
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
      apps: new MCPServer({ id: 'apps', name: 'Apps', version: '1.0.0', tools: { dashboardDataTool } }),
      empty: new MCPServer({ id: 'empty', name: 'Empty', version: '1.0.0', tools: {} }),
    },
  });
  const app = new Hono();
  await new MastraServer({ app, mastra }).init();

  const server: Server = await new Promise(resolve => {
    const started = serve({ fetch: app.fetch, hostname: '127.0.0.1', port: 0 }, () => resolve(started as Server));
  });
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Server did not bind to a port');
  const origin = `http://127.0.0.1:${address.port}`;
  return {
    origin,
    mcpUrl: (serverId: string) => new URL(`${origin}/api/mcp/${serverId}/mcp`),
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

const closers: Array<() => Promise<void>> = [];

afterEach(async () => {
  await Promise.all(closers.splice(0).map(close => close()));
});

/**
 * A MastraClient inside the dashboard app, whose host relays its tool calls to `server` the way a
 * real host does. Counts every call so retries show up.
 */
async function dashboardClient(server: Client) {
  const [appTransport, hostTransport] = InMemoryTransport.createLinkedPair();
  const bridge = new AppBridge(null, { name: 'test-host', version: '1.0.0' }, { serverTools: {} });
  let toolCalls = 0;
  bridge.oncalltool = async params => {
    toolCalls += 1;
    return server.callTool(params);
  };
  const app = new App({ name: 'dashboard', version: '1.0.0' }, {}, { autoResize: false });
  closers.push(
    () => app.close(),
    () => bridge.close(),
  );
  await bridge.connect(hostTransport);
  await app.connect(appTransport);

  // MastraClient's default retries, so a failure it would retry costs extra calls here.
  const client = new MastraClient({
    baseUrl: 'http://mastra.test',
    apiPrefix: '',
    fetch: createDashboardDataFetch(app),
  });
  return { client, toolCalls: () => toolCalls };
}

describe('dashboardDataTool', () => {
  let mastra: Awaited<ReturnType<typeof startMastra>>;
  let reader: Client;
  let guest: Client;
  let readerOfEmptyServer: Client;

  beforeAll(async () => {
    mastra = await startMastra();
    reader = await connect(mastra.mcpUrl('apps'), READER);
    guest = await connect(mastra.mcpUrl('apps'), GUEST);
    readerOfEmptyServer = await connect(mastra.mcpUrl('empty'), READER);
  });

  afterAll(async () => {
    await Promise.all([reader.close(), guest.close(), readerOfEmptyServer.close()]);
    await mastra.close();
  });

  describe('when the dashboard reads metrics as a user allowed to', () => {
    it("answers with the route's response", async () => {
      const { client } = await dashboardClient(reader);

      const aggregate = await client.getMetricAggregate(SUM);

      expect(aggregate).toEqual(expect.objectContaining({ value: 12 }));
    });
  });

  describe('when the dashboard lists scores through the GET route', () => {
    it('passes the query to the route', async () => {
      const { client } = await dashboardClient(reader);

      const scores = await client.listScores({ pagination: { page: 0, perPage: 5 } });

      expect(scores).toEqual(expect.objectContaining({ scores: [] }));
    });
  });

  describe("when Studio relays an app's call through its tool-execute route", () => {
    it("answers with the route's response, read as the signed-in user", async () => {
      const studio = new MastraClient({ baseUrl: mastra.origin, headers: { authorization: `Bearer ${READER}` } });

      const result = await studio
        .getMcpServerTool('apps', DASHBOARD_DATA_TOOL_NAME)
        .execute({ data: { operation: 'getMetricAggregate', body: SUM } });

      expect(result).toEqual({ result: { status: 200, body: expect.objectContaining({ value: 12 }) } });
    });
  });

  describe("when the user lacks the route's permission", () => {
    it("fails the dashboard's request with 403 and doesn't retry it", async () => {
      const { client, toolCalls } = await dashboardClient(guest);

      await expect(client.getMetricAggregate(SUM)).rejects.toThrow(/403.*observability:read/);
      expect(toolCalls()).toBe(1);
    });
  });

  describe('when the route rejects the body', () => {
    it("fails the dashboard's request with the route's 4xx and doesn't retry it", async () => {
      const { client, toolCalls } = await dashboardClient(reader);

      await expect(
        client.getMetricAggregate({ name: [METRIC], aggregation: 'not-an-aggregation' as 'sum' }),
      ).rejects.toMatchObject({ status: expect.toSatisfy((status: number) => status >= 400 && status < 500) });
      expect(toolCalls()).toBe(1);
    });
  });

  describe('when the tool rejects its own input', () => {
    it('fails with 400 and a readable message instead of a serialized error', async () => {
      const result = await reader.callTool({
        name: DASHBOARD_DATA_TOOL_NAME,
        arguments: { operation: 'listScores', body: {} },
      });
      expect(result.isError).toBe(true);

      const [appTransport, hostTransport] = InMemoryTransport.createLinkedPair();
      const bridge = new AppBridge(null, { name: 'test-host', version: '1.0.0' }, { serverTools: {} });
      bridge.oncalltool = async () => result;
      const app = new App({ name: 'dashboard', version: '1.0.0' }, {}, { autoResize: false });
      closers.push(
        () => app.close(),
        () => bridge.close(),
      );
      await bridge.connect(hostTransport);
      await app.connect(appTransport);

      const response = await createDashboardDataFetch(app)('http://mastra.test/observability/scores', {
        method: 'GET',
      });

      expect(response.status).toBe(400);
      const { error } = (await response.json()) as { error: string };
      expect(error).toMatch(/validation/i);
      expect(error.trimStart().startsWith('{')).toBe(false);
    });
  });

  describe('when the MCP server serving the app has no data tool', () => {
    it('tells the developer to register it, once, without retrying', async () => {
      const { client, toolCalls } = await dashboardClient(readerOfEmptyServer);

      await expect(client.getMetricAggregate(SUM)).rejects.toThrow(/404.*tools: \{ dashboardDataTool \}/);
      expect(toolCalls()).toBe(1);
    });
  });

  describe('when a host lists the tools to give the model', () => {
    it('marks the data tool as callable by apps only', async () => {
      const { tools } = await reader.listTools();

      expect(tools.find(tool => tool.name === DASHBOARD_DATA_TOOL_NAME)?._meta).toEqual(
        expect.objectContaining({ ui: { visibility: ['app'] } }),
      );
    });
  });

  describe('when the tool and the app resolve different copies of @mastra/core', () => {
    it('still runs the route', async () => {
      const real = new Mastra({ logger: false, storage: await seededStorage() });
      // A Mastra from another @mastra/core copy: same API, different class, so `instanceof` fails.
      const foreign = new Proxy(real, {
        getPrototypeOf: () => Object.prototype,
        get: (target, key) => {
          const value = Reflect.get(target, key, target);
          return typeof value === 'function' ? value.bind(target) : value;
        },
      });
      expect(foreign instanceof Mastra).toBe(false);

      const result = await dashboardDataTool.execute?.(
        { operation: 'getMetricAggregate', body: SUM },
        { mastra: foreign },
      );

      expect(result).toEqual({ status: 200, body: expect.objectContaining({ value: 12 }) });
    });
  });

  describe('when the app picks an operation for a request', () => {
    it("names the route each operation actually runs, so the app's routing can't drift", () => {
      for (const [operation, request] of Object.entries(DASHBOARD_DATA_REQUESTS)) {
        const route = DASHBOARD_DATA_ROUTES[operation as keyof typeof DASHBOARD_DATA_ROUTES];
        expect(`${route.method} ${route.path}`).toBe(request);
      }
    });
  });
});
