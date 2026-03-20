---
'@mastra/memory': minor
---

Added tracing support to Memory operations (recall, save, delete, update working memory). When a `tracingContext` is provided, Memory creates `MEMORY_OPERATION` spans that capture operation type, thread/resource IDs, message counts, embedding token usage, and vector result counts. Tracing is fully opt-in — existing usage without `tracingContext` is unaffected.

**Example usage:**

```typescript
import { Memory } from '@mastra/memory';
import { InMemoryStore } from '@mastra/core/storage';

const memory = new Memory({ storage: new InMemoryStore() });

// Pass tracingContext to create observable spans
await memory.recall({
  threadId: 'thread-1',
  tracingContext: { currentSpan: parentSpan },
});

await memory.saveMessages({
  messages: [userMessage, assistantMessage],
  tracingContext: { currentSpan: parentSpan },
});
```
