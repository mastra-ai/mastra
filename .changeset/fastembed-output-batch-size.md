---
'@mastra/fastembed': patch
---

Direct `FlagEmbedding` and `SparseTextEmbedding` calls now throw a clear error when a custom ONNX model returns a different number of output rows than input texts, instead of returning the wrong number of embeddings or failing with an unrelated TypeError.
