---
'@mastra/ai-sdk': patch
---

Fixed `chatRoute` and `handleChatStream` ignoring agent instructions and tools edited through the Agent Editor. When an editor is configured, the chat endpoint now applies the agent's stored overrides just like Studio does, instead of running the bare code-defined agent. Previously, instructions edited in the editor were silently dropped and the agent answered as if it had none.
