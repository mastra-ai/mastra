---
'@mastra/core': patch
---

Fixed `.map()` losing its return type in workflows. A function passed to `.map()` now sets the input type of the next step, so TypeScript reports an error when that step expects a different shape. Synchronous mapping functions are now accepted too.

```ts
workflow
  .map(async ({ inputData }) => ({ wrong: inputData.value }))
  // Before: compiled. Now: type error, the step expects { name: string }
  .then(stepNeedingName);
```

Chains that compiled only because `.map()` returned `any` now fail type checking; return the shape the next step expects. Object-form mappings (`.map({ key: { step, path } })`) still produce `any`.

Fixes #6751
