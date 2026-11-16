---
'@mastra/mcp-apps-components': minor
---

The observability dashboard can now read a single project's data in chat clients that don't pass a project, such as Claude and ChatGPT. Previously, those clients read every project the server could access. Return the dashboard's project as `projectId` next to the dashboard. A project passed by the host page still wins. Pins and settings clicks now report the project each widget read.

```ts
const showObservabilityDashboard = createTool({
  id: 'showObservabilityDashboard',
  inputSchema: observabilityDashboardInputSchema,
  outputSchema: observabilityDashboardOutputSchema,
  execute: async (input, context) => ({
    ...toObservabilityDashboard(input),
    projectId: await dashboardProjectId(context),
  }),
});
```
