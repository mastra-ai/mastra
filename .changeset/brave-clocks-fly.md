---
'@mastra/core': patch
---

Fixed background-task cancellation so terminal workflow events always carry a valid `prevResult`, and split the continuation prompt so completed, failed, cancelled, and suspended background tasks each get clearer LLM instructions.
