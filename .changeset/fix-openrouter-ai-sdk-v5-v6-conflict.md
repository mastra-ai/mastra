---
'@mastra/core': patch
---

Fix build failure caused by AI SDK v5/v6 type incompatibility with OpenRouter provider. Added pnpm override to force `@openrouter/ai-sdk-provider@1.2.3` to use `ai@^5.0.97` instead of `ai@^6.0.1`, resolving the TypeScript error where `LanguageModelV2ProviderDefinedTool` (v5) was incompatible with `LanguageModelV2ProviderTool` (v6).

This fixes the build error: `Type '"provider-defined"' is not assignable to type '"provider"'` at `packages/core/src/llm/model/gateways/models-dev.ts:205`.
