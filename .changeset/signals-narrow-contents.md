---
'@mastra/core': minor
---

Narrows `AgentSignalContents` from `BaseMessageListInput` to `string | (TextPart | FilePart)[]`.

This also fixes two signal-content bugs:

- `user-message` signal attributes now reach the LLM
- multimodal non-`user-message` signals no longer lose file parts

Callers that previously passed wrapped message shapes to `agent.sendSignal` should now pass a bare string or a bare parts array.
