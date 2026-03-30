---
'@mastra/observability': minor
---

Added support for working with persisted traces through `@mastra/observability`. You can now load a recorded trace with `mastra.observability.getRecordedTrace({ traceId })` and attach scores or feedback either through that recorded trace/span or through top-level `mastra.observability.addScore()` and `addFeedback()` calls.

Recorded trace and span annotation methods are now async, and Mastra will emit debug logs when a recorded score or feedback call cannot be delivered because no observability instance is available.

Log and metric correlation handling was also updated to match the current observability signal shape.
