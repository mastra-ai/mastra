---
'@mastra/core': patch
---

Fix dimension mismatch error when switching embedders in SemanticRecall. The processor now properly validates vector index dimensions when an index already exists, preventing runtime errors when switching between embedders with different dimensions (e.g., fastembed 384 dims → OpenAI 1536 dims).
