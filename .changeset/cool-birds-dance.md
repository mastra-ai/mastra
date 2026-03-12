---
'@mastra/core': patch
---

Fixed `onStepFinish` and `onFinish` callback type parameters to use `Tools` (ToolSet) instead of `inferOutput<Output>`, and added a type cast for `createOpenRouter()` return to bridge structurally equivalent `LanguageModelV2` types across AI SDK versions.
