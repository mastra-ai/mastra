---
'@mastra/core': patch
---

Fixed the LLM request builder injecting a synthetic `user: "."` turn for every provider when a conversation history starts with an assistant message. Gemini rejects assistant-first histories, but that workaround was being applied to OpenAI, Anthropic and every other provider too, sending a fabricated user utterance on each request. The user-first turn is now only inserted when the resolved model is a Google or Vertex model, and a debug log is emitted when it happens. Fixes #22874
