---
'@mastra/core': patch
---

Fixed `iterationCount` always being 1 for `dountil` and `dowhile` loops on the evented workflow engine. The count was never carried forward between iterations, so any loop whose condition depended on `iterationCount` never advanced and ran forever.

**Before**

```ts
// On the evented engine this loop never terminated: iterationCount stayed 1.
workflow.dountil(step, async ({ iterationCount }) => iterationCount >= 3);
```

**After**

The condition now receives an incrementing count (1, 2, 3, ...) exactly as it does on the default engine, so the loop stops as expected. Loops whose conditions read step output (`inputData`) were unaffected.
