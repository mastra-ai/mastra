/**
 * Steering an open observability explorer through the built-in MCP server, served by real Mastras over HTTP:
 * the model changes what a view shows, the view (polling through its app-only tool) sees the change, and the
 * user's own changes come back to the model. Two server instances share one cache, as they would share Redis.
 */
import { serve } from '@hono/node-server';
import { Agent } from '@mastra/core/agent';
import { MastraServerCache } from '@mastra/core/cache';
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
const STEER = 'steer_observability_view';
const SYNC = 'sync_observability_view';
const PERMISSIONS = ['mcp:read', 'mcp:execute', 'observability:read'];

/** A cache that, like Redis, holds serialized values one process doesn't own: several servers can share it. */
class SharedCache extends MastraServerCache {
  private readonly values = new Map<string, string>();
  constructor() {
    super({ name: 'SharedCache' });
  }
  async get(key: string) {
    const value = this.values.get(key);
    return value === undefined ? null : JSON.parse(value);
  }
  async set(key: string, value: unknown) {
    this.values.set(key, JSON.stringify(value));
  }
  async delete(key: string) {
    this.values.delete(key);
  }
  async clear() {
    this.values.clear();
  }
  async listLength(key: string) {
    return ((await this.get(key)) ?? []).length;
  }
  async listPush(key: string, value: unknown) {
    await this.set(key, [...((await this.get(key)) ?? []), value]);
  }
  async listFromTo(key: string, from: number, to?: number) {
    return ((await this.get(key)) ?? []).slice(from, to === undefined ? undefined : to + 1);
  }
  async increment(key: string) {
    const next = ((await this.get(key)) ?? 0) + 1;
    await this.set(key, next);
    return next;
  }
}

const cleanups: Array<() => Promise<void>> = [];
afterAll(async () => {
  for (const cleanup of cleanups.reverse()) await cleanup();
});

/** Serves a Mastra with one recorded agent run; signed-in users are their bearer token. */
async function start(mcp: ServerMCPConfig, cache?: MastraServerCache) {
  const exporter = new MastraStorageExporter({ strategy: 'auto' });
  const mastra = new Mastra({
    logger: false,
    ...(cache ? { cache } : {}),
    storage: new MastraCompositeStore({
      id: 'mcp-steering',
      default: new InMemoryStore(),
      domains: { observability: await new DuckDBStore({ path: ':memory:' }).getStore('observability') },
    }),
    agents: {
      helper: new Agent({
        id: 'helper',
        name: 'helper',
        instructions: 'test',
        model: createMockModel({ mockText: 'hi' }),
      }),
    },
    observability: new Observability({ configs: { default: { serviceName: 'steering', exporters: [exporter] } } }),
    server: {
      mcp,
      auth: {
        authenticateToken: async (token: string) => ({ id: token, role: 'user' }),
        authorize: async () => true,
      },
      rbac: { getPermissions: async () => PERMISSIONS, getRoles: async () => ['user'] },
    } as never,
  });
  await mastra.getAgent('helper').generate('hi');
  await exporter.flush();
  const { spans } = await (await mastra.getStorage()!.getStore('observability'))!.listTraces({});
  const traceId = spans[0]!.traceId;

  const app = new Hono();
  await new MastraServer({ app, mastra }).init();
  const server = serve({ fetch: app.fetch, port: 0 });
  await new Promise(resolve => server.once('listening', resolve));
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('no address');
  cleanups.push(() => new Promise<void>(resolve => server.close(() => resolve())));

  const connect = async (user: string, { rendersApps = true } = {}) => {
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
        requestInit: { headers: { Authorization: `Bearer ${user}` } },
      }),
    );
    cleanups.push(() => client.close());
    return client;
  };
  return { connect, traceId };
}

type Result = Awaited<ReturnType<Client['callTool']>>;
const text = (result: Result) => (result.content as { text: string }[])[0]!.text;
const json = (result: Result) => (result.structuredContent ?? JSON.parse(text(result))) as Record<string, any>;
const HOUR = 60 * 60 * 1000;
const lastDay = () => ({ from: new Date(Date.now() - 24 * HOUR).toISOString(), to: new Date().toISOString() });

/** Opens the explorer the way the model does, returning the view id the server gave it. */
async function openExplorer(client: Client) {
  const opened = await client.callTool({ name: 'query_traces', arguments: { timeRange: lastDay() } });
  const viewId = opened._meta?.['mastra/viewId'];
  expect(viewId).toEqual(expect.any(String));
  return { opened, viewId: viewId as string };
}

describe('steering an open observability explorer', () => {
  let server: Awaited<ReturnType<typeof start>>;
  beforeAll(async () => {
    server = await start({ appSteering: true });
  });

  it('tells the model the view id, lets it change the view, and the view picks the change up', async () => {
    const model = await server.connect('ada');
    const { opened, viewId } = await openExplorer(model);
    expect(text(opened)).toContain(`call ${STEER} with viewId "${viewId}"`);

    // The view polls; nothing has changed yet.
    expect(json(await model.callTool({ name: SYNC, arguments: { viewId, since: 0 } }))).toEqual({ version: 0 });

    const steered = await model.callTool({
      name: STEER,
      arguments: { viewId, tool: 'list_logs', args: { level: 'error' }, traceId: server.traceId },
    });
    expect(steered.isError).toBeFalsy();
    // The model reads what the view now shows: its description, the logs it lists, and the trace.
    expect(text(steered)).toContain(`View ${viewId} shows the list_logs result for {"level":"error"}`);
    expect(text(steered)).toContain(`with trace ${server.traceId} open`);
    // Steering is no app link: the host renders no new view for it.
    expect(steered._meta?.ui).toBeUndefined();

    expect(json(await model.callTool({ name: SYNC, arguments: { viewId, since: 0 } }))).toEqual({
      version: 1,
      by: 'model',
      state: { tool: 'list_logs', args: { level: 'error' }, traceId: server.traceId },
    });
    expect(json(await model.callTool({ name: SYNC, arguments: { viewId, since: 1 } }))).toEqual({ version: 1 });
  });

  it('refuses arguments the tool would refuse, leaving the view as it was', async () => {
    const model = await server.connect('ada');
    const { viewId } = await openExplorer(model);
    const bad = await model.callTool({ name: STEER, arguments: { viewId, tool: 'query_traces', args: {} } });
    expect(bad.isError).toBe(true);
    expect(json(await model.callTool({ name: SYNC, arguments: { viewId, since: 0 } }))).toEqual({ version: 0 });
  });

  it("gives the model the user's changes, and doesn't let a stale one undo the model's", async () => {
    const model = await server.connect('ada');
    const { viewId } = await openExplorer(model);

    // The user filters the list in the view, which reports it.
    const reported = await model.callTool({
      name: SYNC,
      arguments: { viewId, base: 0, state: { context: 'The trace list is filtered to status error.' } },
    });
    expect(json(reported)).toEqual({ version: 1 });
    // A report of only what's on screen keeps the change the model's; the model reads what's on screen.
    const read = text(await model.callTool({ name: STEER, arguments: { viewId } }));
    expect(read).toContain('Last changed by you.');
    expect(read).toContain('On screen now: The trace list is filtered to status error.');
    // Reporting the same again changes nothing.
    await model.callTool({
      name: SYNC,
      arguments: { viewId, base: 1, state: { context: 'The trace list is filtered to status error.' } },
    });
    expect(text(await model.callTool({ name: STEER, arguments: { viewId } }))).toContain('Last changed by you.');

    // The user removes the filter: only what's on screen changes, but the user changed it.
    await model.callTool({
      name: SYNC,
      arguments: { viewId, base: 2, state: { context: 'The trace list is unfiltered.' } },
    });
    expect(text(await model.callTool({ name: STEER, arguments: { viewId } }))).toContain(
      'the user has changed it in the view since.\nOn screen now: The trace list is unfiltered.',
    );

    // The model changes the view; a report the view made against the old version is refused.
    const metrics = await model.callTool({
      name: STEER,
      arguments: { viewId, tool: 'analyze_metrics', args: lastMetrics() },
    });
    expect(metrics.isError, text(metrics)).toBeFalsy();
    const stale = await model.callTool({
      name: SYNC,
      arguments: { viewId, base: 3, state: { context: 'The trace list is unfiltered.' } },
    });
    expect(stale.isError).toBe(true);
    expect(text(stale)).toContain('changed since version 3');
    expect(json(await model.callTool({ name: SYNC, arguments: { viewId, since: 3 } }))).toMatchObject({
      version: 4,
      by: 'model',
      state: { tool: 'analyze_metrics' },
    });
  });

  it("doesn't let another user read or change a view", async () => {
    const { viewId } = await openExplorer(await server.connect('ada'));
    const other = await server.connect('bob');
    for (const [name, args] of [
      [STEER, { viewId }],
      [SYNC, { viewId, since: 0 }],
      [SYNC, { viewId, base: 0, state: { context: 'mine now' } }],
    ] as const) {
      const result = await other.callTool({ name, arguments: args });
      expect(result.isError).toBe(true);
      // Exactly as for a view that doesn't exist, so view ids can't be probed.
      expect(text(result)).toContain(`No open view ${viewId}`);
    }
  });

  it("offers clients that don't render apps no view ids and no steering", async () => {
    const client = await server.connect('ada', { rendersApps: false });
    expect((await client.listTools()).tools.map(t => t.name)).not.toContain(STEER);
    const result = await client.callTool({ name: 'query_traces', arguments: { timeRange: lastDay() } });
    expect(result._meta?.['mastra/viewId']).toBeUndefined();
    await expect(client.callTool({ name: STEER, arguments: { viewId: 'x' } })).rejects.toThrow(
      `Unknown tool: ${STEER}`,
    );
  });
});

function lastMetrics() {
  return {
    op: 'aggregate',
    name: ['mastra_agent_duration_ms'],
    aggregation: 'avg',
    filters: { timestamp: { start: lastDay().from } },
  };
}

it('steers a view on one server instance that another instance opened, through a shared cache', async () => {
  const cache = new SharedCache();
  // Not under `mastra dev`: steering is on because the cache is shared.
  const first = await start({}, cache);
  const second = await start({}, cache);
  const { viewId } = await openExplorer(await first.connect('ada'));

  await (
    await second.connect('ada')
  ).callTool({
    name: STEER,
    arguments: { viewId, tool: 'list_logs', args: {} },
  });
  expect(
    json(await (await first.connect('ada')).callTool({ name: SYNC, arguments: { viewId, since: 0 } })),
  ).toMatchObject({
    version: 1,
    by: 'model',
    state: { tool: 'list_logs' },
  });
});

it("doesn't offer steering on a single process's in-memory cache outside `mastra dev`", async () => {
  const client = await (await start({})).connect('ada');
  expect((await client.listTools()).tools.map(t => t.name)).not.toContain(STEER);
  const result = await client.callTool({ name: 'query_traces', arguments: { timeRange: lastDay() } });
  expect(result._meta?.['mastra/viewId']).toBeUndefined();
  expect(text(result)).not.toContain(STEER);
});
