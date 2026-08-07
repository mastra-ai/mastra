---
'@mastra/core': patch
---

Stamp the run's traceId into persisted assistant message metadata so a stored message can be correlated back to its trace.

Previously a caller holding only a `messageId` had no supported way to find the trace that produced it: message rows carry no `traceId` column and span records carry no `messageId`. The traceId now rides along in the metadata that already carried `modelId` and `provider`, on both the regular and the durable agent path.

```typescript
const { messages } = await memory.recall({ threadId, perPage: false })
const traceId = messages.find(m => m.id === messageId)?.content.metadata?.traceId
```

This is forward-looking — messages persisted before this change have no traceId.
