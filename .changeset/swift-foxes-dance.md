---
'@mastra/core': patch
---

Switched LocalProcessManager from child_process.spawn to execa for more robust cross-platform process handling in sandbox command execution.
