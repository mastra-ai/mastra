---
'@mastra/core': patch
---

Added canonical Harness v1 work-unit type contracts. `HarnessTask` and `HarnessRun` are the new type-level primitives describing what a session is attempting and which attempt is currently executing. `TaskIndexEntry` ships the cross-surface lookup row shape (sessionId / runId / queuedItemId / a2aTaskId) that future cancellation work will materialize.

The contracts are type-only this release — no storage schema changes, no new APIs. They give downstream consumers a stable vocabulary while the durable index implementation is in flight.
