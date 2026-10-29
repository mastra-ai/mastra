---
'@mastra/core': patch
'@mastra/inngest': patch
---

Fixed Inngest durable agents writing to memory after `modelSettings.timeout.totalMs` expired. A tool that finished after the deadline could still save its result (and the unfinished step) to memory, even with `savePerStep` off. Once the deadline fires, later memory writes are now blocked.

Inngest durable agents now save the accepted user message before the run starts, as the other durable engines do. A run that times out or fails keeps the user's turn in history, even when the deadline fires before that save finishes.
