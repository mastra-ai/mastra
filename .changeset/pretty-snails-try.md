---
'@mastra/mcp': minor
---

Added per-server time budgets and duration metrics to MCP discovery methods.

```typescript
const { tools, errors, durations } = await mcp.listToolsWithErrors({
  perServerTimeoutMs: 3_000,
});
```
