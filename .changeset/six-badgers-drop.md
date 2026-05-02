---
'@mastra/core': minor
---

Added request-aware filtering for ToolSearchProcessor search, load, and active tools.

```ts
new ToolSearchProcessor({
  tools,
  filterTool: ({ toolName, requestContext }) => {
    const plan = requestContext?.get('plan')
    return plan === 'pro' || !toolName.startsWith('premium_')
  },
})
```
