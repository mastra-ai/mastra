---
'@mastra/core': minor
---

Added `maxTokens` option to Memory configuration for token-based memory history limiting. When set, a `MemoryTokenLimiter` processor automatically trims oldest memory messages to keep the total token count within the configured budget, using tiktoken (o200k_base encoding) for accurate token counting. This prevents context window overflow for models with large context windows while preserving input messages.
