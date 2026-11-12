---
'@mastra/core': patch
---

Durable agent tool steps now listen for abort requests from other processes, so `abort()` can signal a tool running on a different worker to stop. When the run carries its `modelSettings.timeout.totalMs` deadline, each worker arms it and aborts the tool's `abortSignal` at that deadline, and the run stops waiting for the tool once the abort grace window passes, ending as a `MastraTimeoutError`. A tool that ignores its `abortSignal` keeps running; its step is saved with the aborted-tool notice. A tool step that starts after the run has already stopped does not invoke the tool. A run whose stream gets the same deadline error from more than one process reports it once.
