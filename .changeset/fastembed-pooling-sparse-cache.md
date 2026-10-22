---
'@mastra/fastembed': patch
---

Use attention-mask-aware mean pooling for MiniLM and multilingual E5 embeddings while preserving BGE CLS pooling. Publish sparse model caches only after complete downloads so failed downloads can be retried safely.
