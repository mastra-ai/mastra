import { Agent } from '@mastra/core/agent';
import { MCPClient, MCPServer } from '@mastra/mcp';
import { Memory } from '@mastra/memory';
import { createMcpApp } from '@mastra/mcp-apps-components';
import { dashboardUi } from '@mastra/mcp-apps-components/dashboard-renderer';
import { showObservabilityDashboard } from './dashboard-tools';

const DASHBOARD_SERVER_ID = 'dashboard-mcp-server';
// This Mastra server, which the agent reaches over HTTP like any MCP client. `mastra dev` falls back to
// another port when 4111 is taken and passes the one it bound as PORT.
const MASTRA_SERVER_URL = process.env.MASTRA_BASE_URL ?? `http://localhost:${process.env.PORT ?? 4111}`;

// Serves the prebuilt dashboard UI as an MCP App. Its iframe never reaches the network: it reads
// metrics through an app-only data tool, which agents don't see, and which sends each read to this
// Mastra server's observability API as the signed-in caller.
const dashboard = createMcpApp({
  ui: dashboardUi,
  tool: showObservabilityDashboard,
  prepareRequest: ({ path }) => ({ url: `${MASTRA_SERVER_URL}/api${path}` }),
});

export const dashboardMcpServer = new MCPServer({
  id: DASHBOARD_SERVER_ID,
  name: 'Dashboard MCP Server',
  version: '1.0.0',
  appResources: dashboard.appResources,
  tools: dashboard.tools,
});

// Consumes the server above over HTTP, as any MCP client would. The server key matches the
// server id so Studio maps the namespaced tool (`dashboard-mcp-server_showObservabilityDashboard`)
// back to its ui:// app.
const dashboardMcpClient = new MCPClient({
  id: 'dashboard-mcp-client',
  servers: {
    [DASHBOARD_SERVER_ID]: { url: new URL(`/api/mcp/${DASHBOARD_SERVER_ID}/mcp`, MASTRA_SERVER_URL) },
  },
});

export const dashboardAgent = new Agent({
  id: 'dashboard-agent',
  name: 'Dashboard Agent',
  description: 'Answers questions about how this Mastra project is doing by showing a live observability dashboard.',
  instructions: `You help users understand how their Mastra agents are doing: runs, failures, model cost, tokens and latency.
When asked about any of these, call the dashboard tool with only the sections the user asked for (one chart means one section) and a matching time range.
Charts are stacked bars or lines only; pass the chart type the user asks for. If they ask for anything else, say it isn't supported.
The dashboard renders live in the chat, so don't repeat numbers; say in one sentence what it shows and how to read it.`,
  model: 'openai/gpt-5-mini',
  memory: new Memory(),
  tools: () => dashboardMcpClient.listTools(),
});
