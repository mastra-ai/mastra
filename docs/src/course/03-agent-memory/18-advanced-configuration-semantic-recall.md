# Advanced configuration of semantic recall

Configure semantic recall with the `semanticRecall` option:

```typescript
const memory = new Memory({
  storage: new LibSQLStore({
    id: 'learning-memory-storage',
    url: 'file:../../memory.db', // relative path from the `.mastra/output` directory
  }),
  vector: new LibSQLVector({
    url: 'file:../../vector.db', // relative path from the `.mastra/output` directory
  }),
  embedder: openai.embedding('text-embedding-3-small'),
  options: {
    semanticRecall: {
      topK: 3,
      messageRange: {
        before: 2,
        after: 1,
      },
      scope: 'resource', // Search all threads for this resource
      filter: { projectId: { $eq: 'project-a' } },
    },
  },
})
```

The `topK` parameter controls how many similar messages Mastra retrieves. A higher value retrieves more messages, which can help with complex topics but may include less relevant information. The default value is `4`.

The `messageRange` parameter controls how much context Mastra includes with each match. Messages before and after the match help the agent understand the matched message.

The `scope` parameter controls whether Mastra searches the current thread (`'thread'`) or all threads owned by a resource (`'resource'`). Use `scope: 'resource'` to let the agent recall information from past conversations for the same resource.

The `filter` parameter restricts semantic recall results to messages with matching thread metadata, such as a project ID or category.

Filters match metadata stored on message embeddings when messages are saved. If thread metadata changes later, existing embeddings keep their previous metadata until those messages are saved or indexed again.

Supported filter operators:

- `$and`: Logical AND
- `$eq`: Equal to
- `$gt`: Greater than
- `$gte`: Greater than or equal
- `$in`: In array
- `$lt`: Less than
- `$lte`: Less than or equal
- `$ne`: Not equal to
- `$nin`: Not in array
- `$or`: Logical OR

The following example demonstrates metadata filters for common use cases:

```typescript
// Filter by project
const options = {
  semanticRecall: { filter: { projectId: { $eq: 'my-project' } } },
}

// Filter by multiple categories
const options = {
  semanticRecall: { filter: { category: { $in: ['work', 'research'] } } },
}

// Filter by project and priority
const options = {
  semanticRecall: {
    filter: {
      $and: [{ projectId: { $eq: 'project-a' } }, { priority: { $gte: 3 } }],
    },
  },
}
```
