---
'@mastra/core': patch
---

Fixed `.map()` losing its return type in workflows. A function passed to `.map()` now sets the input type of the next step, so TypeScript reports an error when that step expects a different shape. Synchronous mapping functions are now accepted too. `.dowhile()`, `.dountil()` and `.foreach()` now check the previous output the same way `.then()` does (the previous output must satisfy the step's input); they used to check the reverse, which rejected steps with optional input fields.

```ts
workflow
  .map(async ({ inputData }) => ({ wrong: inputData.value }))
  // Before: compiled. Now: type error, the step expects { name: string }
  .then(stepNeedingName);
```

Chains that compiled only because `.map()` returned `any` now fail type checking; return the shape the next step expects. The check uses the next step's parsed schema type, so a field with a Zod `.default()` counts as required: return it from the mapper, or drop the schema default. Object-form mappings (`.map({ key: { step, path } })`) still produce `any`.

Fixes #6751
