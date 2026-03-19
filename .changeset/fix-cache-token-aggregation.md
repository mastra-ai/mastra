---
'@mastra/observability': patch
'@mastra/datadog': patch
---

Fix cache token extraction in multi-step agent runs. Prefer AI SDK aggregated `inputTokenDetails` over `providerMetadata` (which only reflects the last step). Also fix truthiness checks to correctly handle zero values for cache and reasoning tokens.

Fix Datadog metric keys to match dd-trace expected format: `cacheReadTokens`, `cacheWriteTokens`, `reasoningOutputTokens`.
