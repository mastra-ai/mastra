---
'@mastra/memory': minor
'@mastra/server': minor
'@mastra/core': minor
---

**BREAKING CHANGE**: Memory scope defaults changed from 'thread' to 'resource'

Both `workingMemory.scope` and `semanticRecall.scope` now default to `'resource'` instead of `'thread'`. This means:

- Working memory persists across all conversations for the same user/resource
- Semantic recall searches across all threads for the same user/resource

**Migration**: To maintain the previous thread-scoped behavior, explicitly set `scope: 'thread'`:

```typescript
memory: new Memory({
  storage,
  workingMemory: {
    enabled: true,
    scope: 'thread', // Explicitly set for thread-scoped behavior
  },
  semanticRecall: {
    scope: 'thread', // Explicitly set for thread-scoped behavior
  },
}),
```

See the [migration guide](https://mastra.ai/docs/guides/migrations/memory-scope-defaults) for more details.

Also fixed issues where playground semantic recall search could show missing or incorrect results in certain cases.
