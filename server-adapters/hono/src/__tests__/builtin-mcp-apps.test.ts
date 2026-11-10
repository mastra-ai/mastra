/**
 * The built-in MCP server's MCP Apps, served by a real Mastra over HTTP with `@mastra/mcp-apps-components`
 * installed: what a client that renders apps sees, what one that doesn't sees, and what RBAC still holds back.
 */
import { serve } from '@hono/node-server';
import { Agent } from '@mastra/core/agent';
import { Mastra } from '@mastra/core/mastra';
import type { ServerMCPConfig } from '@mastra/core/server';
import { InMemoryStore } from '@mastra/core/storage';
import { createMockModel } from '@mastra/core/test-utils/llm-mock';
import { MastraStorageExporter, Observability } from '@mastra/observability';
import { Client, StreamableHTTPClientTransport } from '@modelcontextprotocol/client';
import { Hono } from 'hono';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { MastraServer } from '../index';

const UI = 'io.modelcontextprotocol/ui';
const TRACE_VIEWER = 'ui://mastra/trace-viewer';

/** Bearer token = role. `tracer` may read traces; `runner` may use the MCP server but not read traces. */
const PERMISSIONS: Record<string, string[]> = {
  tracer: ['mcp:read', 'mcp:execute', 'observability:read'],
  runner: ['mcp:read', 'mcp:execute', 'agents:read'],
};

const cleanups: Array<() => Promise<void>> = [];
afterAll(async () => {
  for (const cleanup of cleanups.reverse()) await cleanup();
});

/** Serves a Mastra that has recorded one agent run's trace. */
async function start(mcp: ServerMCPConfig = {}) {
  const exporter = new MastraStorageExporter({ strategy: 'auto' });
  const mastra = new Mastra({
    logger: false,
    storage: new InMemoryStore(),
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

  it('gives a client that does not render apps the same tools with no app links', async () => {
    const client = await server.connect('tracer', { rendersApps: false });

    expect(client.getServerCapabilities()?.extensions?.[UI]).toBeUndefined();
    expect(client.getServerCapabilities()?.resources).toBeUndefined();
    const { tools } = await client.listTools();
    const getTrace = tools.find(tool => tool.name === 'get_trace');
    expect(getTrace).toBeDefined();
    expect(getTrace?._meta?.ui).toBeUndefined();

    const result = await client.callTool({ name: 'get_trace', arguments: { traceId: server.traceId } });
    expect(result._meta?.ui).toBeUndefined();
    expect(json(result).spans.length).toBeGreaterThan(0);
  });

  it("does not let the viewer read traces the caller can't", async () => {
    const client = await server.connect('runner', { rendersApps: true });

    const { tools } = await client.listTools();
    expect(tools.map(tool => tool.name)).not.toContain('get_trace');
    expect(tools.map(tool => tool.name)).not.toContain('get_span');
    // The viewer's own calls are tool calls, so it can't reach them either.
    await expect(
      client.callTool({ name: 'get_span', arguments: { traceId: server.traceId, spanId: 'x' } }),
    ).rejects.toThrow('Unknown tool: get_span');
  });
});

it('serves no apps with `server.mcp.apps: false`', async () => {
  const { connect } = await start({ apps: false });
  const client = await connect('tracer', { rendersApps: true });

  const { tools } = await client.listTools();
  expect(tools.find(tool => tool.name === 'get_trace')?._meta?.ui).toBeUndefined();
  await expect(client.readResource({ uri: TRACE_VIEWER })).rejects.toThrow();
});
