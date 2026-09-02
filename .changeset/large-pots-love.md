---
'@mastra/core': patch
---

Stopped sending a synthetic `user: "."` turn to every provider when a conversation history begins with an assistant message. Fixes #22874

- The user-first turn is now only inserted for Google and Vertex models, which reject assistant-first histories.
- OpenAI, Anthropic and other providers now receive the history exactly as stored.
- `ProviderHistoryCompat` is enabled by default on every agent; a configured instance still replaces the default.
- A debug log is emitted when the synthetic turn is added.
