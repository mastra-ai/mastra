---
'@mastra/server': minor
'@mastra/server-adapters-test-suite': patch
'mastra': patch
---

Add `PUT /api/observability/feedback/:feedbackId` for complete feedback replacement. Preserve the original ID, trace ID, and timestamp, and include every field to retain. Delayed POST retries keep existing feedback. Unsupported storage versions return 501.

```json
{
  "feedback": {
    "feedbackId": "feedback-1",
    "traceId": "trace-123",
    "timestamp": "2026-11-11T12:00:00.123Z",
    "feedbackType": "thumbs",
    "value": -1
  }
}
```
