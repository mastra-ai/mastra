---
'@mastra/mcp-apps-components': patch
---

Added `@mastra/mcp-apps-components`, prebuilt MCP Apps that render Mastra UI inside any MCP App host such as Mastra Studio. The first app, `dashboardRendererApp`, renders a Mastra dashboard definition with live observability data.

Register the app on an `MCPServer`, then link a tool to the app's `ui://` URI:

```ts
import { MCPServer } from '@mastra/mcp';
import { dashboardRendererApp } from '@mastra/mcp-apps-components/dashboard-renderer';
import { observabilityAppTools } from './observability-tools';

export const dashboardServer = new MCPServer({
  id: 'dashboard-server',
  name: 'Dashboard Server',
  version: '1.0.0',
  appResources: { 'ui://mastra/dashboard': dashboardRendererApp() },
  tools: { showDashboard, ...observabilityAppTools },
});
```

The app never reaches the network from its iframe. It reads data by calling app-only tools that you register on the same server. `@mastra/mcp-apps-components/observability-protocol` exports the contract for those tools: `OBSERVABILITY_APP_TOOLS` names each tool and the observability route it reads, and `routeQuerySchema` and `routeResponseSchema` describe its input and output.
