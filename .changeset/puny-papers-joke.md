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

Fixed a `.foreach()` run staying stuck as running when the first failed item's failure could not be sent. The run now fails with the first item's error once that failure is delivered again.
