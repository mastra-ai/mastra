---
'@mastra/memory': patch
'@mastra/core': patch
---

Fixed observational memory activation using outdated buffered observations in some long-running threads. Activation now uses the latest thread state so the correct observations are promoted.
