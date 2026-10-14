---
'@mastra/memory': patch
---

Knowledge search no longer re-checks semantic hit visibility in the tool layer. Storage already decides which hits a caller sees, so scope nodes visible through their own id now appear in semantic results, and records on those nodes show the node's name instead of `(private node)`.
