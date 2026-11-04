---
'@mastra/mcp-apps-components': patch
---

Added `@mastra/mcp-apps-components`, prebuilt MCP Apps that render Mastra UI inside any MCP App host such as Mastra Studio. The first app, `dashboardRendererApp`, renders a Mastra dashboard definition with live observability data.

Register the app on an `MCPServer`, then link a tool to the app's `ui://` URI:

```ts
import { MCPServer } from '@mastra/mcp';
import { dashboardRendererApp } from '@mastra/mcp-apps-components/dashboard-renderer';
import { dashboardDataTool } from './dashboard-data-tool';

export const dashboardServer = new MCPServer({
  id: 'dashboard-server',
  name: 'Dashboard Server',
  version: '1.0.0',
  appResources: { 'ui://mastra/dashboard': dashboardRendererApp() },
  tools: { showDashboard, [dashboardDataTool.id]: dashboardDataTool },
});
```

The app never reaches the network from its iframe. Each read it makes, such as `getMetricAggregate`, travels as a call to one app-only data tool that you register on the same server. `@mastra/mcp-apps-components/dashboard-renderer` exports the contract for that tool: `DASHBOARD_DATA_TOOL_NAME` names it, `DASHBOARD_DATA_OPERATIONS` lists the reads it answers, `dashboardDataInputSchema` describes the call it receives, and `dashboardDataOutputSchema` describes the status and body it returns. The server decides how it answers each read.
