---
'@mastra/core': patch
---

Durable agent tool steps now listen for abort requests from other processes, so `abort()` and the `modelSettings.timeout.totalMs` deadline stop a tool running on a different worker. When the run carries its deadline, a worker stops the tool at that deadline with a `MastraTimeoutError`, and a run whose stream gets the same deadline error from more than one process reports it once.
