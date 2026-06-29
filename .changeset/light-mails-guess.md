---
'@mastra/ai-sdk': patch
---

Fixed `chatRoute` and `handleChatStream` ignoring agent config edited through the Agent Editor. When an editor is configured, the chat endpoint now resolves the agent's stored config (instructions, tools, model) just like Studio does, instead of running the bare code-defined agent. Previously, instructions edited in the editor were silently dropped and the agent answered as if it had none.
