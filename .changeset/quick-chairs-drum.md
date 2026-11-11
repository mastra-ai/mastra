---
'@mastra/core': patch
'@mastra/memory': patch
---

Stopped a user message from closing a multi-user turn and opening another. `asUserTurn` escapes the message text, and Mastra escapes a stored breakout before the model sees it.
