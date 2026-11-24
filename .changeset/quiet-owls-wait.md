---
'@mastra/core': patch
---

Added an optional `signal` to `readKnowledgePageGraph` and `listKnowledgeTreeChildren`. Once it aborts, the read makes no further storage call and rejects with the signal's reason, so a host can put a deadline on Knowledge browsing reads.

```ts
const graph = await readKnowledgePageGraph(store, { read: 'all' }, { signal: AbortSignal.timeout(25_000) });
```
