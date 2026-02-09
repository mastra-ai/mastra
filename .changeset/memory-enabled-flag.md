---
'@mastra/core': minor
---

Added `enabled` flag to `MemoryConfig` for dynamically disabling all memory functionality.

**Why:** Users requested the ability to disable memory entirely via runtime context, similar to how `instructions` and `model` can be dynamically configured. This provides a master switch to turn off all memory features (conversation history, semantic recall, working memory) with a single flag.

**Before:**

```typescript
// Had to disable each feature individually
memory: ({ requestContext }) => {
  return new Memory({
    options: {
      lastMessages: false,
      semanticRecall: false,
      workingMemory: { enabled: false }
    }
  });
}
```

**After:**

```typescript
// Can now disable all memory with one flag
memory: ({ requestContext }) => {
  const disableMemory = requestContext.get('disableMemory');
  return new Memory({
    options: {
      enabled: !disableMemory
    }
  });
}
```

**Changes:**
- Added `enabled?: boolean` to `MemoryConfig` type (default: `true`)
- Added check in `getInputProcessors()` and `getOutputProcessors()` to return empty arrays when disabled
- Added check in `createPrepareMemoryStep()` to skip thread creation when disabled
- Added check in `AgentLegacyHandler.__primitive()` for v1 compatibility
- Updated `MockMemory` to support `options` parameter
- Added regression tests for the new functionality
