---
'@mastra/core': minor
---

Added `progressThrottleMs` to background task configuration so high-frequency progress output can be coalesced before it reaches pubsub and stream consumers.

```ts
const mastra = new Mastra({
  backgroundTasks: {
    enabled: true,
    progressThrottleMs: 500,
  },
});
```
