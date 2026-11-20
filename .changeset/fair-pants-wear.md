---
'@mastra/mcp-apps-components': minor
---

The observability dashboard can now read a single project's data in chat clients that don't pass a project, such as Claude and ChatGPT. Previously, their reads carried no project, so they covered whatever scope the server fell back to, often every project it could access. Return the dashboard's project id as `project` next to the dashboard. A project passed by the host page still wins. Pins and settings clicks now report the project each widget read.

```ts
const showObservabilityDashboard = createTool({
  id: 'showObservabilityDashboard',
  inputSchema: observabilityDashboardInputSchema,
  outputSchema: observabilityDashboardOutputSchema,
  execute: async (input, context) => ({
    ...toObservabilityDashboard(input),
    project: await dashboardProjectId(context),
  }),
});
```

**Breaking:** `projectId` is renamed to `project` everywhere it crosses the MCP boundary, matching the `project` argument (an id or slug) that other observability tools take. Rename it in `observabilityWidgetHost` options, and in both the input schema and the handler of your `queryObservability` tool:

```diff
- observabilityWidgetHost({ resourceUri, projectId })
+ observabilityWidgetHost({ resourceUri, project })

- inputSchema: z.object({ action, args, projectId: z.string().optional() }),
- execute: async ({ action, args, projectId }, context) => {
-   const reader = projectId ? await projectClient(projectId, context) : client;
+ inputSchema: z.object({ action, args, project: z.string().optional() }),
+ execute: async ({ action, args, project }, context) => {
+   const reader = project ? await projectClient(project, context) : client;
```

A server that still reads `projectId` in either place never sees the widget's `project`, so its reads may fall back to covering every project, or fail, depending on what that server does with a request that carries no project.
