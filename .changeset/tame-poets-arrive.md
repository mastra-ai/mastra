---
'@mastra/core': patch
---

`writeRegistryFiles()` now removes the previous `capabilities/` directory on every successful generation, even when the new capability maps are empty. Previously the cleanup only ran when at least one capability map contained data, so a later generation with empty capabilities left stale files on disk and could report model capabilities that no longer existed. Fixes #21530.
