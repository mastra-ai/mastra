---
'@mastra/memory': minor
---

Added `compact()` to Observational Memory so you can force a compaction pass after a provider rejects a request for exceeding its context window. Unlike `observe()`, it ignores the observation threshold for that call only and does not leave a lowered threshold behind on the record.

```typescript
const result = await om.compact({ threadId, resourceId });

if (result.compacted) {
  // retry the request with the smaller context
}
```

It compacts the oldest messages first, in chunks, until the pending context drops below `targetTokens` (half the observation threshold by default), and returns how much was compacted along with the updated record. Use it from an error processor's `processAPIError` to recover from context-overflow errors instead of lowering the threshold with `updateRecordConfig()`.
