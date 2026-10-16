---
'@mastra/core': major
'@mastra/rag': major
'@mastra/memory': major
'@mastra/fastembed': major
'@mastra/react': major
'@mastra/acp': major
'@mastra/ai-sdk': major
'@mastra/schema-compat': major
'@mastra/editor': patch
'@mastra/observability': patch
'@mastra/voyageai': patch
'@mastra/playground-ui': patch
---

Removed support for AI SDK v4 (`LanguageModelV1` / `EmbeddingModelV1`) models. Passing one now throws `AI SDK v4 (LanguageModelV1) models are not supported.` Use AI SDK v5 or later providers, or a model router string such as `'openai/gpt-4o-mini'`.

- `embedV1` is no longer exported from `@mastra/core/vector`.
- `fastembed.smallLegacy` and `fastembed.baseLegacy` are removed; use `fastembed.small` or `fastembed.base`.
- Message file parts use `mediaType` instead of `mimeType`, and `providerOptions` instead of `experimental_providerMetadata`.
- `MessageList` no longer accepts or produces AI SDK v4 messages. The `aiV4` views (`get.all.aiV4.*`), the `core()`/`ui()`/`prompt()` aliases, and the `AIV4.UI`/`AIV4.Core` conversion targets are removed; use the `aiV5` views or `AIV5.UI`/`AIV5.Model`. Messages stored in the older Mastra v1 format still load.
- `toAISdkV4Messages` is removed from `@mastra/ai-sdk`; use `toAISdkV5Messages`.
- `@mastra/schema-compat` no longer accepts AI SDK v4 `Schema` objects.
