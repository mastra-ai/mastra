---
'@mastra/fastembed': patch
---

Fixed FastEmbed silently returning empty embeddings for invalid setups. `FlagEmbedding.init()` and `SparseTextEmbedding.init()` now throw a `RangeError` when `maxLength` is not a positive integer (for example `0`, `0.5` or `NaN`), and embedding now throws a clear error when a custom ONNX model's output does not have the expected `[batch, sequence, features]` shape, instead of returning empty vectors.
