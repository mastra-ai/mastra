---
"@mastra/core": minor
---

Added `onStepFinish` and `onError` callbacks to `NetworkOptions`, allowing per-LLM-step progress monitoring and custom error handling during network execution. Closes #13362.

**Before:** No way to observe per-step progress or handle errors during network execution.

```typescript
const stream = await agent.network("Research AI trends", {
  memory: { thread: "my-thread", resource: "my-resource" },
});
```

**After:** `onStepFinish` and `onError` are now available in `NetworkOptions`.

```typescript
const stream = await agent.network("Research AI trends", {
  onStepFinish: (event) => {
    console.log("Step completed:", event.finishReason, event.usage);
  },
  onError: ({ error }) => {
    console.error("Network error:", error);
  },
  memory: { thread: "my-thread", resource: "my-resource" },
});
```
