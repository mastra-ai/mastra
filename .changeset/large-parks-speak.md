---
'@mastra/server': minor
---

Added endpoints to preview completed conversation turns and convert them into replay dataset items, with thread access checks.

```ts
await fetch('/api/datasets/dataset-id/items/from-thread', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ agentId: 'support', threadId: 'golden-thread', historyLimit: 10 }),
});
```

`POST /api/datasets/replay/preview` accepts the same source fields and returns the completed-turn count without creating items.
