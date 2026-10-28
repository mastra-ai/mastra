---
'@mastra/client-js': minor
'mastra': minor
---

Added native outcome and stop-reason filters to generated client and CLI contracts, with typed causal detail in SDK span responses.

```ts
await client.listTraces({ filters: { outcome: 'limit', stopReason: 'max_steps' } });
```
