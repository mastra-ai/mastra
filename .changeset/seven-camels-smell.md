---
'@mastra/core': patch
---

The `execute_command` tool description now tells agents that `timeout` stops a background command after that many seconds, so they leave it out for dev servers and other commands that should keep running.
