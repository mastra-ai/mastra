---
'@mastra/mcp-apps-components': minor
---

Replaced the 11 observability tools with one data tool. Register `dashboardDataTool` next to the dashboard app instead of spreading `observabilityAppTools`. The `@mastra/mcp-apps-components/observability-tools` entry point is removed.

**Before**

```ts
import { dashboardRendererApp } from '@mastra/mcp-apps-components/dashboard-renderer';
import { observabilityAppTools } from '@mastra/mcp-apps-components/observability-tools';

new MCPServer({
  // ...
  appResources: { 'ui://mastra/dashboard': dashboardRendererApp() },
  tools: { showDashboard, ...observabilityAppTools },
});
```

**After**

```ts
import { dashboardDataTool } from '@mastra/mcp-apps-components/dashboard-data-tool';
import { dashboardRendererApp } from '@mastra/mcp-apps-components/dashboard-renderer';

new MCPServer({
  // ...
  appResources: { 'ui://mastra/dashboard': dashboardRendererApp() },
  tools: { showDashboard, dashboardDataTool },
});
```

As before, the tool runs each observability route as the signed-in caller, with the route's own validation and permission checks, and agents don't see it.

**Clearer errors in dashboard widgets**

- If `dashboardDataTool` isn't registered, widgets say so and show how to register it, instead of retrying and failing with a generic error.
- Invalid requests now fail once with the route's error message, instead of being retried and showing a raw JSON error.

`@mastra/server` is now an optional peer dependency. Only `@mastra/mcp-apps-components/dashboard-data-tool` needs it.

**Answering the reads yourself**

Hosts that answer the dashboard's reads themselves can import the contract from `@mastra/mcp-apps-components/dashboard-renderer` without installing `@mastra/server`: `DASHBOARD_DATA_TOOL_NAME`, `DASHBOARD_DATA_OPERATIONS`, `DASHBOARD_DATA_REQUESTS`, `dashboardDataInputSchema`, and `dashboardDataOutputSchema`.

Set `projectId` in the dashboard's tool result to tell such a host which project to read. The app sends it as `projectId` on every data tool call:

```ts
execute: async () => ({ definition, scope: 'project' as const, projectId: 'proj_123' }),
```
