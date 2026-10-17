---
'@mastra/code-sdk': patch
---

Fixed woken notifications running in the wrong project when Mastra Code processes in different directories share one resource id. A due notification now runs as the session whose project the thread belongs to; a process that serves the resource but not that thread leaves the notification for the process that does, instead of running it with its own workspace and tools.
