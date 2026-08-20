---
'@mastra/server': minor
'@mastra/client-js': minor
---

Added feedback deletion endpoints and client methods:

```ts
// Delete a single feedback record
await client.deleteFeedback({ feedbackId: 'feedback-1' });

// Erase all feedback linked to specific traces
await client.deleteFeedbackByTraceIds({ traceIds: ['trace-123'] });
```

Feedback creation now also accepts a client-supplied `feedbackId`, making submissions safe to retry without creating duplicates.
