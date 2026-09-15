---
'@mastra/core': minor
---

Added deferred tool discovery to avoid preparing remote schemas before an agent needs them. Existing tools and filter callbacks keep their current behavior.

```ts
const processor = new ToolSearchProcessor({
  tools: {},
  deferredTools: async ({ requestContext }) =>
    deferStoredToolProviders(authorizedProviders, lookupProvider, { requestContext }),
  search: { autoLoad: true, topK: 1 },
});
```

Supply the complete authorized tool names and descriptions in the provider configuration. Mastra resolves the selected schemas through the existing provider before activation, validation, approval, and execution.
