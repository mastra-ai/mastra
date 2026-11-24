---
'@mastra/core': patch
---

Added an optional `signal` to `readKnowledgePageGraph`, `listKnowledgeTreeChildren` and `readKnowledgeScopeGrants`. Once it aborts, the read makes no further storage call, drops an answer that comes back after it, and rejects with the signal's reason, so a host can put a deadline on Knowledge browsing reads.

```ts
const graph = await readKnowledgePageGraph(store, { read: 'all' }, { signal: AbortSignal.timeout(25_000) });
```
