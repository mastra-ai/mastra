---
'@mastra/core': patch
---

Fixed crashes when using `ModelRouterLanguageModel` with AI SDK v6's `generateObject()` or `generateText()`. The model router now correctly preserves usage and metadata from underlying models.

