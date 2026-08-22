---
'@mastra/core': minor
'@mastra/libsql': patch
'mastra': patch
'@mastra/pg': patch
---

Live scoring runs are now durable. Each live scorer execution runs inside an internal workflow that records a pending run before the scorer executes and a queryable success or failed status (with the error) after — so scoring failures are no longer silent log lines. Transient scorer failures (like a rate-limited judge model) now retry automatically. Sampling decisions (both sampled and declined) are recorded so you can compute scoring coverage. Batch trace scoring no longer reports success when every target failed; per-target failures are surfaced in the step output.
