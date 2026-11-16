---
'@mastra/core': patch
---

Added `KnowledgeInvalidCursorError`, thrown when a Knowledge list call gets a malformed cursor. The in-memory store now throws it instead of a `RangeError`, and the root level of the Knowledge tree, which is never paged, now rejects a cursor instead of returning an empty page. Catch it by name, since adapters bundle their own copy:

```ts
if (error instanceof Error && error.name === 'KnowledgeInvalidCursorError') {
  // the cursor can't be used; restart the listing without it
}
```
