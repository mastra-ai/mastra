---
"@mastra/core": patch
---

Fix generateTitle model type to accept AI SDK LanguageModelV2

Updated the `generateTitle.model` config option to accept `MastraModelConfig` instead of `MastraLanguageModel`. This allows users to pass raw AI SDK `LanguageModelV2` models (e.g., `anthropic.languageModel('claude-3-5-haiku-20241022')`) directly without type errors.

Previously, passing a standard `LanguageModelV2` would fail because `MastraLanguageModelV2` has different `doGenerate`/`doStream` return types. Now `MastraModelConfig` is used consistently across:
- `memory/types.ts` - `generateTitle.model` config
- `agent.ts` - `genTitle`, `generateTitleFromUserMessage`, `resolveTitleGenerationConfig`
- `agent-legacy.ts` - `AgentLegacyCapabilities` interface

