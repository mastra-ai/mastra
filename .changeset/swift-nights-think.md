---
'@mastra/core': minor
---

Added `knowledge.upsertPage()` and `knowledge.removePage()` so apps can sync outside content, such as docs, into Knowledge from server code. A page is identified by its scope and key path, so running a sync again updates the same pages and skips unchanged ones. Notes on synced pages are kept, pages are embedded when Knowledge has a vector store, and change listeners are told.

```ts
await knowledge.upsertPage({ scope: 'docs:acme', path: 'guides/install', name: 'Install', body: markdown });
await knowledge.removePage({ scope: 'docs:acme', path: 'guides/old' });
```
