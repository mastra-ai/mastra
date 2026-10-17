---
'@mastra/core': minor
---

Added `getStepResultAsync` to workflow step, condition, sleep, and `.map()` contexts, and deprecated `getStepResult`.

`getStepResultAsync` returns the same value as `getStepResult`, wrapped in a promise. Switching now prepares workflows for upcoming storage changes that load step results on demand instead of keeping every result in memory. `getStepResult` keeps working and will be removed in a future major release.

```ts
// Before
const step2 = createStep({
  execute: async ({ getStepResult }) => {
    const step1Result = getStepResult(step1);
  },
});

// After
const step2 = createStep({
  execute: async ({ getStepResultAsync }) => {
    const step1Result = await getStepResultAsync(step1);
  },
});
```

If your tests build step execute params by hand, add a `getStepResultAsync` function to them.
