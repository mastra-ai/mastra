---
'@mastra/fastembed': patch
---

Add `warmup()` export to pre-download fastembed models without creating ONNX sessions. This prevents concurrent download race conditions when multiple consumers call `FlagEmbedding.init()` in parallel, which could corrupt the model archive and cause `Z_BUF_ERROR`.
