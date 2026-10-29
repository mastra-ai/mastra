---
'@internal/playground': patch
---

Experiment results for agents now list the tools the agent called, with their arguments and results, in both the comparison view and the result panel.

When an agent called tools but never wrote a final answer (for example after hitting its step limit), Studio now shows "No final text response after N tool calls" instead of dumping the raw output as JSON.
