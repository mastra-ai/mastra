/**
 * The built-in MCP server's MCP Apps, served by a real Mastra over HTTP with `@mastra/mcp-apps-components`
 * installed: what a client that renders apps sees, what one that doesn't sees, and what RBAC still holds back.
 */
import { serve } from '@hono/node-server';
import { Agent } from '@mastra/core/agent';
import { Mastra } from '@mastra/core/mastra';
import type { ServerMCPConfig } from '@mastra/core/server';
import { InMemoryStore, MastraCompositeStore } from '@mastra/core/storage';
import { createMockModel } from '@mastra/core/test-utils/llm-mock';
import { DuckDBStore } from '@mastra/duckdb';
import { MastraStorageExporter, Observability } from '@mastra/observability';
import { Client, StreamableHTTPClientTransport } from '@modelcontextprotocol/client';
import { Hono } from 'hono';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { MastraServer } from '../index';

const UI = 'io.modelcontextprotocol/ui';
const TRACE_VIEWER = 'ui://mastra/trace-viewer';
const EXPLORER = 'ui://mastra/observability-explorer';

/** Bearer token = role. `tracer` may read traces; `runner` may use the MCP server but not read traces. */
const PERMISSIONS: Record<string, string[]> = {
  tracer: ['mcp:read', 'mcp:execute', 'observability:read'],
  runner: ['mcp:read', 'mcp:execute', 'agents:read'],
};

const cleanups: Array<() => Promise<void>> = [];
afterAll(async () => {
  for (const cleanup of cleanups.reverse()) await cleanup();
});

/**
 * Serves a Mastra that has recorded one agent run's trace. Its observability store answers trace queries
 * (DuckDB) unless `traceQuery` is false (the in-memory store, which only lists traces).
 */
async function start(mcp: ServerMCPConfig = {}, { traceQuery = true } = {}) {
  const exporter = new MastraStorageExporter({ strategy: 'auto' });
  const mastra = new Mastra({
    logger: false,
    storage: traceQuery
      ? new MastraCompositeStore({
          id: 'mcp-apps',
          default: new InMemoryStore(),
          domains: { observability: await new DuckDBStore({ path: ':memory:' }).getStore('observability') },
        })
      : new InMemoryStore(),
    agents: {
      helper: new Agent({
        id: 'helper',
        name: 'helper',
        instructions: 'test',
        model: createMockModel({ mockText: 'hello' }),
      }),
    },
    observability: new Observability({ configs: { default: { serviceName: 'mcp-apps', exporters: [exporter] } } }),
    server: {
      mcp,
      auth: {
        authenticateToken: async (token: string) => (PERMISSIONS[token] ? { id: token, role: token } : null),
        authorize: async () => true,
      },
      rbac: {
        getPermissions: async (user: { role: string }) => PERMISSIONS[user.role] ?? [],
        getRoles: async (user: { role: string }) => [user.role],
      },
    } as never,
  });
  await mastra.getAgent('helper').generate('hi');
  await exporter.flush();
  const { spans } = await mastra
    .getStorage()!
    .getStore('observability')
    .then(store => store!.listTraces({}));
  const traceId = spans[0]!.traceId;

  const app = new Hono();
  await new MastraServer({ app, mastra }).init();
  const server = serve({ fetch: app.fetch, port: 0 });
  await new Promise(resolve => server.once('listening', resolve));
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('no address');
  cleanups.push(() => new Promise<void>(resolve => server.close(() => resolve())));

  /** A client as `role`; `rendersApps` declares MCP Apps support, as Claude does. */
  const connect = async (role: string, { rendersApps }: { rendersApps: boolean }) => {
    const client = new Client(
      { name: 'test-host', version: '1.0.0' },
      {
        versionNegotiation: { mode: { pin: '2026-07-28' } },
        ...(rendersApps
          ? { capabilities: { extensions: { [UI]: { mimeTypes: ['text/html;profile=mcp-app'] } } } }
          : {}),
      },
    );
    await client.connect(
      new StreamableHTTPClientTransport(new URL(`http://localhost:${address.port}/api/mcp`), {
        requestInit: { headers: { Authorization: `Bearer ${role}` } },
      }),
    );
    cleanups.push(() => client.close());
    return client;
  };
  return { connect, traceId };
}

const json = (result: { structuredContent?: unknown; content?: unknown }) =>
  result.structuredContent ?? JSON.parse((result.content as { text: string }[])[0]!.text);

describe('built-in MCP server apps', () => {
  let server: Awaited<ReturnType<typeof start>>;
  beforeAll(async () => {
    server = await start();
  });

  it('opens get_trace in the trace viewer for a client that renders apps', async () => {
    const client = await server.connect('tracer', { rendersApps: true });

    expect(client.getServerCapabilities()?.extensions).toMatchObject({ [UI]: {} });
    const { tools } = await client.listTools();
    expect(tools.find(tool => tool.name === 'get_trace')?._meta).toMatchObject({ ui: { resourceUri: TRACE_VIEWER } });

    const page = await client.readResource({ uri: TRACE_VIEWER });
    expect(page.contents[0]).toMatchObject({ uri: TRACE_VIEWER, mimeType: 'text/html;profile=mcp-app' });
    expect((page.contents[0] as { text: string }).text).toContain('<div id="root"></div>');

    // The viewer pages the trace and opens spans through the same tools, as this caller.
    const trace = json(await client.callTool({ name: 'get_trace', arguments: { traceId: server.traceId } }));
    expect(trace.spans.length).toBeGreaterThan(0);
    const { spanId } = trace.spans[0];
    const span = json(await client.callTool({ name: 'get_span', arguments: { traceId: server.traceId, spanId } }));
    expect(span.span.spanId).toBe(spanId);
  });

  it('opens trace queries in the observability explorer, with its app-only capabilities tool', async () => {
    const client = await server.connect('tracer', { rendersApps: true });

    const { tools } = await client.listTools();
    expect(tools.find(tool => tool.name === 'query_traces')?._meta).toMatchObject({ ui: { resourceUri: EXPLORER } });
    // Hosts keep app-only tools from the model but list them; the list asks which views the store supports.
    const capabilitiesTool = tools.find(tool => tool.name === 'get_observability_capabilities');
    expect(capabilitiesTool?._meta).toMatchObject({ ui: { resourceUri: EXPLORER, visibility: ['app'] } });

    const page = await client.readResource({ uri: EXPLORER });
    expect(page.contents[0]).toMatchObject({ uri: EXPLORER, mimeType: 'text/html;profile=mcp-app' });

    // The list's own reads, as this caller: which views the store supports, then the traces.
    const { capabilities } = json(await client.callTool({ name: 'get_observability_capabilities', arguments: {} }));
    expect(capabilities.traceQuery).toBe(true);
    const timeRange = { from: new Date(Date.now() - 3_600_000).toISOString(), to: new Date().toISOString() };
    const { traces } = json(await client.callTool({ name: 'query_traces', arguments: { timeRange } }));
    expect(traces.map((trace: { traceId: string }) => trace.traceId)).toContain(server.traceId);
  });

  it('gives a client that does not render apps the same tools with no app links', async () => {
    const client = await server.connect('tracer', { rendersApps: false });

    expect(client.getServerCapabilities()?.extensions?.[UI]).toBeUndefined();
    expect(client.getServerCapabilities()?.resources).toBeUndefined();
    const { tools } = await client.listTools();
    const getTrace = tools.find(tool => tool.name === 'get_trace');
    expect(getTrace).toBeDefined();
    expect(getTrace?._meta?.ui).toBeUndefined();
    expect(tools.find(tool => tool.name === 'query_traces')?._meta?.ui).toBeUndefined();
    expect(tools.map(tool => tool.name)).not.toContain('get_observability_capabilities');

    const result = await client.callTool({ name: 'get_trace', arguments: { traceId: server.traceId } });
    expect(result._meta?.ui).toBeUndefined();
    expect(json(result).spans.length).toBeGreaterThan(0);
  });

  it('sends the model a line per row of what an app renders, and the app every field', async () => {
    const text = (result: { content?: unknown }) => (result.content as { text: string }[])[0]!.text;
    const timeRange = { from: new Date(Date.now() - 3_600_000).toISOString(), to: new Date().toISOString() };
    const apps = await server.connect('tracer', { rendersApps: true });
    const plain = await server.connect('tracer', { rendersApps: false });

    const trace = await apps.callTool({ name: 'get_trace', arguments: { traceId: server.traceId } });
    const { spans } = trace.structuredContent as { spans: { spanId: string; startedAt: string; endedAt: string }[] };
    expect(spans.length).toBeGreaterThan(0);
    const tree = text(trace);
    expect(tree).toMatch(new RegExp(`^Trace ${server.traceId}: ${spans.length} spans`));
    for (const span of spans) {
      const ms = Date.parse(span.endedAt) - Date.parse(span.startedAt);
      expect(tree).toContain(`- ${span.spanId} | `);
      expect(tree.split('\n').find(line => line.includes(span.spanId))).toContain(` | ${ms}ms`);
    }
    expect(tree).toContain('get_span');
    expect(() => JSON.parse(tree)).toThrow();

    const queried = await apps.callTool({ name: 'query_traces', arguments: { timeRange } });
    expect((queried.structuredContent as { traces: unknown[] }).traces.length).toBeGreaterThan(0);
    expect(text(queried)).toContain(`- ${server.traceId} | `);
    expect(text(queried).length).toBeLessThan(JSON.stringify(queried.structuredContent).length);

    // Tools no app renders, and every tool for a caller without apps, keep the full JSON for the model.
    const span = await apps.callTool({
      name: 'get_span',
      arguments: { traceId: server.traceId, spanId: spans[0]!.spanId },
    });
    expect(span.structuredContent).toBeUndefined();
    expect(JSON.parse(text(span)).span.spanId).toBe(spans[0]!.spanId);
    const plainQuery = await plain.callTool({ name: 'query_traces', arguments: { timeRange } });
    expect(plainQuery.structuredContent).toBeUndefined();
    expect(JSON.parse(text(plainQuery)).traces.length).toBeGreaterThan(0);
  });

  it("does not let the viewer read traces the caller can't", async () => {
    const client = await server.connect('runner', { rendersApps: true });

    const { tools } = await client.listTools();
    expect(tools.map(tool => tool.name)).not.toContain('get_trace');
    expect(tools.map(tool => tool.name)).not.toContain('get_span');
    expect(tools.map(tool => tool.name)).not.toContain('get_observability_capabilities');
    // The viewer's own calls are tool calls, so it can't reach them either.
    await expect(
      client.callTool({ name: 'get_span', arguments: { traceId: server.traceId, spanId: 'x' } }),
    ).rejects.toThrow('Unknown tool: get_span');
  });
});

it("tells apps the configured Studio URL, for their Studio links, and not callers that don't render apps", async () => {
  const { connect, traceId } = await start({ studioUrl: 'https://studio.example.com/' });
  const apps = await connect('tracer', { rendersApps: true });
  const plain = await connect('tracer', { rendersApps: false });

  const opened = await apps.callTool({ name: 'get_trace', arguments: { traceId } });
  expect(opened._meta?.['mastra/studioUrl']).toBe('https://studio.example.com');
  const plainTrace = await plain.callTool({ name: 'get_trace', arguments: { traceId } });
  expect(plainTrace._meta?.['mastra/studioUrl']).toBeUndefined();
});

it('serves no apps with `server.mcp.apps: false`', async () => {
  const { connect } = await start({ apps: false });
  const client = await connect('tracer', { rendersApps: true });

  const { tools } = await client.listTools();
  expect(tools.find(tool => tool.name === 'get_trace')?._meta?.ui).toBeUndefined();
  await expect(client.readResource({ uri: TRACE_VIEWER })).rejects.toThrow();
  await expect(client.readResource({ uri: EXPLORER })).rejects.toThrow();
  expect(tools.map(tool => tool.name)).not.toContain('get_observability_capabilities');
});

it('opens logs and metrics in the observability explorer, telling it which of those views the caller can use', async () => {
  const { connect } = await start({ toolsets: ['observability', 'observability_analytics'] });
  const client = await connect('tracer', { rendersApps: true });

  const { tools } = await client.listTools();
  for (const name of ['list_logs', 'analyze_metrics'])
    expect(tools.find(tool => tool.name === name)?._meta).toMatchObject({ ui: { resourceUri: EXPLORER } });
  const values = tools.find(tool => tool.name === 'list_observability_values');
  expect(values?._meta).toMatchObject({ ui: { resourceUri: EXPLORER, visibility: ['app'] } });

  const { tools: served } = json(await client.callTool({ name: 'get_observability_capabilities', arguments: {} }));
  expect(served).toEqual({ logs: true, metrics: true });
  // The filter bars' values, as this caller: the agent that ran is a known entity.
  const { names } = json(
    await client.callTool({ name: 'list_observability_values', arguments: { kind: 'entityNames' } }),
  );
  expect(names).toContain('helper');
});

it("tells the observability explorer metrics aren't served without the analytics toolset", async () => {
  const { connect } = await start({ toolsets: ['observability'] });
  const client = await connect('tracer', { rendersApps: true });

  const { tools } = await client.listTools();
  expect(tools.map(tool => tool.name)).not.toContain('analyze_metrics');
  const { tools: served } = json(await client.callTool({ name: 'get_observability_capabilities', arguments: {} }));
  expect(served).toEqual({ logs: true, metrics: false });
});

it('opens list_traces in the observability explorer on a store without trace queries', async () => {
  const { connect, traceId } = await start({}, { traceQuery: false });
  const client = await connect('tracer', { rendersApps: true });

  const { tools } = await client.listTools();
  expect(tools.map(tool => tool.name)).not.toContain('query_traces');
  expect(tools.find(tool => tool.name === 'list_traces')?._meta).toMatchObject({ ui: { resourceUri: EXPLORER } });
  // The list still learns what the store supports, and falls back to listing.
  const { capabilities } = json(await client.callTool({ name: 'get_observability_capabilities', arguments: {} }));
  expect(capabilities.traceQuery).toBe(false);
  const { spans } = json(await client.callTool({ name: 'list_traces', arguments: {} }));
  expect(spans.map((span: { traceId: string }) => span.traceId)).toContain(traceId);
});
