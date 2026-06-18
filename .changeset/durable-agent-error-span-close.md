---
'@mastra/observability': patch
---

Fixed incomplete traces when a model errors mid-generation. The open `MODEL_STEP` and `MODEL_INFERENCE` spans are now closed with the error instead of being left dangling, so error traces are complete.
