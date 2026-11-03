---
'@mastra/core': patch
---

The agent controller's `command_exit` event now carries `killed`, so clients can tell a process that was killed from one that exited with a failure code.
