---
'@mastra/inngest': patch
---

Fixed Inngest durable agents reporting failed runs as `[object Object]`. When a step fails, `generate()`, `stream()` and the HTTP API now return the step's error message, for example `step output size is greater than the limit`. Fixes #25161.
