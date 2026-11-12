---
'@mastra/rag': patch
---

Reject JSON chunk sizes below 21 before they can stall chunking on long strings. Apply the same limit to direct `RecursiveJsonTransformer` use.
