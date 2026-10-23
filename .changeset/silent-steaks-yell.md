---
'@mastra/memory': patch
---

Fixed per-request observationalMemory: false and { enabled: false } overrides so they disable observational memory for that request while preserving message history and subsequent enabled runs. Fixes #27814.
