---
'@mastra/core': patch
---

Removed `knowledge.reindex()`. It re-embedded every page and note in the store, which is slow and costly on a large store. Pages and notes are embedded when they're written through the Knowledge tools, `upsertPage` or the note methods. If an embed fails, the write still succeeds and the content stays findable by keyword search; it's embedded again the next time it changes. `upsertPage` skips writes whose content is unchanged, so sending identical content again doesn't retry a failed embed; the Knowledge tools and `updateNote` embed on every write.

If you called `reindex()` after loading content, delete the call and load the content through `upsertPage` instead, which embeds each new or changed page as it's written. There is no bulk re-embed for content that's already stored:

```ts
// Before
await knowledge.reindex();

// After
await knowledge.upsertPage({ scope: 'org:acme', path: 'refunds', name: 'Refund policy', body });
```
