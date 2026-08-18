---
'@mastra/core': patch
---

Fixed model configuration validation so configs with non-string routing fields (`id`, `providerId`, or `modelId`) are rejected with the standard "Invalid model configuration provided" error instead of failing later inside the model router. Fixes #21588
