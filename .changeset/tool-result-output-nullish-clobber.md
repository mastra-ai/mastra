---
'@mastra/core': patch
---

Fixed the durable Agent prompt build (`MessageList.llmPrompt`) overwriting a valid tool-result `output` with `undefined` when a tool's `toModelOutput` returns nothing (e.g. a text-only result). The resulting tool message had a missing `output`, which crashed providers that read `output.type` (such as OpenRouter) and aborted the request. The stored model output now only overrides when it is non-nullish.
