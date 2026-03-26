---
'@mastra/core': patch
---

Propagate cache metrics (`cachedInputTokens`, `cacheCreationInputTokens`) through harness token usage. The step-finish handler now extracts `cachedInputTokens` from AI SDK usage and propagates it through `usage_update` events, `getTokenUsage()`, display state, and thread metadata persistence.
