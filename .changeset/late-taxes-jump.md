---
'@mastra/client-js': minor
---

Added duration ordering for completed span queries. Use `orderBy: [{ field: "durationMs", direction: "desc" }]` to find the slowest spans, with stable cursor pagination. Check `capabilities.spanQueryDurationSort` before requesting this ordering.
