---
'@mastra/factory': patch
'mastra': patch
---

Factory opens faster. When you open a page, the web UI now starts what it needs at the same time as the sign-in check: your Factories, the sidebar's sessions, boards and work items, the board's intake settings and connection status, and the page's own code. It no longer waits for each step to finish before starting the next.
