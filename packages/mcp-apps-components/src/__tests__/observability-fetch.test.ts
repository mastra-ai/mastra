import { MastraClient } from '@mastra/client-js';
import { createTool } from '@mastra/core/tools';
import { MCPServer } from '@mastra/mcp';
import type { App } from '@modelcontextprotocol/ext-apps';
import { afterEach, expect, it } from 'vitest';
import { z } from 'zod';
import { createMcpFetch } from '../shared/mcp-fetch';
import type { OpenedTraceFilter } from '../shared/mcp-fetch';
import { serveAndConnect } from './greeting-server';

type Args = Record<string, unknown>;

const hosts: Awaited<ReturnType<typeof serveAndConnect>>[] = [];
afterEach(async () => {
  await Promise.all(hosts.splice(0).map(host => host.close()));
});

/** The observability tools the logs and metrics tabs use, recording what they're called with. */
function observabilityServer(answers: Record<string, unknown>) {
  const calls: { tool: string; args: Args }[] = [];
  const tool = (id: string) =>
    createTool({
      id,
      description: id,
      inputSchema: z.object({}).passthrough(),
      execute: async args => {
        calls.push({ tool: id, args: args as Args });
        return answers[id] ?? {};
      },
    });
  const names = [
    'list_logs',
    'analyze_metrics',
    'list_metric_names',
    'list_observability_values',
    'get_observability_capabilities',
  ];
  const server = new MCPServer({
    id: 'observability',
    name: 'Observability',
    version: '1.0.0',
    tools: Object.fromEntries(names.map(name => [name, tool(name)])),
  });
  return { server, calls };
}

/** Studio's client, its requests served by a real MCP server's tools over a connected client. */
async function studioClient(mcp: ReturnType<typeof observabilityServer>, opened?: OpenedTraceFilter) {
  const host = await serveAndConnect(mcp.server);
  hosts.push(host);
  const app = { callServerTool: (params: { name: string }) => host.client.callTool(params) } as unknown as App;
  return new MastraClient({ baseUrl: 'http://app', retries: 0, fetch: createMcpFetch(app, () => opened) });
}

it('lists logs with the opened query’s filters, letting the page’s own filters win', async () => {
  const mcp = observabilityServer({ list_logs: { logs: [], pagination: { total: 0, page: 0, perPage: 5 } } });
  const client = await studioClient(mcp, { logs: { level: 'error', entityName: 'support-agent' } });

  await client.listLogsVNext({ filters: { level: 'warn' }, pagination: { page: 0, perPage: 5 } });

  expect(mcp.calls).toEqual([
    { tool: 'list_logs', args: { level: 'warn', entityName: 'support-agent', page: 0, perPage: 5 } },
  ]);
});

it('analyzes metrics with the op named by Studio’s route', async () => {
  const mcp = observabilityServer({ analyze_metrics: { series: [] } });
  const client = await studioClient(mcp);

  await client.getMetricTimeSeries({ name: ['mastra_agent_duration_ms'], aggregation: 'count', interval: '1h' });

  expect(mcp.calls).toEqual([
    {
      tool: 'analyze_metrics',
      args: { op: 'timeseries', name: ['mastra_agent_duration_ms'], aggregation: 'count', interval: '1h' },
    },
  ]);
});

it('serves discovery from the values and metric-name tools', async () => {
  const mcp = observabilityServer({ list_observability_values: { names: ['support-agent'] } });
  const client = await studioClient(mcp);

  await expect(client.getEntityNames({ entityType: 'agent' as never })).resolves.toEqual({ names: ['support-agent'] });
  await client.getTags();
  await client.getMetricLabelValues({ metricName: 'mastra_model_total_input_tokens', labelKey: 'model' });

  expect(mcp.calls).toEqual([
    { tool: 'list_observability_values', args: { kind: 'entityNames', entityType: 'agent' } },
    { tool: 'list_observability_values', args: { kind: 'tags' } },
    { tool: 'list_metric_names', args: { metricName: 'mastra_model_total_input_tokens', labelKey: 'model' } },
  ]);
});

it('offers logs and metrics only when the store supports them and the caller’s tools serve them', async () => {
  const capabilities = { logs: true, metrics: true, deltaPolling: true, traceQuery: true };
  const mcp = observabilityServer({
    get_observability_capabilities: {
      observabilityStorageType: 'DuckDB',
      capabilities,
      tools: { logs: false, metrics: true },
    },
  });
  const client = await studioClient(mcp);

  const result = await client.getObservabilityCapabilities();

  expect(result.capabilities).toMatchObject({ logs: false, metrics: true, deltaPolling: false, traceQuery: true });
  expect(result).not.toHaveProperty('tools');
});

/**
 * `list_logs` over 15 logs, cutting any page past `fits` rows as the built-in server does when rows don't fit in
 * one tool result: it keeps the first rows, says it cut them, and drops the pagination.
 */
function cuttingLogsServer(fits: number) {
  const logs = Array.from({ length: 15 }, (_, index) => ({ message: `log ${index}`, level: 'info' }));
  const calls: Args[] = [];
  const server = new MCPServer({
    id: 'observability',
    name: 'Observability',
    version: '1.0.0',
    tools: {
      list_logs: createTool({
        id: 'list_logs',
        description: 'list_logs',
        inputSchema: z.object({ page: z.number().int(), perPage: z.number().int() }).passthrough(),
        execute: async ({ page, perPage }) => {
          calls.push({ page, perPage });
          const rows = logs.slice(page * perPage, (page + 1) * perPage);
          if (rows.length > fits) {
            return { logs: rows.slice(0, fits), truncated: `Only the first ${fits} of ${rows.length} logs fit.` };
          }
          const hasMore = (page + 1) * perPage < logs.length;
          return { logs: rows, pagination: { total: logs.length, page, perPage, hasMore } };
        },
      }),
    },
  });
  return { server, calls };
}

it('reads the rest of a log page the server cut to fit, keeping the page Studio asked for', async () => {
  const mcp = cuttingLogsServer(4);
  const client = await studioClient(mcp as unknown as ReturnType<typeof observabilityServer>);

  const first = await client.listLogsVNext({ pagination: { page: 0, perPage: 10 } });
  expect(first.logs.map(log => log.message)).toEqual(Array.from({ length: 10 }, (_, index) => `log ${index}`));
  expect(first.pagination).toMatchObject({ page: 0, perPage: 10, hasMore: true });

  const second = await client.listLogsVNext({ pagination: { page: 1, perPage: 10 } });
  expect(second.logs.map(log => log.message)).toEqual(['log 10', 'log 11', 'log 12', 'log 13', 'log 14']);
  expect(second.pagination).toMatchObject({ page: 1, perPage: 10, hasMore: false });
  // Page 1 of 10, cut to 4 rows, is read as pages of 2 (the largest divisor of 10 that fits), from row 10 until
  // the logs run out.
  expect(mcp.calls.slice(-4)).toEqual([
    { page: 1, perPage: 10 },
    { page: 5, perPage: 2 },
    { page: 6, perPage: 2 },
    { page: 7, perPage: 2 },
  ]);
});
