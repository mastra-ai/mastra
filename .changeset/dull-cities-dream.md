---
'@mastra/core': patch
---

Fixed a false "No storage configured" warning when using a file-based `src/mastra/storage.ts`. Mastra deferred the in-memory fallback warning so file-based storage registered during startup is recognized before the warning is emitted.
