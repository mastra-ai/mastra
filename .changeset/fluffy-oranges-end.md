---
'@mastra/core': minor
---

Added render-only tools that stream display calls and let agents and sub-agents continue without a client result. Use `renderOnly: true` when the browser only needs to show the call:

```typescript
const showCard = createTool({
  id: 'show-card',
  inputSchema: z.object({ productId: z.string() }),
  renderOnly: true,
})
```
