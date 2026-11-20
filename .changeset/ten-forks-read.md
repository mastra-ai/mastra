---
'@mastra/core': patch
---

Added `traceId` and `spanId` to the result of `stream()`, `resume()`, `observe()`, and `recover()` on durable agents, so you no longer need to read them from `result.output`. A recovered run's result and stream chunks now also carry the trace ID of the run.
