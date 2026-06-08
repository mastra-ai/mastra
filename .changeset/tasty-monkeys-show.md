---
'@mastra/core': minor
---

Refactored `lastMessages` config into a nested API that supports both count-based and token-based memory history limiting with persistent thread boundaries.

The flat `maxTokens` option has been replaced by nested fields under `lastMessages`:

```ts
new Memory({
  options: {
    lastMessages: {
      maxTokens: 800_000,       // Optional token-based limit
      atMaxRemoveTokens: 200_000, // Optional: drop by N tokens when over budget (default: 25% of maxTokens)
    },
  },
})
```

When `maxTokens` is configured and total tokens exceed the budget, oldest memory history messages are removed down to `maxTokens - atMaxRemoveTokens`. The trim point is remembered between turns, so future requests start from the same effective history boundary instead of repeatedly recounting and dropping the same old messages.

Legacy `lastMessages: number | false` still works. Input, context, and system messages are never removed.
