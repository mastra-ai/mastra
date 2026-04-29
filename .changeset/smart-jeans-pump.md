---
'@mastra/core': patch
---

Fixed Anthropic prompt-caching cache-write tokens being overwritten with the latest step's value instead of summed across multi-step runs.

In multi-step agent runs (e.g. a subagent calling a model 3 times), per-step `usage.inputTokens.cacheWrite` was dropped during V3-to-V2 usage normalization and only survived in `raw`, which RunOutput intentionally keeps as the latest step. The aggregated total therefore reflected only the last step's cache-write tokens.

Added a new top-level `cacheCreationInputTokens` field on `LanguageModelUsage`. The V3 usage normalizer now extracts it from `inputTokens.cacheWrite`, and `RunOutput.updateUsageCount`/`populateUsageCount` sum it across steps, mirroring how `cachedInputTokens` already aggregates cache-read tokens. `MastraAgentNetworkStream` was updated symmetrically.

```ts
// totalUsage on a 3-step Anthropic run with prompt caching:
// Before: { cacheCreationInputTokens: 4005 }   // only the last step
// After:  { cacheCreationInputTokens: 5268 }   // 967 + 296 + 4005
```
