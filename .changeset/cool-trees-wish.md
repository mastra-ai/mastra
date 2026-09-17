---
'@mastra/react': minor
---

`useStreamWorkflow` now returns `streamResult` as `undefined` until a run is started or observed, instead of an empty object typed as a result. Read its fields behind a guard.

**Before**

```ts
const { streamResult } = useStreamWorkflow({ debugMode: false });
const status = streamResult.status;
```

**After**

```ts
const { streamResult } = useStreamWorkflow({ debugMode: false });
const status = streamResult?.status;
```

Fixed workflow streams leaking across runs and retaining active readers after reset or unmount. Fixed a live per-step run staying `running` after the server paused it.
