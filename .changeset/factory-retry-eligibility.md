---
'@mastra/factory': patch
---

Fixed Factory disagreeing about which failed runs can be retried. `GET /decisions` now reports `canRetry: false` for decisions that have not failed, instead of `true`. The Supervisor `factory_retry_decision` tool now refuses failures a rerun cannot fix, such as `run_overdue` or `skill_delivery_ambiguous`, which the retry route and inbox already treated as not retryable.
