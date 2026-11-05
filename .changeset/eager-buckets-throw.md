---
'@mastra/mcp-apps-components': minor
---

Replaced the 11 observability tools with one data tool. Create it with `createDashboardDataTool({ prepareRequest })` and register it as `dashboardDataTool` next to the dashboard app, instead of spreading `observabilityAppTools`. The `@mastra/mcp-apps-components/observability-tools` entry point is removed.

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
import { createDashboardDataTool } from '@mastra/mcp-apps-components/dashboard-data-tool';
import { dashboardRendererApp } from '@mastra/mcp-apps-components/dashboard-renderer';

new MCPServer({
  // ...
  appResources: { 'ui://mastra/dashboard': dashboardRendererApp() },
  tools: {
    showDashboard,
    dashboardDataTool: createDashboardDataTool({
      prepareRequest: ({ path }) => ({ url: `http://localhost:4111/api${path}` }),
    }),
  },
});
```

For each read, `prepareRequest` returns the URL to send it to and any headers to add. The tool sends the read over HTTP with the signed-in caller's bearer token, so the route's own validation and permission checks apply. Agents don't see it. The MCP server serving the dashboard no longer needs to be registered on a Mastra instance.

**Clearer errors in dashboard widgets**

- If `dashboardDataTool` isn't registered, widgets say so and show how to register it, instead of retrying and failing with a generic error.
- Invalid requests now fail once with the route's error message, instead of being retried and showing a raw JSON error.

`@mastra/server` is no longer a peer dependency.

**Answering the reads yourself**

Hosts that answer the dashboard's reads themselves can import the contract from `@mastra/mcp-apps-components/dashboard-renderer`: `DASHBOARD_DATA_TOOL_NAME`, `DASHBOARD_DATA_OPERATIONS`, `DASHBOARD_DATA_REQUESTS`, `dashboardDataInputSchema`, and `dashboardDataOutputSchema`.

Set `projectId` in the dashboard's tool result to read a given project. The app sends it on every data tool call, and `prepareRequest` receives it, so a host serving several projects can check access, pick the server and add headers, or refuse with `{ response }`:

```ts
execute: async () => ({ definition, scope: 'project' as const, projectId: 'proj_123' }),
```
