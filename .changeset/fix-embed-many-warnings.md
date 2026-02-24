---
"@mastra/core": patch
---

Fixed `ModelRouterEmbeddingModel.doEmbed()` crashing with `TypeError: result.warnings is not iterable` when used with AI SDK v6's `embedMany`. The result now always includes a `warnings` array, ensuring forward compatibility across AI SDK versions.
