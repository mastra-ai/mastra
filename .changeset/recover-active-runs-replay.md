---
'@mastra/core': patch
---

Fixed durable agent runs finished by boot recovery (`recoverActiveRuns()` / `mastra.recoverAllDurableAgents()`) so they can be replayed with `observe(runId)` for `cleanupTimeoutMs`, like runs from `stream()` or `recover()`. Previously `observe()` returned an error chunk or never closed.
