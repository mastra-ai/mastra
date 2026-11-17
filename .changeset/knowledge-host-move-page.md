---
'@mastra/core': minor
---

Added `knowledge.movePage()` to move a page, with its child pages, to a new parent or scope from your app. The page keeps its ID, notes, pins and embeddings, and links by path follow it, so a sync that sees a page move at its source no longer has to remove and re-create it.

```ts
await knowledge.movePage({ scope: 'docs:acme', path: 'inbox/plan', parent: 'projects/q4' });
```

Links by name now stay correct when a page moves or a new page takes a name. A page moved to another scope, and every page under it, re-resolves its `[[Name]]` links in the new scope. A link that pointed at one page by name stops resolving once a second page answers to that name. When more than 99 pages share that name, the write logs a warning and `knowledge.reindexLinks()` repairs the rest.
