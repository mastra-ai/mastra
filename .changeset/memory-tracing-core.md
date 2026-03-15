---
'@mastra/core': minor
---

Memory operations now produce observability spans and accept an optional `tracingContext` parameter. A new `MEMORY_OPERATION` span type, `MEMORY` entity type, and `MemoryOperationAttributes` interface let you identify memory spans in your traces. Agent and network code automatically threads tracing context into memory calls.

**New observability identifiers:**

- `SpanType.MEMORY_OPERATION` — span type for all memory operations
- `EntityType.MEMORY` — entity type for memory spans
- `MemoryOperationAttributes` — typed attributes (operationType, threadId, messageCount, embeddingTokens, etc.)

**Updated abstract methods** on `MastraMemory` now accept optional `tracingContext`:

```typescript
import type { TracingContext } from '@mastra/core/observability';

// All four methods accept an optional tracingContext
await memory.recall({
  threadId: 'thread-1',
  tracingContext: { currentSpan: parentSpan },
});

await memory.saveMessages({
  messages,
  tracingContext: { currentSpan: parentSpan },
});

await memory.deleteMessages(['msg-1'], { currentSpan: parentSpan });

await memory.updateWorkingMemory({
  threadId: 'thread-1',
  workingMemory: 'content',
  tracingContext: { currentSpan: parentSpan },
});
```
