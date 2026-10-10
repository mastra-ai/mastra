---
'@mastra/memory': patch
---

Fixed Observational Memory wiping schema-based working memory when the model returns an empty object. An empty `{}` working memory update is now ignored instead of overwriting the stored working memory, and structured extraction now retries when the working memory value itself is empty (not only when the whole response is empty). Fixes #25907.
