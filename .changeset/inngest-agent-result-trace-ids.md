---
'@mastra/inngest': patch
---

Fixed Inngest durable agent runs reporting no trace id or span id on their results. `stream()`, `resume()` and `observe()` now return the run's `traceId` and `spanId`, so a score, feedback entry or log line can be linked back to the run's trace the same way it is for a regular agent. Every stream chunk now carries the run's trace id too, including the ones the engine generates (`start`, `step-start`, `tool-result`, `finish`).
