---
'@mastra/code-sdk': patch
---

Fixed woken notifications running in the wrong project when Mastra Code processes in different directories share one resource id. A due notification now runs as the session whose project the thread belongs to, and is delivered by a process running in that project: each project gets its own notification dispatch turn on the shared resource, so a process no longer runs another project's thread with its own workspace and tools, and no longer leaves it waiting until the process holding the resource exits.
