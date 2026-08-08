---
'@mastra/core': patch
---

Fixed thread title generation being dropped on serverless runtimes by accepting an optional `waitUntil` on `generate()`/`stream()` so title persistence stays alive after the response without blocking the run. (#20682)
