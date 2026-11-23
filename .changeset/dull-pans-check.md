---
'@mastra/factory': patch
'@mastra/code-sdk': patch
'mastracode': patch
---

Factory keeps local embeddings installed up front: it now depends on `@mastra/fastembed` directly, so servers never download it at runtime.
