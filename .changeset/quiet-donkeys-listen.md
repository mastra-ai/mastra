---
'@mastra/voice-google-gemini-live': patch
---

Deduplicate tool calls by provider call id: the same function call delivered through both `serverContent.modelTurn.parts[].functionCall` and a top-level `toolCall` message now executes once and emits a single `toolResponse` instead of running the tool twice.
