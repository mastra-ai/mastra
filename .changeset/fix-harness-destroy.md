---
'@mastra/core': patch
---

Add missing `destroy()` method to Harness class. This method was documented but not implemented after a refactor split it into `stopHeartbeats()` and `destroyWorkspace()`. The new `destroy()` calls both to provide a single cleanup entrypoint.
