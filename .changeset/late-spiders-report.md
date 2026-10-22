---
'@mastra/core': patch
---

Fixed evented agent runs with Postgres storage that hung when a worker process stopped. Another worker can now finish the run, and the original caller gets the result. Completed loop iterations keep their saved results and state without running again. Recovery-only snapshots are removed when a workflow suspends without snapshot persistence. Snapshot pruning still applies at terminal and control-flow boundaries without discarding inputs needed for recovery.

Upgrade `@mastra/core` together with `@mastra/pg`. Let runs started on older versions finish before upgrading.
