---
'@mastra/pg': minor
---

**In-progress traces now appear in Studio with `PostgresStoreVNext`**

`PostgresStoreVNext` previously persisted a span only after it finished, so a long agent run stayed invisible until it completed. It now uses the `event-sourced` tracing strategy: one row is written when a span starts and another when it ends, and reads collapse those rows back into a single span. Traces show up in Studio while the run is executing, and filtering by `running` status works.

This also fixes duplicate traces from durable runs. A run that suspends and resumes opens a second root span on the same trace, which used to render as two separate entries; the trace list now shows the current root only.

Writes stay append-only, so throughput is unchanged. The span table gains an `isPending` column, added automatically on `init()` — no manual migration needed. Closes #22054.
