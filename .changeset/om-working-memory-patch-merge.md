---
'@mastra/memory': patch
---

Fixed lost working memory updates when Observational Memory manages schema-based, resource-scoped working memory (`observation.manageWorkingMemory: true`). Observers of sibling threads that ran at the same time each saved the whole document, so the last one silently dropped facts the others had just saved.

The Observer now returns only the fields to add or change (`null` deletes a field). The result is validated against your schema and merged into the stored document. On stores with atomic merge support, such as `@mastra/pg`, the merge is row-locked and safe across processes. On other stores, updates are serialized within the process.

Markdown working memory still replaces the whole document, so Mastra now logs a warning once when it is combined with resource scope and managed working memory. Use a working memory schema or `workingMemory.scope: 'thread'` to avoid lost updates.
