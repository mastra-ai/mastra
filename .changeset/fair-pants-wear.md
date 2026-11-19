---
'@mastra/mcp-apps-components': minor
---

The observability dashboard can now read a single project's data in chat clients that don't pass a project, such as Claude and ChatGPT. Previously, those clients read every project the server could access. Return the dashboard's project id as `project` next to the dashboard. A project passed by the host page still wins. Pins and settings clicks now report the project each widget read.

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

**Breaking:** `projectId` is renamed to `project` everywhere it crosses the MCP boundary, matching the `project` argument (an id or slug) that other observability tools take. Rename it in `observabilityWidgetHost` options and in your `queryObservability` input schema:

```diff
- observabilityWidgetHost({ resourceUri, projectId })
+ observabilityWidgetHost({ resourceUri, project })

- inputSchema: z.object({ action, args, projectId: z.string().optional() }),
+ inputSchema: z.object({ action, args, project: z.string().optional() }),
```

A server that still declares `projectId` drops the widget's `project`, so its reads cover every project.
