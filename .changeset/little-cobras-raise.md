---
'@mastra/code-sdk': minor
---

Added support for async `extraTools` providers in `MastraCodeConfig`. The `extraTools` option now accepts an async function that receives the request context, so tools can be resolved per session (for example, only exposing an integration tool when the current project has that integration connected).

```ts
const mastraCode = await createMastraCode({
  extraTools: async ({ requestContext }) => {
    const controller = requestContext.get('controller');
    if (!(await hasLinearConnection(controller?.resourceId))) return {};
    return { linear_get_issue: linearGetIssueTool };
  },
});
```
