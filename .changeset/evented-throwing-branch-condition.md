---
'@mastra/core': patch
---

Fixed evented workflows failing the entire run when a `.branch()` condition throws. A throwing condition is now logged and treated as false, so the remaining branches still run — matching the default workflow engine.
