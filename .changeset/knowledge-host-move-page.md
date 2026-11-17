---
'@mastra/core': minor
---

Added `knowledge.movePage()` to move a page, with its child pages, to a new parent or scope from your app. The page keeps its ID, notes, pins and embeddings, and links by path follow it, so a sync that sees a page move at its source no longer has to remove and re-create it.

```ts
await knowledge.movePage({ scope: 'docs:acme', path: 'inbox/plan', parent: 'projects/q4' });
```
