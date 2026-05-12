---
'@mastra/core': minor
---

Added request-aware filtering for ToolSearchProcessor search, load, and active tools. The filter hook receives the resolved tool ID as `toolName`.

```ts
new ToolSearchProcessor({
  tools,
  filter: ({ toolName, requestContext }) => {
    const plan = requestContext?.get('plan')
    return plan === 'pro' || !toolName.startsWith('premium_')
  },
})
```
