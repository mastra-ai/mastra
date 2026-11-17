---
'@mastra/core': minor
---

Added `knowledge.reembed()` to embed Knowledge pages and notes that already exist, such as content written before `vector` and `embedder` were configured or after switching embedders. It runs in batches with a resumable cursor, doesn't change the pages, lists failures and pages over the chunk cap, and stops early with a cursor when the embedder keeps rate limiting.

```ts
let cursor: string | undefined;
do {
  const result = await knowledge.reembed({ scope: 'org:acme', cursor });
  if (result.rateLimited) await new Promise(resolve => setTimeout(resolve, 60_000));
  cursor = result.nextCursor;
} while (cursor);
```
