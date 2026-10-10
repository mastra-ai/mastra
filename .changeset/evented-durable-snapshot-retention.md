---
'@mastra/core': patch
---

Fixed durable agents on the evented engine running the process out of memory on long runs. The engine persisted every completed step's full `payload` and `output` — including the whole, monotonically growing iteration state — because its step-result merge writes bypassed the workflow's `pruneSnapshot` hook, so snapshots and per-write heap cost grew without bound. The engine now prunes after each non-parallel step, and the durable loop no longer retains all completed-step history now that its same-iteration reads are declared.
