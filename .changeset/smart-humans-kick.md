---
'@mastra/core': patch
---

Fixed observational memory losing context when a reflection, a buffered-observation write, and an observation activation overlap. The in-memory store now keeps buffered observations across a reflection, never lets activation drop a chunk written by someone else or move the observation cursor backward, and refuses observational memory lifecycle writes (buffered-observation appends, activation, active-observation commits, reflections) to a superseded generation.

Storage gained two methods that report the outcome of a write, plus optional inputs, so callers can detect these cases:

- `commitActiveObservations` writes active observations and returns `{ applied, reason }`. It accepts `expectedActiveObservations` and never writes to a superseded generation.
- `appendBufferedObservations` appends a buffered chunk to the current generation and returns `{ persisted, recordId }`.
- `createReflectionGeneration` and `swapBufferedReflectionToActive` accept `newRecordId`; the reflection applied when the returned record has that id. `swapBufferedToActive` reports `retired`.
- Observational memory records carry `supersededBy`, set when a newer generation replaces them.

`updateActiveObservations` and `updateBufferedObservations` keep returning `Promise<void>`. In stores that implement the new methods, `updateActiveObservations` now throws when the observations were not written (the generation was superseded, or `expectedActiveObservations` no longer matches) instead of resolving as if they had been. An older `@mastra/memory` running against an upgraded store therefore reports a failed observation and observes the same messages again next turn, rather than marking them observed without saving their observations.

Storage adapters that do not implement these keep their previous behavior. Upgrade `@mastra/core`, `@mastra/memory`, and your storage adapter together to get the full fix; every process writing to the same database needs the upgraded adapter.
