---
'@mastra/core': patch
---

Removed `knowledge.reindex()`. It re-embedded every page and note in the store, which is slow and costly on a large store. Pages and notes are embedded when they're written through the Knowledge tools, `upsertPage` or the note methods. If an embed fails, the write still succeeds and the content stays findable by keyword search; it's embedded again the next time it changes. Writing unchanged content doesn't retry the embed.

If you called `reindex()` after loading content, delete the call and write the content through `upsertPage` instead:

```ts
// Before
await knowledge.reindex();

// After
await knowledge.upsertPage({ scope: 'org:acme', path: 'refunds', name: 'Refund policy', body });
```
