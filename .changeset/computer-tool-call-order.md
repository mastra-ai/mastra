---
'@mastra/core': patch
---

Fixed computer tools running out of order. When a model calls several computer tools in one step (for example click, type, then press Enter), they now run one at a time in the order the model called them in the standard agent loop, without setting `toolCallConcurrency: 1`. Other tools in the same step still run concurrently.
