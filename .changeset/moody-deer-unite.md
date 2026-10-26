---
'@mastra/langsmith': minor
---

Fixed LangSmith scores being silently dropped. Scores sent with `mastra.observability.addScore()` now reach LangSmith as feedback: trace-level scores (only a `traceId`) land on the trace's root run, and span-level scores work from any process, after a restart, or long after the span was exported. Run ids are now derived from Mastra span ids instead of being remembered in memory, so runs exported by earlier versions keep their old ids and can still only be scored from the process that exported them. Feedback also passes the id of the project the run was sent to, which LangSmith now requires. `langsmithRunIdFor(spanId)` is exported for linking to a run from your own UI.
