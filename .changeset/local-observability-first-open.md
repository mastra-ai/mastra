---
'@mastra/code-sdk': patch
---

Fixed a `prune() failed for domain "observability"` error being logged the first time local tracing opened a new `observability.duckdb` file. Mastra Code now skips the startup prune until the trace tables exist; the next session prunes as usual.
