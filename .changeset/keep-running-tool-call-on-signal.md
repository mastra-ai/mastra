---
'@mastra/core': patch
---

Fixed tool calls disappearing from conversation history when a message or reminder arrived while the tool was still running. The call and its result now stay in history, so the model sees its own completed work on the next turn.
