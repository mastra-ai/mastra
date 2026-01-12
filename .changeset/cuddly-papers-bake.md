---
'@mastra/core': minor
'@mastra/ai-sdk': patch
'@mastra/rag': patch
'@mastra/agent-builder': patch
'@mastra/playground-ui': patch
---

Add support for AI SDK v6 (LanguageModelV3)

Agents can now use `LanguageModelV3` models from AI SDK v6 beta providers like `@ai-sdk/openai@^3.0.0-beta`.

**New features:**
- Usage normalization: V3's nested usage format is normalized to Mastra's flat format with `reasoningTokens`, `cachedInputTokens`, and raw data preserved in a `raw` field

**Backward compatible:** All existing V1 and V2 models continue to work unchanged.
