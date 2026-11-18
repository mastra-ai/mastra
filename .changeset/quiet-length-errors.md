---
'@mastra/core': patch
---

`Agent.generate()` and `Agent.stream()` now raise an error when a model step stops at its output-token limit before writing any text or tool calls, for example when a reasoning model spends its whole budget thinking. Previously the run finished with empty text and no error. The error says the model reached its maximum output length, the same message AgentController shows. Truncated text that ends at the limit is still returned as before.
