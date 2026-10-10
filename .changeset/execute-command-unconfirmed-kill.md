---
'@mastra/core': patch
---

`execute_command` no longer tells the agent an aborted command was killed unless the sandbox confirms it (`killed: true`). When the provider omits kill metadata or throws after the run is cancelled, the tool now notes that the run was cancelled and keeps the provider's error, so agents are not falsely assured that remote work stopped.
