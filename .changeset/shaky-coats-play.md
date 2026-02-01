---
'@mastra/memory': minor
'@mastra/core': patch
---

Expose token usage from embedding operations

- `saveMessages` now returns `usage: { tokens: number }` with aggregated token count from all embeddings
- `recall` now returns `usage: { tokens: number }` from the vector search query embedding
- Updated abstract method signatures in `MastraMemory` to include optional `usage` in return types

This allows users to track embedding token usage when using the Memory class.
