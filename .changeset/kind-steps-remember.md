---
'@mastra/core': patch
---

Fixed a resumed workflow step losing its `suspendData` when the run restarts after a crash. The step now gets the payload it passed to `suspend()` again, alongside its `resumeData`.
