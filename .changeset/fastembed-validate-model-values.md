---
'@mastra/fastembed': patch
---

Validate required ONNX output names before reading dense and sparse embeddings, and reject non-finite model values instead of returning invalid vectors or dropping sparse dimensions.
