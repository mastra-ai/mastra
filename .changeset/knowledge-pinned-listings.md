---
'@mastra/core': minor
---

Pin a listing of the Knowledge page tree into an agent's context. A scope's `pinnedContext` now also takes `{ list, depth? }` entries, so every run holding the scope sees the pages under a scope or page (ref, name and child count each) without calling `knowledge_list`:

```ts
scopes: {
  'org:$orgId': { pinnedContext: [{ list: 'docs:$orgId#guides', depth: 1 }] },
}
```

A listing shows only pages the run can read, updates when a listed page is added, renamed or removed, takes one pin slot and shares `pinnedContext.maxTokens` with pinned pages. A listing cut short ends with a `knowledge_list` pointer to the rest.
