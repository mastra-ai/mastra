---
'@mastra/core': patch
---

Fixed durable agents (`createDurableAgent`) losing all of their tools when the editor applies a stored override. Publishing an override that only changes instructions or the model used to swap the per-request served agent for a bare `Agent` with no tools, breaking semantic recall, `rerank()`, GraphRAG and any `minScore` filter. The served agent now stays a durable agent and keeps its code-owned tools, model, memory and other delegating behavior.
