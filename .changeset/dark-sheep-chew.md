---
'@mastra/core': patch
---

Fixed model fallback logging so recovered attempts emit one warning and terminal failures keep their error details. Streamed error chunks now reach configured fallback models after error processors have had an opportunity to retry the current model.
