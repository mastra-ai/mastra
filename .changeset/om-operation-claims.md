---
'@mastra/core': minor
'@mastra/memory': patch
---

Added observational memory operation claims to `MemoryStorage` (`claimObservationalMemoryOperation`, `renewObservationalMemoryOperation`, `releaseObservationalMemoryOperation`, `getObservationalMemoryOperationOwner`). The default implementation keeps claims in process, so behavior is unchanged. Storage adapters can override these methods to coordinate observation, reflection, and buffering across processes.

Observational memory now tracks in-flight operations through these storage claims, and falls back to its previous in-process tracking when used with an older `@mastra/core`.
