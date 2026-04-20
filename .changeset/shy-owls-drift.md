---
'@mastra/core': patch
---

Add background task execution for agents. Agents can dispatch slow tool calls to run asynchronously while the conversation keeps streaming, and results are injected back into the loop when they complete.
