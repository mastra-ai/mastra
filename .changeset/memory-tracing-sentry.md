---
'@mastra/sentry': patch
---

Added memory operation spans (`ai.memory`) to Sentry traces. Memory recall, save, delete, and update operations now appear as labeled spans in your Sentry dashboard. Also improved span type handling so future new span types gracefully fall back to a default instead of causing errors.
