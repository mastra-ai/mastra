---
'@mastra/mcp-apps-components': patch
---

Added `@mastra/mcp-apps-components`, prebuilt MCP Apps that render Mastra UI inside any MCP App host such as Mastra Studio. The first app, `dashboardRendererApp`, renders a Mastra dashboard definition with live observability data.

Register the app and `observabilityAppTools` on an `MCPServer`, then link a tool to the app's `ui://` URI:

```ts
import { MCPServer } from '@mastra/mcp';
import { dashboardRendererApp } from '@mastra/mcp-apps-components/dashboard-renderer';
import { observabilityAppTools } from '@mastra/mcp-apps-components/observability-tools';

export const dashboardServer = new MCPServer({
  id: 'dashboard-server',
  name: 'Dashboard Server',
  version: '1.0.0',
  appResources: { 'ui://mastra/dashboard': dashboardRendererApp() },
  tools: { showDashboard, ...observabilityAppTools },
});
```

The app never reaches the network from its iframe. It reads data through the observability tools, which only apps can call and agents don't see. Each tool runs its observability route as the signed-in caller, with the route's own validation and permission checks.
