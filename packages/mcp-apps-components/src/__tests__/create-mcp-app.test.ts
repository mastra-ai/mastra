import http from 'node:http';
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
import { createMcpApp, defineMcpAppUi, MCP_APP_CONTEXT_KEY } from '@mastra/mcp-apps-components';
import type { McpAppDataOutput, McpAppPreparedRequest, McpAppRequest } from '@mastra/mcp-apps-components';
import { dashboardUi } from '@mastra/mcp-apps-components/dashboard-renderer';
import {
  Client,
  InMemoryTransport,
  ProtocolError,
  ProtocolErrorCode,
  StreamableHTTPClientTransport,
} from '@modelcontextprotocol/client';
import { App } from '@modelcontextprotocol/ext-apps';
import { AppBridge } from '@modelcontextprotocol/ext-apps/app-bridge';
import type { AuthInfo } from '@modelcontextprotocol/server';
import { Hono } from 'hono';
import { afterAll, afterEach, assert, beforeAll, describe, expect, it } from 'vitest';
import { z } from 'zod';
import { agentRunsDashboard } from '../apps/dashboard-renderer/__tests__/fixtures/dashboard';
import { createMcpAppDataFetch } from '../runtime/data-fetch';

const READER = 'reader-token';
const GUEST = 'guest-token';
const METRIC = 'mastra_dashboard_data_test';
const SUM = { name: [METRIC], aggregation: 'sum' as const };

type TestUser = { id: string; role: string };

async function seededStorage(values: number[]) {
  const storage = new InMemoryStore();
  const observability = storage.stores.observability;
  assert(observability);
  await observability.batchCreateMetrics({
    metrics: values.map((value, index) => ({
      metricId: `metric-${index}`,
      timestamp: new Date(),
      name: METRIC,
      value,
      labels: {},
    })),
  });
  return storage;
}

/** What a host serving several projects has its dashboard's reads carry. */
const projectContext = z.object({ projectId: z.string().min(1).optional() });

type PrepareRequest = (
  request: McpAppRequest<typeof dashboardUi.reads, typeof projectContext>,
) => McpAppPreparedRequest;

/** Sends every read to the Mastra server at `origin`, as a host serving one project does. */
const toMastra =
  (origin: string): PrepareRequest =>
  ({ path }) => ({ url: `${origin}/api${path}` });

const DATA_TOOL = dashboardUi.dataTool;

/** The dashboard app as a host builds it: a tool the model calls to open it, and where its reads go. */
const dashboardApp = (prepareRequest: PrepareRequest) =>
  createMcpApp({
    ui: dashboardUi,
    tool: {
      id: 'showDashboard',
      description: 'Shows the agent runs dashboard',
      inputSchema: z.object({ projectId: z.string().optional() }),
      context: projectContext,
      execute: ({ projectId }) => ({ input: { definition: agentRunsDashboard }, context: { projectId } }),
    },
    prepareRequest,
  });

/**
 * A Mastra server with auth and RBAC, whose `apps` MCP server reads back from it over HTTP. It
 * records the requests it receives, so tests can see what crossed the wire.
 */
async function startMastra(values = [5, 7]) {
  // Listen first: the data tool needs the server's origin before Mastra is built.
  let handle: (request: Request) => Response | Promise<Response> = () => new Response(null, { status: 503 });
  const received: Request[] = [];
  const server = await listen(request => {
    received.push(request.clone());
    return handle(request);
  });
  const mastra = new Mastra({
    logger: false,
    storage: await seededStorage(values),
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
      apps: new MCPServer({
        id: 'apps',
        name: 'Apps',
        version: '1.0.0',
        ...dashboardApp(toMastra(server.origin)),
      }),
      empty: new MCPServer({ id: 'empty', name: 'Empty', version: '1.0.0', tools: {} }),
    },
  });
  const app = new Hono();
  await new MastraServer({ app, mastra }).init();
  handle = app.fetch;
  return {
    ...server,
    received,
    mcpUrl: (serverId: string) => new URL(`${server.origin}/api/mcp/${serverId}/mcp`),
  };
}

async function listen(fetch: (request: Request) => Response | Promise<Response>) {
  const server: Server = await new Promise(resolve => {
    const started = serve({ fetch, hostname: '127.0.0.1', port: 0 }, () => resolve(started as Server));
  });
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Server did not bind to a port');
  return {
    origin: `http://127.0.0.1:${address.port}`,
    close: () => new Promise<void>(resolve => server.close(() => resolve())),
  };
}

/**
 * An MCP server with no Mastra instance, serving the data tool over its own HTTP endpoint. Like
 * hosts using an auth middleware, it puts the caller's bearer token on `req.auth`.
 */
async function startStandaloneMcp(tools: ReturnType<typeof createMcpApp>) {
  const mcp = new MCPServer({
    id: 'standalone',
    name: 'Standalone',
    version: '1.0.0',
    ...tools,
  });
  const server = http.createServer(async (req, res) => {
    const token = req.headers.authorization?.replace(/^Bearer /, '');
    if (token) (req as http.IncomingMessage & { auth?: AuthInfo }).auth = { token, clientId: 'host', scopes: [] };
    await mcp.startHTTP({ url: new URL(req.url ?? '', 'http://localhost'), httpPath: '/mcp', req, res });
  });
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Server did not bind to a port');
  return {
    mcpUrl: new URL(`http://127.0.0.1:${address.port}/mcp`),
    close: async () => {
      await mcp.close();
      await new Promise<void>(resolve => server.close(() => resolve()));
    },
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

type RelayToolCall = (params: Parameters<Client['callTool']>[0]) => ReturnType<Client['callTool']>;

/**
 * A MastraClient inside the dashboard app, whose host relays its tool calls to `server` the way a
 * real host does, or answers them with `relay`. Counts every call so retries show up.
 */
async function dashboardClient(
  server: Client,
  relay: RelayToolCall = params => server.callTool(params),
  context?: z.input<typeof projectContext>,
) {
  const [appTransport, hostTransport] = InMemoryTransport.createLinkedPair();
  const bridge = new AppBridge(null, { name: 'test-host', version: '1.0.0' }, { serverTools: {} });
  let toolCalls = 0;
  bridge.oncalltool = async params => {
    toolCalls += 1;
    return relay(params);
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
    fetch: createMcpAppDataFetch(app, { ui: dashboardUi, context }),
  });
  return { client, toolCalls: () => toolCalls };
}

describe('createMcpApp', () => {
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
        .getMcpServerTool('apps', DATA_TOOL)
        .execute({ data: { read: 'getMetricAggregate', body: SUM, context: {} } });

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
        name: DATA_TOOL,
        arguments: { read: 'listScores', body: {}, context: {} },
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

      const response = await createMcpAppDataFetch(app, { ui: dashboardUi })(
        'http://mastra.test/observability/scores',
        {
          method: 'GET',
        },
      );

      expect(response.status).toBe(400);
      const { error } = (await response.json()) as { error: string };
      expect(error).toMatch(/validation/i);
      expect(error.trimStart().startsWith('{')).toBe(false);
    });
  });

  describe('when the MCP server serving the app has no data tool', () => {
    it('tells the developer to register it, once, without retrying', async () => {
      const { client, toolCalls } = await dashboardClient(readerOfEmptyServer);

      await expect(client.getMetricAggregate(SUM)).rejects.toThrow(/404.*no dashboardData tool.*createMcpApp/);
      expect(toolCalls()).toBe(1);
    });

    it('does the same when Studio refuses the call in its own words', async () => {
      // Studio checks the server's tool list itself and refuses with invalid params, as MCP servers do.
      const { client, toolCalls } = await dashboardClient(readerOfEmptyServer, async () => {
        throw new ProtocolError(
          ProtocolErrorCode.InvalidParams,
          `Tool "${DATA_TOOL}" isn't available to apps on MCP server "empty"`,
        );
      });

      await expect(client.getMetricAggregate(SUM)).rejects.toThrow(/404.*no dashboardData tool.*createMcpApp/);
      expect(toolCalls()).toBe(1);
    });
  });

  describe('when a host lists the tools to give the model', () => {
    it('marks the data tool as callable by apps only', async () => {
      const { tools } = await reader.listTools();

      expect(tools.find(tool => tool.name === DATA_TOOL)?._meta).toEqual(
        expect.objectContaining({ ui: { visibility: ['app'] } }),
      );
    });
  });

  describe('when the dashboard makes each of its reads', () => {
    it("sends it to a route the Mastra server has, so the dashboard's reads can't drift", async () => {
      for (const [read, route] of Object.entries(dashboardUi.reads)) {
        const result = await reader.callTool({
          name: DATA_TOOL,
          arguments: route.startsWith('GET ') ? { read, query: {}, context: {} } : { read, body: {}, context: {} },
        });

        expect(result.isError, read).toBeFalsy();
        expect((result.structuredContent as McpAppDataOutput).status, read).not.toBe(404);
      }
    });
  });

  describe('when the model opens the dashboard', () => {
    it('lists the tool linked to the dashboard, and answers with what the dashboard renders', async () => {
      const { tools } = await reader.listTools();
      const result = await reader.callTool({ name: 'showDashboard', arguments: { projectId: 'proj_1' } });

      expect(tools.find(tool => tool.name === 'showDashboard')?._meta).toEqual(
        expect.objectContaining({ ui: { resourceUri: dashboardUi.uri } }),
      );
      expect(result.structuredContent).toEqual(
        expect.objectContaining({ definition: agentRunsDashboard, [MCP_APP_CONTEXT_KEY]: { projectId: 'proj_1' } }),
      );
      expect(dashboardUi.input.parse(result.structuredContent)).not.toHaveProperty(MCP_APP_CONTEXT_KEY);
    });
  });
});

describe('createMcpApp on an MCP server without a Mastra instance', () => {
  let mastra: Awaited<ReturnType<typeof startMastra>>;

  beforeAll(async () => {
    mastra = await startMastra();
  });

  afterAll(async () => {
    await mastra.close();
  });

  async function standalone(prepareRequest: PrepareRequest, token: string) {
    const served = await startStandaloneMcp(dashboardApp(prepareRequest));
    const client = await connect(served.mcpUrl, token);
    closers.push(
      () => client.close(),
      () => served.close(),
    );
    return client;
  }

  describe('when the dashboard reads metrics as a user allowed to', () => {
    it('answers from the Mastra server, read as that user', async () => {
      const { client } = await dashboardClient(await standalone(toMastra(mastra.origin), READER));

      const aggregate = await client.getMetricAggregate(SUM);

      expect(aggregate).toEqual(expect.objectContaining({ value: 12 }));
    });
  });

  describe("when the user lacks the route's permission", () => {
    it("fails the dashboard's request with 403 and doesn't retry it", async () => {
      const { client, toolCalls } = await dashboardClient(await standalone(toMastra(mastra.origin), GUEST));

      await expect(client.getMetricAggregate(SUM)).rejects.toThrow(/403.*observability:read/);
      expect(toolCalls()).toBe(1);
    });
  });

  describe('when prepareRequest sends its own authorization header', () => {
    it("reads with it instead of the caller's token", async () => {
      const server = await standalone(
        ({ path }) => ({ url: `${mastra.origin}/api${path}`, headers: { Authorization: `Bearer ${READER}` } }),
        GUEST,
      );
      const { client } = await dashboardClient(server);

      const aggregate = await client.getMetricAggregate(SUM);

      expect(aggregate).toEqual(expect.objectContaining({ value: 12 }));
    });
  });

  describe('when the dashboard names a project, as hosts serving several do', () => {
    // Two regions, each a Mastra server holding different data.
    let eu: Awaited<ReturnType<typeof startMastra>>;

    beforeAll(async () => {
      eu = await startMastra([1, 2]);
    });

    afterAll(async () => {
      await eu.close();
    });

    const byProject: PrepareRequest = ({ path, context: { projectId }, token }) => {
      if (token !== READER || !projectId?.startsWith('org1_')) {
        return { response: { status: 403, body: { error: `You can't read project ${projectId}` } } };
      }
      const region = projectId.endsWith('_eu') ? eu.origin : mastra.origin;
      return { url: `${region}/api${path}`, headers: { 'x-mastra-project-id': projectId } };
    };

    it('reads it from the server prepareRequest picks for it, with the headers it adds', async () => {
      const server = await standalone(byProject, READER);
      const { client: euDashboard } = await dashboardClient(server, undefined, { projectId: 'org1_eu' });
      const { client: usDashboard } = await dashboardClient(server, undefined, { projectId: 'org1_us' });

      expect(await euDashboard.getMetricAggregate(SUM)).toEqual(expect.objectContaining({ value: 3 }));
      expect(await usDashboard.getMetricAggregate(SUM)).toEqual(expect.objectContaining({ value: 12 }));
      expect(eu.received.at(-1)?.headers.get('x-mastra-project-id')).toBe('org1_eu');
      expect(eu.received.at(-1)?.headers.get('authorization')).toBe(`Bearer ${READER}`);
    });

    it("fails the dashboard's request with prepareRequest's answer, without reaching any server", async () => {
      const server = await standalone(byProject, READER);
      const { client, toolCalls } = await dashboardClient(server, undefined, { projectId: 'org2_eu' });
      const sent = eu.received.length + mastra.received.length;

      await expect(client.getMetricAggregate(SUM)).rejects.toThrow(/403.*project org2_eu/);
      expect(toolCalls()).toBe(1);
      expect(eu.received.length + mastra.received.length).toBe(sent);
    });
  });

  describe('when the Mastra server is unreachable', () => {
    it('answers 502 naming the server it tried', async () => {
      const gone = await listen(() => new Response(null));
      await gone.close();
      const server = await standalone(toMastra(gone.origin), READER);

      const result = await server.callTool({
        name: DATA_TOOL,
        arguments: { read: 'getMetricAggregate', body: SUM, context: {} },
      });

      expect(result.structuredContent).toEqual({
        status: 502,
        body: { error: expect.stringContaining(`Couldn't reach ${gone.origin}`) },
      });
    });
  });

  describe('when a UI reads a route with a parameter', () => {
    const traceUi = defineMcpAppUi({
      uri: 'ui://test/trace',
      name: 'Trace viewer',
      description: 'Shows one trace',
      html: '<!doctype html>',
      dataTool: 'traceData',
      input: z.object({ traceId: z.string() }),
      reads: { getTrace: 'GET /observability/traces/:traceId' },
    });
    // A context other than a project: which deployment the trace lives in.
    const environmentContext = z.object({ environment: z.enum(['staging', 'production']) });

    async function traceServer() {
      const received: string[] = [];
      const api = await listen(request => {
        received.push(new URL(request.url).pathname);
        return Response.json({ spans: [] });
      });
      const prepared: Array<McpAppRequest<typeof traceUi.reads, typeof environmentContext>> = [];
      const served = await startStandaloneMcp(
        createMcpApp({
          ui: traceUi,
          tool: {
            id: 'showTrace',
            description: 'Shows a trace',
            inputSchema: z.object({ traceId: z.string(), environment: z.enum(['staging', 'production']) }),
            context: environmentContext,
            execute: ({ traceId, environment }) => ({ input: { traceId }, context: { environment } }),
          },
          prepareRequest: request => {
            prepared.push(request);
            return { url: `${api.origin}/${request.context.environment}/api${request.path}` };
          },
        }),
      );
      const client = await connect(served.mcpUrl, READER);
      closers.push(
        () => client.close(),
        () => served.close(),
        () => api.close(),
      );
      return { client, received, prepared };
    }

    it('hands prepareRequest the decoded parameter, and sends it encoded in the path', async () => {
      const { client, received, prepared } = await traceServer();

      const result = await client.callTool({
        name: 'traceData',
        arguments: { read: 'getTrace', params: { traceId: 'a/b' }, context: { environment: 'staging' } },
      });

      expect(result.structuredContent).toEqual({ status: 200, body: { spans: [] } });
      expect(prepared).toEqual([
        expect.objectContaining({ read: 'getTrace', params: { traceId: 'a/b' }, path: '/observability/traces/a%2Fb' }),
      ]);
      expect(received).toEqual(['/staging/api/observability/traces/a%2Fb']);
    });

    it('returns the context with the UI input when the model opens the UI', async () => {
      const { client } = await traceServer();

      const result = await client.callTool({
        name: 'showTrace',
        arguments: { traceId: 't1', environment: 'production' },
      });

      expect(result.structuredContent).toEqual({ traceId: 't1', [MCP_APP_CONTEXT_KEY]: { environment: 'production' } });
    });

    it.each([{}, { environment: 'dev' }])(
      'refuses a read carrying the context %j, which its schema rejects, without calling prepareRequest',
      async context => {
        const { client, received, prepared } = await traceServer();

        const result = await client.callTool({
          name: 'traceData',
          arguments: { read: 'getTrace', params: { traceId: 't1' }, context },
        });

        expect(result.isError).toBe(true);
        expect(prepared).toEqual([]);
        expect(received).toEqual([]);
      },
    );

    it.each(['', '.', '..'])('refuses the parameter %j without calling prepareRequest', async traceId => {
      const { client, received, prepared } = await traceServer();

      const result = await client.callTool({
        name: 'traceData',
        arguments: { read: 'getTrace', params: { traceId }, context: { environment: 'staging' } },
      });

      expect(result.isError).toBe(true);
      expect(prepared).toEqual([]);
      expect(received).toEqual([]);
    });
  });
});

describe('defineMcpAppUi', () => {
  const ui = (reads: Record<string, string>) => () =>
    defineMcpAppUi({
      uri: 'ui://test/app',
      name: 'Test app',
      description: 'A test app',
      html: '',
      dataTool: 'testData',
      input: z.object({}),
      reads: reads as Record<string, `GET /${string}`>,
    });

  it('refuses two reads a request could match, naming both', () => {
    expect(ui({ getTrace: 'GET /traces/:traceId', aggregate: 'GET /traces/aggregate' })).toThrow(
      /GET \/traces\/:traceId.*GET \/traces\/aggregate|GET \/traces\/aggregate.*GET \/traces\/:traceId/,
    );
  });

  it('takes the same path read with different methods', () => {
    expect(ui({ list: 'GET /scores', aggregate: 'POST /scores' })).not.toThrow();
  });

  it.each(['PUT /scores', 'GET scores', 'GET /traces/:id/spans/:id'])('refuses the route %j', route => {
    expect(ui({ read: route })).toThrow();
  });
});

describe('createMcpApp with a tool named after the data tool', () => {
  it('refuses it, since the UI reads through that name', () => {
    expect(() =>
      createMcpApp({
        ui: dashboardUi,
        tool: {
          id: DATA_TOOL,
          description: 'Shows a dashboard',
          inputSchema: z.object({}),
          execute: () => ({ input: { definition: agentRunsDashboard } }),
        },
        prepareRequest: toMastra('http://localhost:4111'),
      }),
    ).toThrow(/dashboardData/);
  });
});
