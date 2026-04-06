---
'@mastra/memory': minor
---

Added tracing support to Memory operations (recall, save, delete, update working memory). When an `observabilityContext` is provided, Memory creates `MEMORY_OPERATION` spans that capture operation type, message counts, embedding token usage, and vector result counts. Tracing is fully opt-in — existing usage without `observabilityContext` is unaffected.

**Example usage:**

```typescript
import { Memory } from '@mastra/memory';
import { InMemoryStore } from '@mastra/core/storage';

const memory = new Memory({ storage: new InMemoryStore() });

// Pass observabilityContext to create observable spans
await memory.recall({
  threadId: 'thread-1',
  observabilityContext: { tracingContext: { currentSpan: parentSpan } },
});

await memory.saveMessages({
  messages: [userMessage, assistantMessage],
  observabilityContext: { tracingContext: { currentSpan: parentSpan } },
});
```
