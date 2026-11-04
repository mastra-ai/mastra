---
'@mastra/mcp-apps-components': patch
---

Added `@mastra/mcp-apps-components`, prebuilt MCP Apps that render Mastra UI inside any MCP App host such as Mastra Studio. The first app, `dashboardRendererApp`, renders a Mastra dashboard definition with live observability data.

Register the app on an `MCPServer`, then link a tool to the app's `ui://` URI:

```ts
import { MCPServer } from '@mastra/mcp';
import { dashboardRendererApp } from '@mastra/mcp-apps-components/dashboard-renderer';
import { mastraRequestTool } from './request-tool';

export const dashboardServer = new MCPServer({
  id: 'dashboard-server',
  name: 'Dashboard Server',
  version: '1.0.0',
  appResources: { 'ui://mastra/dashboard': dashboardRendererApp() },
  tools: { showDashboard, [mastraRequestTool.id]: mastraRequestTool },
});
```

The app never reaches the network from its iframe. Each request it makes, such as `POST /observability/metrics/aggregate`, travels as a call to one app-only tool that you register on the same server. `@mastra/mcp-apps-components/request-tool` exports the contract for that tool: `REQUEST_TOOL_NAME` names it, `requestToolInputSchema` describes the request it receives, and `requestToolOutputSchema` describes the route's status and body it returns. The server decides which routes the tool answers.
