---
'@mastra/server': minor
'@mastra/client-js': minor
---

Added the `aggregateTimeToFirstMeasures` observability capability. Trace and span aggregate requests for `timeToFirstToken.*` or `timeToFirstChunk.*` measures now return `501` against stores that can't compute them, and field discovery omits those measures for such stores.
