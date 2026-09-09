---
'@mastra/core': patch
---

Fixed completion scoring deadlines so unfinished checks return a timeout failure, late scores cannot mark a task complete, and settled checks do not leave deadline timers running.
