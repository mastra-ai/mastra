---
'@mastra/core': minor
---

Added feedback lifecycle improvements to the observability storage domain:

**Message-to-trace linkage**
Assistant messages saved to memory are now stamped with their trace context in message metadata, so you can navigate from a stored message to the trace that produced it:

```ts
message.content.metadata.mastra; // { traceId, spanId }
```

**Idempotent feedback writes**
`FeedbackInput` now accepts an optional client-supplied `feedbackId`. Retrying a submission with the same ID results in a single record instead of duplicates.

**Feedback filtering by source record**
`listFeedback` filters now support `sourceId`, so you can list all feedback linked to a specific record such as a message ID.

**Feedback deletion**
New `deleteFeedback({ feedbackId })` and `deleteFeedbackByTraceIds({ traceIds })` operations. Deleting traces with `batchDeleteTraces()` now also cascades to their linked feedback, supporting data-lifecycle and compliance erasure flows.
