---
'@mastra/core': patch
---

Added a batched harness helper for loading the first user message across multiple threads. This reduces repeated storage reads when thread previews are loaded in bulk.
