---
'@mastra/temporal': patch
---

Fixed Temporal workflow runs so unsupported streaming, resume, restart, and time-travel APIs now throw a clear error instead of silently executing with the local workflow engine.

Temporal runs currently support `start()`, `startAsync()`, and `cancel()`. If `stream()` was used only to execute a workflow and wait for its result, use `start()` instead:

```ts
const result = await run.start({ inputData });
```

Use `startAsync()` to submit a workflow without waiting for completion:

```ts
const { runId } = await run.startAsync({ inputData });
```

There is currently no Temporal-backed replacement for incremental workflow streaming, resume, restart, or time travel.
