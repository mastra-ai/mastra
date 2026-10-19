---
'@mastra/memory': patch
---

`ObservationalMemory.settled()` now waits for buffered reflections. Previously it could resolve while a background reflection was still writing.
