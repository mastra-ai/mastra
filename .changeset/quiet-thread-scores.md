---
'@mastra/playground-ui': patch
---

Fixed the thread view firing repeated scores requests for every trace. Scores now load only when a trace's Scores tab is open, and the tab no longer shows a count.
