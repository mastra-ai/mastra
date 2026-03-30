---
'@mastra/core': minor
'@mastra/observability': minor
---

Added new observability APIs for working with persisted traces. You can now load a recorded trace with `mastra.observability.getRecordedTrace({ traceId })` and attach scores or feedback either through that recorded trace or with top-level `mastra.observability.addScore()` / `addFeedback()` calls.

Recorded trace and span annotation methods are now async, and Mastra will emit debug logs when a recorded score or feedback call cannot be delivered because no observability instance is available.

Log and metric correlation handling was also updated to match the current observability signal shape.
