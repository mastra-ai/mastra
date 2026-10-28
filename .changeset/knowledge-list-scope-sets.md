---
'@mastra/core': patch
'@mastra/libsql': patch
---

Added `listScopeSets({ within, limit })` to Knowledge storage, implemented by the in-memory and libSQL stores. It returns each distinct scope tag set that live nodes and records carry, with counts, fewest tags first. Pass `within` to keep only the sets visible from a scope.
