---
'@mastra/core': minor
---

Memory operations now produce observability spans and accept an optional `observabilityContext` parameter. A new `MEMORY_OPERATION` span type, `MEMORY` entity type, and `MemoryOperationAttributes` interface let you identify memory spans in your traces. Agent and network code automatically threads observability context into memory calls.

**New observability identifiers:**

- `SpanType.MEMORY_OPERATION` — span type for all memory operations
- `EntityType.MEMORY` — entity type for memory spans
- `MemoryOperationAttributes` — typed attributes (operationType, messageCount, embeddingTokens, etc.)

**Updated abstract methods** on `MastraMemory` now accept optional `observabilityContext`:

```typescript
import type { ObservabilityContext } from '@mastra/core/observability';

// All four methods accept an optional observabilityContext
await memory.recall({
  threadId: 'thread-1',
  observabilityContext: { tracingContext: { currentSpan: parentSpan } },
});

await memory.saveMessages({
  messages,
  observabilityContext: { tracingContext: { currentSpan: parentSpan } },
});

await memory.deleteMessages(['msg-1'], { tracingContext: { currentSpan: parentSpan } });

await memory.updateWorkingMemory({
  threadId: 'thread-1',
  workingMemory: 'content',
  observabilityContext: { tracingContext: { currentSpan: parentSpan } },
});
```
