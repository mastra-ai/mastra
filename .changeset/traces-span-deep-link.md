---
'@mastra/playground-ui': patch
---

Fixed opening a trace with a span already selected in the URL (`/traces/<traceId>?spanId=<spanId>`). On a cold load the span panel stayed closed and the `spanId` was stripped from the URL, because the timeline decided the span did not exist while the trace was still being fetched. It now waits for the trace to load before resolving the selection, so shared span links open on the right span.
