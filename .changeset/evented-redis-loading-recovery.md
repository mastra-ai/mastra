---
'@mastra/core': patch
'@mastra/redis-streams': patch
---

Fixed evented agent runs getting stuck in `running` forever when Redis restarts and spends time reloading its dataset while a tool is finishing. Publishing now waits for Redis to finish loading instead of dropping the tool result, a thread lease that expired during the restart is taken back by the execution that still owns the run, and the run no longer aborts as if its lease was lost while Redis refuses every client. The run now completes with its answer saved and each tool executed once.
