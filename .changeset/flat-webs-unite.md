---
'@mastra/rag': minor
---

Added `user` to the vector store resolver context. Dynamic `vectorStore` resolvers on RAG tools now receive the authenticated end user (`id`, `name?`, `email?`, `avatarUrl?`, `role?`) alongside `requestContext` and `mastra`.

```ts
const queryTool = createVectorQueryTool({
  indexName: 'docs',
  model: embedder,
  vectorStore: ({ user }) => (user ? getTenantStore(user.id) : sharedStore),
});
```

`@mastra/rag` now requires `@mastra/core` 1.81.0 or later.
