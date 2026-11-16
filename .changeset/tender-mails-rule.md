---
'@mastra/client-js': patch
'@mastra/redis-streams': patch
'@mastra/server': patch
'@mastra/core': patch
'@mastra/convex': patch
'@mastra/libsql': patch
'mastra': patch
'@mastra/pg': patch
---

Fixed a `.foreach()` over a nested workflow on a run stored with the experimental `storageVersion: 2` option only keeping the last item's run. Restarting the run could give an item another item's result. Every item's run is kept again.
