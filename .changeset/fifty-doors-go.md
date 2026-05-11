---
'@mastra/core': patch
---

Fixed tool result media content not reaching the model. Tools using `toModelOutput` to return images or files (e.g. screenshot tools) now work correctly with all AI SDK providers (Anthropic, OpenAI, Google).
