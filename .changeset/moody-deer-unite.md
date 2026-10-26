---
'@mastra/langsmith': patch
---

Fixed LangSmith scores being silently dropped. Scores sent with `mastra.observability.addScore()` now reach LangSmith as feedback in every case: trace-level scores (only a `traceId`) land on the trace's root run, and span-level scores work from any process, after a restart, or long after the span was exported. Run ids are now derived from Mastra trace and span ids instead of being remembered in memory. Feedback also passes the project id LangSmith now requires.
