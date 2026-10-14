---
'@mastra/core': patch
---

Durable agent turns no longer create an unused tool stream writer on every LLM step. A writer is now created only when a step actually uses it.
