---
'@mastra/memory': patch
---

Export the observational-memory observation part types from `@mastra/memory/processors`: `DataOmObservationStartPart`, `DataOmObservationEndPart`, `DataOmObservationFailedPart`, `DataOmObservationPart`, `DataOmStatusPart`, `DataOmThreadUpdatePart`, and `ObservationMarkerConfig`. Previously only the buffering, activation, and grand-union OM part types were re-exported, so consumers (such as the Studio playground) could not type their OM marker handling against the canonical observation part interfaces.
