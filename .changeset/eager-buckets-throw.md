---
'@mastra/mcp-apps-components': minor
---

Added `createMcpApp`, which builds an MCP App from a prebuilt UI, the tool that opens it, and where its reads go. It replaces registering `dashboardRendererApp()` and spreading `observabilityAppTools`: the 11 observability tools are now one app-only data tool that `createMcpApp` registers for you. The `@mastra/mcp-apps-components/observability-tools` entry point is removed, and `dashboardRendererApp` is now `dashboardUi`.

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
import { createMcpApp } from '@mastra/mcp-apps-components';
import { dashboardUi } from '@mastra/mcp-apps-components/dashboard-renderer';

const dashboard = createMcpApp({
  ui: dashboardUi,
  tool: {
    id: 'showDashboard',
    description: 'Shows the agent runs dashboard',
    inputSchema: z.object({}),
    execute: () => ({ definition }),
  },
  prepareRequest: ({ path }) => ({ url: `http://localhost:4111/api${path}` }),
});

new MCPServer({
  // ...
  appResources: dashboard.appResources,
  tools: dashboard.tools,
});
```

`tool.execute` turns the model's request into the UI's input, typed against `dashboardUi.input`; you no longer link the tool to the `ui://` URI yourself. For each read the UI makes, `prepareRequest` returns the URL to send it to and any headers to add. The data tool sends the read over HTTP with the signed-in caller's bearer token, so the route's own validation and permission checks apply. Agents don't see it. The MCP server serving the dashboard no longer needs to be registered on a Mastra instance, and `@mastra/server` is no longer a peer dependency.

**Serving several projects**

Set `projectId` in the UI's input from `tool.execute`. The UI sends it with every read, and `prepareRequest` receives it, so a host serving several projects can check access, pick the server and add headers, or refuse with `{ response }`:

```ts
prepareRequest: async ({ path, projectId, token }) => {
  const project = projectId && (await findProjectFor(token, projectId));
  if (!project) return { response: { status: 403, body: { error: 'Not your project' } } };
  return { url: `${project.apiUrl}/api${path}`, headers: { 'x-mastra-project-id': project.id } };
},
```

**Reads with route parameters**

A UI declares its reads by name with their route, such as `getTrace: 'GET /observability/traces/:traceId'`, using `defineMcpAppUi`. `prepareRequest` receives the decoded `params` and the encoded `path`. The data tool refuses reads the UI doesn't declare and parameters that are empty, `.` or `..`.

**Clearer errors in dashboard widgets**

- If the data tool isn't registered, widgets say so and point to `createMcpApp`, instead of retrying and failing with a generic error.
- Invalid requests now fail once with the route's error message, instead of being retried and showing a raw JSON error.
