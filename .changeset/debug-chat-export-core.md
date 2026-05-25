---
'@mastra/core': minor
---

Exposes a new `Harness.getObservationalMemoryHistory({ limit? })` helper that returns previous generations of the current thread's OM record (newest first), excluding the currently active record. This parallels the existing `getObservationalMemoryRecord()` and returns `[]` when no thread is selected or no OM record exists.
