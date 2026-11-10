---
'@mastra/inngest': patch
'@mastra/core': patch
'@mastra/pg': patch
---

Kept a throwing `stopWhen` rejecting Inngest durable agent streams, now that a throwing workflow loop condition fails the run instead of rejecting `run.start()`.
