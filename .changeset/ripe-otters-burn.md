---
'@mastra/core': patch
---

Fixed observability span handling during workflow suspend/resume. When a workflow suspends, span context (traceId, spanId, parentSpanId) is now persisted to storage. On resume, a new span is created as a child of the original suspended span, maintaining proper trace hierarchy and continuity.
