---
'@mastra/core': patch
---

Durable agent tool steps now listen for abort requests from other processes, so `abort()` and the `modelSettings.timeout.totalMs` deadline stop a tool running on a different worker. A timeout abort request reaches the tool as a `MastraTimeoutError`, and a run whose stream gets the same deadline error from more than one process reports it once.
