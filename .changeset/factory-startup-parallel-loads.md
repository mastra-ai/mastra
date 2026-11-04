---
'@mastra/factory': patch
---

Factory opens faster. When you open a page, the web UI now starts everything it needs at the same time as the sign-in check: your Factories, the sidebar's sessions, boards and work items, and the page's own code. It no longer waits for each step to finish before starting the next.
