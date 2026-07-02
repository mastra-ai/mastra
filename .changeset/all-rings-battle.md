---
'@mastra/core': patch
---

Fixed signal drain parity for durable agents. Signals sent to a running durable agent (via sendSignal or sendMessage) are now consumed and echoed to the client stream, matching the behavior of regular agents. This includes initial signal echoes on the first model request, pre-run signal drain before the first LLM call, within-iteration signal drain between tool execution and task completion, and inter-iteration signal drain in the loop predicate that forces continuation so the LLM sees newly arrived signals.
