---
'@mastra/core': patch
---

Tool calls whose approval policy is a function now run in parallel under `toolCallConcurrency: { strategy: 'called' }` when that policy returns `false` for the actual call. Previously any function-based policy — including MCP clients configured with a `requireToolApproval` function — forced the whole batch to run one at a time, even when no approval was needed.

```ts
await agent.stream('go', {
  requireToolApproval: ({ toolName }) => toolName === 'delete_file',
  toolCallConcurrency: { limit: 10, strategy: 'called' },
});
```
