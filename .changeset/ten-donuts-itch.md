---
'@mastra/core': patch
---

Scripts using Mastra no longer hang after completing their work. The scheduler timer that polls for due schedules previously kept the Node.js event loop alive, preventing process exit even when all work was done. The timer now allows the process to exit naturally.
