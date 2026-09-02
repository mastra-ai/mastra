---
'@mastra/core': patch
---

Fixed the LLM request builder injecting a synthetic `user: "."` turn for every provider when a conversation history starts with an assistant message. Gemini rejects assistant-first histories, but that workaround was being applied to OpenAI, Anthropic and every other provider too, sending a fabricated user utterance on each request. The user-first turn is now inserted by a `ProviderHistoryCompat` rule that only fires for Google and Vertex models, and `ProviderHistoryCompat` is enabled by default on every agent so the fix applies without extra configuration. A debug log is emitted when the synthetic turn is added. Fixes #22874
