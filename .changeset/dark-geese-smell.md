---
'@mastra/inngest': patch
---

Fixed missing `traceId` and `spanId` on `createInngestAgent` results. `stream()`, `generate()`, `resume()`, and `observe()` results now name the trace of the run, and every stream chunk carries the trace ID, so you can link a score, feedback, or a log line to the run. Fixes #30871.
