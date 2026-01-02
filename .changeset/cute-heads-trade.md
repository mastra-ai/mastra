---
'@mastra/codemod': patch
'@mastra/core': patch
---

**Breaking Change:** `memory.readOnly` has been moved to `memory.options.readOnly`

The `readOnly` option now lives inside `memory.options` alongside other memory configuration like `lastMessages` and `semanticRecall`.

**Before:**
```typescript
agent.stream('Hello', {
  memory: {
    thread: threadId,
    resource: resourceId,
    readOnly: true,
  },
});
```

**After:**
```typescript
agent.stream('Hello', {
  memory: {
    thread: threadId,
    resource: resourceId,
    options: {
      readOnly: true,
    },
  },
});
```

**Migration:** Run the codemod to update your code automatically:
```shell
npx @mastra/codemod@beta v1/memory-readonly-to-options .
```

This also fixes issue #11519 where `readOnly: true` was being ignored and messages were saved to memory anyway.
