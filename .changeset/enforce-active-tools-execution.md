---
'@mastra/core': patch
---

Fixed `activeTools` to also enforce at execution time, not just at the model prompt. Tool calls to tools not in the active set are now rejected with a `ToolNotFoundError`.
