---
'@mastra/core': minor
---

Added new observability entrypoint APIs for persisted traces. You can now call `mastra.observability.getRecordedTrace({ traceId })` to load a recorded trace, and use optional top-level `mastra.observability.addScore()/addFeedback()` helpers to annotate a persisted trace by ID.
