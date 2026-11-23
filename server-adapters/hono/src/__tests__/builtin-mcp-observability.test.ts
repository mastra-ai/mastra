import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { serve } from '@hono/node-server';
import { Agent } from '@mastra/core/agent';
import { Mastra } from '@mastra/core/mastra';
import { InMemoryStore, MastraCompositeStore } from '@mastra/core/storage';
import type { MastraStorage } from '@mastra/core/storage';
import { createMockModel } from '@mastra/core/test-utils/llm-mock';
import { DuckDBStore } from '@mastra/duckdb';
import { LibSQLStore } from '@mastra/libsql';
import { MCPClient } from '@mastra/mcp';
import { MastraStorageExporter, Observability } from '@mastra/observability';
import { Hono } from 'hono';
import { afterAll, describe, expect, it } from 'vitest';

import { MastraServer } from '../index';

const OBSERVABILITY = ['observability', 'observability_analytics'] as const;

type ToolResult = { isError?: boolean; content?: Array<{ text?: string }>; structuredContent?: any };

const dirs: string[] = [];
const cleanups: Array<() => Promise<void>> = [];

afterAll(async () => {
  for (const cleanup of cleanups.reverse()) await cleanup();
  await Promise.all(dirs.map(dir => rm(dir, { recursive: true, force: true })));
});

async function libsql() {
  const dir = await mkdtemp(join(tmpdir(), 'mcp-caps-'));
  dirs.push(dir);
  return new LibSQLStore({ id: 'mcp-caps', url: `file:${join(dir, 'mastra.db')}` });
}

/** Serves a Mastra whose observability domain is `observabilityStore`, after one traced agent run. */
async function start(name: string, makeStorage: () => Promise<MastraStorage>) {
  const storage = await makeStorage();
  const exporter = new MastraStorageExporter({ strategy: 'auto' });
  const mastra = new Mastra({
    logger: false,
    storage,
    agents: {
      helper: new Agent({
        id: 'helper',
        name: 'helper',
        description: 'Says hello',
        instructions: 'test',
        model: createMockModel({ mockText: 'hello' }),
      }),
    },
    observability: new Observability({ configs: { default: { serviceName: `mcp-${name}`, exporters: [exporter] } } }),
    // No auth in this test: turn the built-in MCP server on explicitly (it is dev-only by default).
    server: { mcp: { enabled: true } },
  });
  await mastra.getAgent('helper').generate('hi');
  await exporter.flush();

  const app = new Hono();
  await new MastraServer({ app, mastra }).init();
  const server = serve({ fetch: app.fetch, port: 0 });
  await new Promise(resolve => server.once('listening', resolve));
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('no address');
  const client = new MCPClient({
    id: `mcp-caps-${name}`,
    servers: {
      mastra: {
        url: new URL(`http://localhost:${address.port}/api/mcp?toolsets=${OBSERVABILITY}`),
        onToolError: 'return',
      },
    },
  });
  cleanups.push(async () => {
    await client.disconnect();
    await new Promise<void>(resolve => server.close(() => resolve()));
  });
  const listed = await client.listTools();
  const tools = Object.fromEntries(Object.entries(listed).map(([key, tool]) => [key.replace(/^mastra_/, ''), tool]));
  const call = async (tool: string, args: Record<string, unknown>) => {
    const result = (await tools[tool]!.execute!(args, {} as any)) as ToolResult;
    const text = (result.content ?? []).map(part => part.text ?? '').join('');
    if (result.isError) throw new Error(`${tool} failed: ${text}`);
    return result.structuredContent ?? (text ? JSON.parse(text) : result);
  };
  return { names: Object.keys(tools).sort(), tools, call, url: `http://localhost:${address.port}` };
}

/** The observability tools a store's capabilities allow — and every offered tool works against it (D17). */
describe('built-in MCP observability capability gating', () => {
  it('in-memory store: list_traces instead of the trace query tools', async () => {
    const { names, call } = await start('memory', async () => new InMemoryStore());
    expect(names).toEqual([
      'analyze_feedback',
      'analyze_metrics',
      'analyze_scores',
      'get_span',
      'get_trace',
      'get_trace_trajectory',
      'list_feedback',
      'list_logs',
      'list_metric_names',
      'list_scores',
      'list_traces',
    ]);

    const traces = await call('list_traces', {});
    const trace = traces.spans[0];
    expect(trace.traceId).toBeDefined();
    expect((await call('get_trace', { traceId: trace.traceId })).spans.length).toBeGreaterThan(0);
    expect((await call('get_span', { traceId: trace.traceId, spanId: trace.spanId })).span.spanId).toBe(trace.spanId);
    await call('get_trace_trajectory', { traceId: trace.traceId });
    await call('list_logs', {});
    await call('list_scores', {});
    await call('list_feedback', {});
    const { names: metricNames } = await call('list_metric_names', {});
    expect(Array.isArray(metricNames)).toBe(true);
  });

  it('LibSQL store: traces only', async () => {
    const { names, call } = await start('libsql', libsql);
    expect(names).toEqual(['get_span', 'get_trace', 'get_trace_trajectory', 'list_traces']);
    const traces = await call('list_traces', {});
    expect(traces.spans.length).toBeGreaterThan(0);
  });

  it('DuckDB store: trace query tools replace list_traces, and every tool answers', async () => {
    const { names, tools, call, url } = await start('duckdb', async () => {
      const duckdb = new DuckDBStore({ path: ':memory:' });
      return new MastraCompositeStore({
        id: 'composite',
        default: await libsql(),
        domains: { observability: await duckdb.getStore('observability') },
      });
    });
    expect(names).toEqual([
      'aggregate_spans',
      'aggregate_traces',
      'analyze_feedback',
      'analyze_metrics',
      'analyze_scores',
      'get_span',
      'get_trace',
      'get_trace_query_fields',
      'get_trace_query_values',
      'get_trace_trajectory',
      'list_feedback',
      'list_logs',
      'list_metric_names',
      'list_scores',
      'query_spans',
      'query_threads',
      'query_traces',
    ]);

    // Claude's API rejects tool schemas with top-level combinators; MCP requires `type: object`.
    for (const [name, tool] of Object.entries(tools)) {
      const schema = (tool.inputSchema as any)['~standard']?.jsonSchema?.input?.({ target: 'draft-07' });
      expect(schema?.type, name).toBe('object');
      for (const key of ['oneOf', 'anyOf', 'allOf', 'not']) expect(schema, `${name}.${key}`).not.toHaveProperty(key);
    }

    const timeRange = { from: new Date(Date.now() - 3_600_000).toISOString(), to: new Date().toISOString() };
    const { traces } = await call('query_traces', { timeRange });
    expect(traces.length).toBeGreaterThan(0);
    const traceId = traces[0].traceId;
    const { spans } = await call('get_trace', { traceId });
    await call('get_span', { traceId, spanId: spans[0].spanId });
    await call('get_trace_trajectory', { traceId });
    await call('query_spans', { timeRange });
    expect(await call('aggregate_traces', { timeRange, measures: ['count'] })).toBeDefined();
    await call('aggregate_spans', { timeRange, measures: ['count'] });
    await call('query_threads', { timeRange: { traces: timeRange } });
    await call('get_trace_query_fields', { timeRange, predicateScope: 'trace' });
    await call('get_trace_query_values', { timeRange, predicateScope: 'trace', path: 'entityName' });
    await call('list_logs', {});
    await call('list_scores', {});
    await call('list_feedback', {});
    await call('list_metric_names', {});
    for (const op of ['aggregate', 'breakdown', 'timeseries', 'percentiles']) {
      const extra = {
        aggregate: { aggregation: 'sum' },
        breakdown: { aggregation: 'sum', groupBy: ['entityName'] },
        timeseries: { aggregation: 'sum', interval: '1h' },
        percentiles: { percentiles: [0.5], interval: '1h' },
      }[op];
      const metric = 'mastra_model_total_input_tokens';
      await call('analyze_metrics', { op, name: op === 'percentiles' ? metric : [metric], ...extra });
      await call('analyze_scores', { op, scorerId: 'relevance', ...extra });
      await call('analyze_feedback', { op, feedbackType: 'rating', ...extra });
    }

    // D16: the size of the tools/list entries a client puts in its context, per toolset (~4 chars per token).
    const sizes: Record<string, number> = {};
    for (const toolset of OBSERVABILITY) {
      const response = await fetch(`${url}/api/mcp?toolsets=${toolset}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', accept: 'application/json, text/event-stream' },
        body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list' }),
      });
      const body = await response.text();
      const json = JSON.parse(body.startsWith('{') ? body : body.split('data: ')[1]!);
      const perTool = Object.fromEntries(
        json.result.tools.map((tool: any) => [tool.name, Math.round(JSON.stringify(tool).length / 4)]),
      );
      sizes[toolset] = Math.round(JSON.stringify(json.result.tools).length / 4);
      console.info(`[D16] ${toolset} ≈ ${sizes[toolset]} tokens`, perTool);
      // Some clients reject a bare boolean where a schema is expected (2020-12 closed tuples emit `items: false`).
      expect(JSON.stringify(json.result.tools), toolset).not.toMatch(/"(items|additionalItems)":false/);
    }
    expect(sizes.observability).toBeLessThan(8000);
  });
});
