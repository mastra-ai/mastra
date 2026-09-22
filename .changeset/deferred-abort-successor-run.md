---
'@mastra/core': patch
---

Fixed stopping a run that is waiting on a paused tool call so it can no longer cancel a new run started right after, for example after switching threads or running `/new`.
