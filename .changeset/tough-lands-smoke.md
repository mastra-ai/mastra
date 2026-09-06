---
'@mastra/core': patch
---

Fixed durable agent crash recovery to restore saved active-step input and refuse new recovery work during shutdown while preserving recoverable snapshots.
