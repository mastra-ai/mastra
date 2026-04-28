---
'@mastra/observability': patch
---

Fixed Anthropic `inputDetails.cacheWrite` reporting only the last step's value in multi-step traces (e.g. subagent flows with prompt caching). `extractUsageMetrics` now reads cache-write tokens from the new Mastra-aggregated `usage.cacheCreationInputTokens` field (summed across all steps by `@mastra/core`) before falling back to `providerMetadata.anthropic.cacheCreationInputTokens` (which only carries the last step's value). The Anthropic input-token adjustment also recognizes a positive `cacheCreationInputTokens` as a signal that `inputTokens` already includes cache totals, preventing accidental double-counting.

```ts
// 3-step Anthropic subagent trace with prompt caching:
// Before: usage.inputDetails = { cacheRead: 12686, cacheWrite: 4005, text: 1271 }
// After:  usage.inputDetails = { cacheRead: 12686, cacheWrite: 5268, text: 8 }
```
