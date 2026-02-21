---
"@mastra/core": minor
---

Added `onStepFinish` and `onError` callbacks to `NetworkOptions`. These callbacks are forwarded to sub-agent `stream()` and `resumeStream()` calls during network execution, enabling per-LLM-step progress monitoring and error handling — the same observability that `agent.stream()` already provides.

**Example usage:**

```typescript
const stream = await agent.network("Research AI trends", {
  onStepFinish: (event) => {
    console.log("Step completed:", event.finishReason, event.usage);
  },
  onError: ({ error }) => {
    console.error("Network error:", error);
  },
  memory: {
    thread: "my-thread",
    resource: "my-resource",
  },
});
```
