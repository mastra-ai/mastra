---
'@mastra/memory': patch
---

Improved observational memory maintainability by extracting async buffering helper functions (config checks, buffer key generation, in-progress detection) into a dedicated `buffer-helpers` module with dedicated unit tests. Test code now uses public `getObservationConfig()` / `getReflectionConfig()` getters instead of `(om as any)` casts. No public API or behavior changes.
