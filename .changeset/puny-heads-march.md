---
'@mastra/core': patch
---

Fixed streaming delegation to propagate output processor modifications to the supervisor. Previously, when a sub-agent had an output processor that modified text via `processOutputResult`, the supervisor received the raw LLM output instead of the processed text. The processed text was only saved to the sub-agent's memory. Now the supervisor correctly receives the output-processor-modified text from delegated sub-agents in the streaming path.
