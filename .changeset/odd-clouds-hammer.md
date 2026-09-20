---
'@mastra/core': patch
---

Fixed unbinding a thread so it no longer aborts the run a different agent instance is executing. Detaching from a thread, switching threads, or tearing down a session now stops only run work owned by the local process; explicit cancellation still stops the run wherever it is executing.
