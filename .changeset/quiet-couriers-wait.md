---
'@mastra/core': patch
'@mastra/inngest': patch
---

Inngest durable agents now save the accepted user message before the run starts, as the other durable engines do. A run that times out or fails keeps the user's turn in history, even when the deadline fires before that save finishes.
