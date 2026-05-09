---
'@mastra/ai-sdk': patch
---

Fixed cache write tokens not being set on the AI SDK v6 usage object. `inputTokenDetails.cacheWriteTokens` now reflects the prompt cache creation tokens reported by the provider instead of always being `undefined`. Previously this value was only accessible via `providerMetadata.anthropic.cacheCreationInputTokens`.
