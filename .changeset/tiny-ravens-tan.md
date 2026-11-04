---
"@mastra/server": minor
---

Required `feedback.traceId` and `score.traceId` on observability POST requests. Omitted, null, empty, or whitespace-only IDs now return 400 before storage is called, including span-only requests. This does not add a trace-existence lookup or change generated IDs, server timestamps, or success responses.

Before:

```json
{ "feedback": { "feedbackType": "thumbs", "value": 1 } }
```

After:

```json
{ "feedback": { "traceId": "trace-123", "feedbackType": "thumbs", "value": 1 } }
```

Score requests likewise require `score.traceId`; `spanId` remains optional for both.
