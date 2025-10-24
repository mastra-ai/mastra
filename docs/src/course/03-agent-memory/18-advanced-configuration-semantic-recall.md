# Advanced Configuration of Semantic Recall

We can configure semantic recall in more detail by setting options for the `semanticRecall` option:

```typescript
const memory = new Memory({
  storage: new LibSQLStore({
    url: "file:../../memory.db", // relative path from the `.mastra/output` directory
  }),
  vector: new LibSQLVector({
    connectionUrl: "file:../../vector.db", // relative path from the `.mastra/output` directory
  }),
  embedder: openai.embedding("text-embedding-3-small"),
  options: {
    semanticRecall: {
      topK: 3,
      messageRange: {
        before: 2,
        after: 1,
      },
      scope: "resource", // Search across all threads for this user
      filter: { projectId: { $eq: "project-a" } }, // Optional: filter by metadata
    },
  },
});
```

The `topK` parameter controls how many semantically similar messages are retrieved. A higher value will retrieve more messages, which can be helpful for complex topics but may also include less relevant information. The default value is `2`.

The `messageRange` parameter controls how much context is included with each match. This is important because the matching message alone might not provide enough context to understand the conversation. Including messages before and after the match helps the agent understand the context of the matched message.

The `scope` parameter determines whether to search within the current thread (`'thread'`) or across all threads owned by a resource (`'resource'`). Using `scope: 'resource'` allows the agent to recall information from any of the user's past conversations.

The `filter` parameter allows you to restrict semantic recall results to specific metadata criteria, enabling ChatGPT-style "Projects" functionality. This is particularly useful when you want to organize conversations by project, category, or any other metadata field.

**Supported filter operators:**

- `$eq`: Equal to
- `$ne`: Not equal to
- `$in`: In array
- `$nin`: Not in array
- `$gt`: Greater than
- `$gte`: Greater than or equal
- `$lt`: Less than
- `$lte`: Less than or equal
- `$and`: Logical AND
- `$or`: Logical OR

**Example filter configurations:**

```typescript
// Filter by project
filter: {
  projectId: {
    $eq: "my-project";
  }
}

// Filter by multiple categories
filter: {
  category: {
    $in: ["work", "research"];
  }
}

// Complex filtering
filter: {
  $and: [{ projectId: { $eq: "project-a" } }, { priority: { $gte: 3 } }];
}
```
