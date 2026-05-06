---
'@mastra/core': patch
---

Added durable Tool Gate parity for agent runs. Durable preparation now records Tool Gate runtime state, durable LLM steps hide denied tools before model calls, and durable tool execution rejects denied calls or escalates approval according to the original run policy.
