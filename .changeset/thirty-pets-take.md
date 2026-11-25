---
'@mastra/server': patch
---

Fixed the route that cancels pending thread signals so it returns every cancelled id for evented agents that keep their signals in storage.
