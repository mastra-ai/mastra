---
'mastra': patch
'@mastra/client-js': patch
'@mastra/react': patch
'@mastra/server': patch
---

Separated thread subscription cleanup from active-run aborts so closing or switching a listener only unsubscribes that listener, while explicit cancel still aborts the active run.
