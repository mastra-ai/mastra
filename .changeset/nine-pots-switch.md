---
'@mastra/playground-ui': patch
'@mastra/react': patch
---

Improved auto-refresh in the traces explorer. When the observability store supports delta polling, the list now adds new and updated traces in place instead of reloading every page, so the scroll position and loaded pages are kept. Other stores keep the previous refresh behavior.
