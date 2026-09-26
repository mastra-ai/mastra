---
'@mastra/core': patch
---

Fixed durable agents crashing during crash recovery when the process was restarted while an LLM call was in flight. The active step now restarts from its own preserved input instead of a completed predecessor's pruned output, which previously caused "Cannot read properties of undefined (reading 'messages')" (#22636).
