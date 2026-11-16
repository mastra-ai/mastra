---
'@mastra/core': minor
---

Added `knowledge.reembed()` to embed Knowledge pages and notes that already exist, such as content written before `vector` and `embedder` were configured or after switching embedders. It runs in batches with a resumable cursor, doesn't change the pages, lists failures and pages over the chunk cap, and stops early with a cursor when the embedder keeps rate limiting.

```ts
let cursor: string | undefined;
do {
  cursor = (await knowledge.reembed({ scope: 'org:acme', cursor })).nextCursor;
} while (cursor);
```
