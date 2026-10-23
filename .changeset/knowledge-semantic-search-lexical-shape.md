---
'@mastra/memory': patch
---

`KnowledgeSemanticIndexCoordinator.search()` now returns hits in the same shape as Knowledge storage's lexical `search()`, plus a `score`, so results from both join on `type` and `id`. A record hit's `recordId` is its node's id, as in lexical search. The new `KnowledgeSemanticSearchResult` type is exported.

Before:

```ts
const [hit] = await semanticIndex.search('atlas', scopeIds);
// { id: 'knowledge:record:<recordId>', score: 0.8, metadata: { document_type: 'record', record_id: '<recordId>', scope_ids: [...] } }
```

After:

```ts
const [hit] = await semanticIndex.search('atlas', scopeIds);
// { type: 'record', id: '<recordId>', recordId: '<nodeId>', name: 'Atlas', text: '...', scopeIds: [...], score: 0.8 }
```
