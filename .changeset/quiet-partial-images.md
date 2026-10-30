---
'@mastra/core': patch
'@mastra/ai-sdk': patch
---

Fixed provider-executed tool results that stream partial values, such as OpenAI `image_generation` partial images with AI SDK v6. Partial results now keep `preliminary: true` on `tool-result` chunks and on the `tool-output-available` UI chunks sent to `useChat`, so they stay visible in the stream. Tool-result processing, `toolResults`, saved messages and tracing spans now use only the final result.
