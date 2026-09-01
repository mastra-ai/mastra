---
'@mastra/dsql': patch
---

Write memory thread and resource timestamps as UTC ISO strings so `timestamp` columns no longer store the server's local wall clock (mirrors the `@mastra/pg` fix).
