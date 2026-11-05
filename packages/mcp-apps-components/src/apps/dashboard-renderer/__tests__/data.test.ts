// @vitest-environment node
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import { createTool } from '@mastra/core/tools';
import { MCPClient, MCPServer } from '@mastra/mcp';
import { afterEach, describe, expect, it } from 'vitest';
import { DASHBOARD_DATA_TOOL_NAME, dashboardDataInputSchema, dashboardDataOutputSchema } from '../data';

const closers: Array<() => Promise<void>> = [];
afterEach(async () => {
  await Promise.all(closers.splice(0).map(close => close()));
});

async function serve(server: MCPServer) {
  const httpServer = http.createServer(async (req, res) => {
    await server.startHTTP({ url: new URL(req.url ?? '', 'http://localhost'), httpPath: '/mcp', req, res });
  });
  await new Promise<void>(resolve => httpServer.listen(0, '127.0.0.1', resolve));
  closers.push(() => new Promise(resolve => httpServer.close(() => resolve())));
  return new URL(`http://127.0.0.1:${(httpServer.address() as AddressInfo).port}/mcp`);
}

describe('the dashboard data tool contract', () => {
  it('describes a tool an MCP client can list', async () => {
    const dataTool = createTool({
      id: DASHBOARD_DATA_TOOL_NAME,
      description: 'Reads observability data for the dashboard app.',
      inputSchema: dashboardDataInputSchema,
      outputSchema: dashboardDataOutputSchema,
      execute: async () => ({ status: 200, body: {} }),
    });
    const server = new MCPServer({
      id: 'dashboard',
      name: 'Dashboard',
      version: '1.0.0',
      tools: { [DASHBOARD_DATA_TOOL_NAME]: dataTool },
    });
    const client = new MCPClient({ servers: { dashboard: { url: await serve(server) } } });
    closers.unshift(() => client.disconnect());

    const tools = await client.listTools();

    expect(Object.keys(tools)).toEqual([`dashboard_${DASHBOARD_DATA_TOOL_NAME}`]);
  });

  it('only takes each operation with the arguments MastraClient sends for it', () => {
    expect(dashboardDataInputSchema.safeParse({ operation: 'listScores', query: { page: '0' } }).success).toBe(true);
    expect(dashboardDataInputSchema.safeParse({ operation: 'getMetricAggregate', body: {} }).success).toBe(true);
    expect(dashboardDataInputSchema.safeParse({ operation: 'listScores', body: {} }).success).toBe(false);
    expect(dashboardDataInputSchema.safeParse({ operation: 'getMetricAggregate', query: {} }).success).toBe(false);
  });

  it('takes a project to read, but not an empty one', () => {
    const read = { operation: 'getMetricAggregate', body: {} } as const;

    expect(dashboardDataInputSchema.parse({ ...read, projectId: 'proj_1' })).toEqual({ ...read, projectId: 'proj_1' });
    expect(dashboardDataInputSchema.safeParse({ ...read, projectId: '' }).success).toBe(false);
  });
});
