---
'@mastra/core': patch
---

Improved background task execution across multiple processes. Invocation-bound tasks stay on the process that owns their executor, cancellation reliably reaches local work, and queued tasks continue after dispatch failures.

**Stale task recovery**

Startup recovery remains enabled by default. Disable it when multiple live managers share storage and task ownership cannot be verified across processes:

```ts
const mastra = new Mastra({
  backgroundTasks: {
    enabled: true,
    recoverStaleTasksOnStart: false,
  },
});
```
