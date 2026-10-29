---
'@mastra/core': patch
---

Fixed provider-executed tool results that stream partial values, such as OpenAI `image_generation` partial images with AI SDK v6. Partial results now keep `preliminary: true` on `tool-result` chunks. Output processors, saved messages and tracing spans now only use the final result.
