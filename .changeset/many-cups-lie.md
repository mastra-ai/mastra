---
'@mastra/memory': patch
---

`memory.deleteThread()` now also deletes the thread's stored agent signals: the signals waiting for the thread's next run and the records of its finished runs. This applies to storage that keeps agent signals (Postgres, LibSQL and the in-memory store) and needs the `@mastra/core` version that adds the `agentSignals` storage domain. A failure to delete them is logged and does not fail the thread deletion.
