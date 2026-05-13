---
'@mastra/core': patch
---

Harness v1: prune dead per-run accumulator from the subscription drain. `Session._runState` was a write-only `Map<runId, { startedAt }>` set on first chunk and deleted in `_handleRunTerminal` but never read — leftover from an earlier multi-run-accumulator design that the canonical `_waitUntilFinished`-driven completion path obsoleted. Drain comment also reworded to make its single responsibility (event emission only) explicit.
