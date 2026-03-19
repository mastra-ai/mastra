---
'@mastra/ai-sdk': patch
---

Fixed `withMastra` to accept `LanguageModelV3` models from the latest AI SDK (`@ai-sdk/openai@3+`, `ai@6+`). Previously, passing a V3 model caused a TypeScript error: `LanguageModelV3 is not assignable to LanguageModelV2`. The function now accepts both `LanguageModelV2` and `LanguageModelV3` via overloads.
