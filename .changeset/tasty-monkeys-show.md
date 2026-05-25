---
'@mastra/core': minor
---

Refactored `lastMessages` config into a nested API that supports both count-based and token-based memory history limiting with persistent thread boundaries.

The flat `maxTokens` option has been replaced by nested fields under `lastMessages`:

```ts
new Memory({
  options: {
    lastMessages: {
      maxMessages: Infinity,     // Optional count-based limit (default: 10)
      maxTokens: 800_000,       // Optional token-based limit
      atMaxRemoveTokens: 200_000, // Optional: drop by N tokens when over budget (default: 25% of maxTokens)
    },
  },
})
```

When `maxTokens` is configured and total tokens exceed the budget, oldest memory history messages are removed down to `maxTokens - atMaxRemoveTokens`. The newest removed message is persisted as a thread boundary (`thread.metadata.mastra.memoryTokenLimiter`) so future turns skip older messages instead of recounting all history. Token estimates are cached on message metadata (`content.metadata.mastra.tokenEstimate`) for reuse across turns.

Legacy `lastMessages: number | false` still works. Input, context, and system messages are never removed.
