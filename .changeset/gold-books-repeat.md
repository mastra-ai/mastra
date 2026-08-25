---
'@mastra/memory': minor
---

Added opt-in awaited Observational Memory hooks for synchronous cycles.

Set `hookExecution: "await"` to await lifecycle hooks, stop the observer or reflector when a start hook fails, and receive one paired end callback after cleanup. Async-buffer cycles remain fire-and-forget.

```ts
const memory = new Memory({
  options: {
    observationalMemory: {
      hookExecution: 'await',
      hooks: {
        onObservationStart: async context => {
          await authorizeObservation(context);
        },
      },
    },
  },
});
```
