import type { App } from '@modelcontextprotocol/ext-apps';
import { afterEach, expect, it } from 'vitest';
import { createMcpFetch } from '../shared/mcp-fetch';
import { serveAndConnect } from './greeting-server';
import { traceServer, traceSpans } from './trace-server';

const hosts: Awaited<ReturnType<typeof serveAndConnect>>[] = [];
afterEach(async () => {
  await Promise.all(hosts.splice(0).map(host => host.close()));
});

/** Studio's requests, served by a real MCP server's tools over a connected client, as the host relays them. */
async function mcpFetch(mcp: ReturnType<typeof traceServer>) {
  const host = await serveAndConnect(mcp.server);
  hosts.push(host);
  const app = { callServerTool: (params: { name: string }) => host.client.callTool(params) } as unknown as App;
  return createMcpFetch(app, () => undefined);
}

// Studio's thread views read every span's payload (`client.getTrace`), which no single tool returns.
it('serves a full trace from the light trace and each span in full', async () => {
  const mcp = traceServer({ pageSize: 2 });
  const fetch = await mcpFetch(mcp);

  const response = await fetch('http://app/api/observability/traces/trace-1');

  expect(response.status).toBe(200);
  const trace = (await response.json()) as { traceId: string; spans: Record<string, unknown>[] };
  expect(trace.traceId).toBe('trace-1');
  expect(trace.spans.map(span => span.spanId)).toEqual(traceSpans.map(span => span.spanId));
  for (const span of trace.spans) expect(span.output).toEqual({ forecast: 'Sunny, 24°C' });
  expect(mcp.calls.filter(call => call.tool === 'get_trace')).toHaveLength(2);
});

it('answers routes no tool serves with a 404', async () => {
  const fetch = await mcpFetch(traceServer());

  const response = await fetch('http://app/api/memory/threads/thread-1');

  expect(response.status).toBe(404);
});
