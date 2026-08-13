---
'@mastra/core': patch
---

Fixed recovered durable runs so only the recovery-lease holder announces and restarts a run, allowing reconnecting thread subscribers to receive its remaining output and terminal event without duplicate recovery races.
