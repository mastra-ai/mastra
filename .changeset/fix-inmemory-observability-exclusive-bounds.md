---
'@mastra/core': patch
---

Fix in-memory observability `listTraces` ignoring the `startExclusive` and `endExclusive` flags on `startedAt`/`endedAt` filters. Exclusive date-range bounds now drop a trace that sits exactly on the boundary, matching the pg/libsql adapters (and the in-memory log/metric filters). Closes #18635.
