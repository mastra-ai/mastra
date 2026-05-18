---
"@mastra/core": patch
---

Added the `internalUsage?: UsageStats` field to `AIBaseAttributes`, so any span type can carry token usage rolled up from internal descendant spans. Populated automatically by `@mastra/observability` when an internal `MODEL_GENERATION` ends inside a non-internal ancestor.
