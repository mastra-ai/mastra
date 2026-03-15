---
'@mastra/memory': minor
---

Added tracing support to Memory operations (recall, save, delete, update working memory). When a `tracingContext` is provided, Memory creates `MEMORY_OPERATION` spans that capture operation type, thread/resource IDs, message counts, embedding token usage, and vector result counts. Tracing is fully opt-in — existing usage without `tracingContext` is unaffected.

**Example usage:**

```typescript
// tracingContext flows automatically from agent runs
const agent = new Agent({
  memory: new Memory({ storage }),
});

// Or pass explicitly when calling memory directly
await memory.recall({
  threadId: 'thread-1',
  tracingContext: { currentSpan: parentSpan },
});
```
