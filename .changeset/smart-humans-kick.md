---
'@mastra/core': patch
---

Fixed observational memory losing context when a reflection, a buffered-observation write, and an observation activation overlap. The in-memory store now keeps buffered observations across a reflection, never lets activation drop a chunk written by someone else or move the observation cursor backward, and refuses writes to a superseded generation.

The storage contract gained optional, backward-compatible inputs and results that let callers detect these cases:

- `createReflectionGeneration` and `swapBufferedReflectionToActive` accept `newRecordId`; the reflection applied when the returned record has that id.
- `updateActiveObservations` accepts `expectedActiveObservations` and returns `{ applied, reason }`.
- `updateBufferedObservations` returns `{ persisted, recordId }`; `swapBufferedToActive` reports `retired`.
- Observational memory records carry `supersededBy`, set when a newer generation replaces them.

Storage adapters that do not implement these keep their previous behavior.
