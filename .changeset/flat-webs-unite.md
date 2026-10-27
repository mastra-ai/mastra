---
'@mastra/rag': minor
---

Added `user` to the vector store resolver context: dynamic `vectorStore` resolvers on RAG tools now receive the authenticated end user (`id`, `name?`, `email?`, `avatarUrl?`, `role?`) alongside `requestContext` and `mastra`.

`@mastra/rag` now requires `@mastra/core` 1.80.0 or later.
