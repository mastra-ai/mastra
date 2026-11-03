import { Agent } from '@mastra/core/agent';
import { MCPClient, MCPServer } from '@mastra/mcp';
import { dashboardRendererApp } from '@mastra/mcp-apps-components';
import { DASHBOARD_APP_URI, MASTRA_SERVER_URL, showObservabilityDashboard } from './dashboard-tools';

const DASHBOARD_SERVER_ID = 'dashboard-mcp-server';

// Serves the prebuilt dashboard renderer as an MCP App. Its iframe reads metrics straight from
// this Mastra server, so the CSP has to allow connecting to it.
export const dashboardMcpServer = new MCPServer({
  id: DASHBOARD_SERVER_ID,
  name: 'Dashboard MCP Server',
  version: '1.0.0',
  appResources: {
    [DASHBOARD_APP_URI]: dashboardRendererApp({ connectDomains: [MASTRA_SERVER_URL] }),
  },
  tools: { showObservabilityDashboard },
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
The dashboard renders live in the chat, so don't repeat numbers; say in one sentence what it shows and how to read it.`,
  model: 'openai/gpt-5-mini',
  tools: () => dashboardMcpClient.listTools(),
});
