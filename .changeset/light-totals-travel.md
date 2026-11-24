---
'@mastra/pg': patch
'@mastra/libsql': patch
'@mastra/mysql': patch
'@mastra/spanner': patch
---

Improved dataset `listItems()` with `perPage: 0`. It now returns the total with one query and skips the item query. Update the store package together with `@mastra/core`, so creating an experiment does not need an extra round trip.
