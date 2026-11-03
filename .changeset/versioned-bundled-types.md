---
'@mastra/core': patch
---

Fixed type declarations for bundled AI SDK packages. When `@mastra/core` bundled two versions of the same AI SDK package, one version's types overwrote the other's, so types such as `LanguageModelV3` used by the bundled OpenAI, Google and Anthropic providers resolved to `any`. Each version now keeps its own copy, so these types are checked again. Fixes [#28732](https://github.com/mastra-ai/mastra/issues/28732).
