---
'@mastra/core': patch
---

`fetchWithRetry` now backs off in sequence 2s → 4s → 8s and then caps at 10s.
