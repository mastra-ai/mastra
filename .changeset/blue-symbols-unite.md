---
'@mastra/core': patch
---

Fixed sandbox command execution crashing the parent process on some Node.js versions by explicitly setting stdio to pipe for detached child processes.
