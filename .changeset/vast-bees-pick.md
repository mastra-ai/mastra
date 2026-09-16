---
'@mastra/temporal': patch
---

Fixed Temporal workflow runs so unsupported streaming, resume, restart, and time-travel APIs fail clearly instead of executing with the local workflow engine.

**Before**

```ts
await run.stream({ inputData });
```

Unsupported APIs could execute through the local workflow engine instead of Temporal.

**After**

```ts
const result = await run.start({ inputData });
// Or start without waiting for completion:
const { runId } = await run.startAsync({ inputData });
```

Replace unsupported run APIs with `start()` or `startAsync()` so execution is delegated to Temporal.
